/**
 * Server-side lesson document fetching & text extraction.
 *
 * Runs on the Node server (no browser CORS limits), so it can download
 * publicly shared Google Drive files (PDF, DOCX, TXT), export Google Docs,
 * and read direct https links to .pdf / .docx / .txt files.
 */
import dns from "node:dns/promises";
import net from "node:net";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_TEXT_CHARS = 120000;

const FETCH_TIMEOUT_MS = 25000;
const GOOGLE_HOSTS = new Set([
  "docs.google.com",
  "drive.google.com",
  "drive.usercontent.google.com"
]);

export class DocExtractError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ----------------------------------------------------------------------------
// Format detection & text extraction from raw bytes
// ----------------------------------------------------------------------------

export function detectFormat(bytes, { fileName = "", contentType = "" } = {}) {
  const name = String(fileName || "").toLowerCase();
  const ct = String(contentType || "").toLowerCase();
  const head = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  if (head === "%PDF-") return "pdf";
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (isZip && (name.endsWith(".docx") || ct.includes("wordprocessingml") || !name)) return "docx";
  if (isZip) return "docx";
  // Legacy binary .doc (OLE2 compound file) is not supported
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return "doc_legacy";
  if (ct.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  return "txt";
}

function cleanText(text) {
  return String(text || "")
    .replace(/^﻿/, "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(bytes) {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch (err) {
    if (err && /password/i.test(String(err.name || err.message))) {
      throw new DocExtractError("PDF_ENCRYPTED", "This PDF is password-protected. Please upload an unlocked copy.");
    }
    throw new DocExtractError("PDF_INVALID", "Could not open the PDF file (it may be damaged).");
  }
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const joined = pages.map((p) => String(p || "").trim()).filter(Boolean).join("\n\n");
  if (!joined.trim()) {
    throw new DocExtractError(
      "PDF_NO_TEXT",
      "This PDF has no selectable text (it looks like a scanned image). Please share a PDF with real text, or a Google Doc / DOCX version."
    );
  }
  return joined;
}

async function extractDocx(bytes) {
  try {
    const res = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return res && res.value ? res.value : "";
  } catch (_err) {
    throw new DocExtractError("DOCX_INVALID", "Could not read the Word (.docx) file (it may be damaged).");
  }
}

function decodeTextBytes(bytes) {
  const buf = Buffer.from(bytes);
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

/**
 * Extracts plain text from a file buffer (PDF, DOCX, TXT).
 * @returns {Promise<{format: string, text: string, truncated: boolean, charCount: number}>}
 */
export async function extractTextFromBuffer(bytes, { fileName = "", contentType = "" } = {}) {
  if (!bytes || bytes.length === 0) {
    throw new DocExtractError("EMPTY_FILE", "The file is empty.");
  }
  if (bytes.length > MAX_FILE_BYTES) {
    throw new DocExtractError("FILE_TOO_LARGE", "File is larger than 20 MB.", 413);
  }
  const format = detectFormat(bytes, { fileName, contentType });
  let raw = "";
  if (format === "pdf") raw = await extractPdf(bytes);
  else if (format === "docx") raw = await extractDocx(bytes);
  else if (format === "doc_legacy") {
    throw new DocExtractError(
      "UNSUPPORTED_FORMAT",
      "Old Word .doc files are not supported. Please save the file as .docx or PDF (File → Save As)."
    );
  } else {
    const ct = String(contentType || "").toLowerCase();
    if (ct.includes("text/html")) {
      throw new DocExtractError("UNSUPPORTED_FORMAT", "The link returned a web page instead of a document file.");
    }
    raw = decodeTextBytes(bytes);
  }
  const text = cleanText(raw);
  if (!text) {
    throw new DocExtractError("EMPTY_TEXT", "The document contains no readable text.");
  }
  const truncated = text.length > MAX_TEXT_CHARS;
  const out = text.slice(0, MAX_TEXT_CHARS);
  return { format: format === "doc_legacy" ? "doc" : format, text: out, truncated, charCount: out.length };
}

// ----------------------------------------------------------------------------
// Safe network fetching (SSRF-protected for non-Google hosts)
// ----------------------------------------------------------------------------

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return false;
}

async function assertSafeUrl(urlStr) {
  let u;
  try {
    u = new URL(urlStr);
  } catch (_e) {
    throw new DocExtractError("INVALID_URL", "Invalid document URL.");
  }
  if (u.protocol !== "https:") {
    throw new DocExtractError("INVALID_URL", "Only https:// document links are supported.");
  }
  const host = u.hostname.toLowerCase();
  if (GOOGLE_HOSTS.has(host) || host.endsWith(".googleusercontent.com")) return u;
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new DocExtractError("INVALID_URL", "This address is not allowed.");
    return u;
  }
  let addrs = [];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch (_e) {
    throw new DocExtractError("NOT_FOUND", "Could not reach the document host.", 404);
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new DocExtractError("INVALID_URL", "This address is not allowed.");
  }
  return u;
}

async function readLimited(res) {
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_FILE_BYTES) {
    throw new DocExtractError("FILE_TOO_LARGE", "File is larger than 20 MB.", 413);
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_FILE_BYTES) {
      await reader.cancel().catch(() => {});
      throw new DocExtractError("FILE_TOO_LARGE", "File is larger than 20 MB.", 413);
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** Fetch with manual redirect handling so every hop is SSRF-checked. */
async function safeFetch(urlStr, { maxRedirects = 6 } = {}) {
  let current = urlStr;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafeUrl(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SnowDayLessonReader/1.0)", Accept: "*/*" }
      });
    } catch (_e) {
      clearTimeout(timer);
      throw new DocExtractError("NETWORK_ERROR", "Could not download the document (network error or timeout).", 502);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      const next = new URL(res.headers.get("location"), current).toString();
      if (/accounts\.google\.com|ServiceLogin/i.test(next)) {
        throw new DocExtractError("PRIVATE", "This file is private.", 403);
      }
      current = next;
      continue;
    }
    try {
      const bytes = res.ok ? await readLimited(res) : new Uint8Array();
      return {
        status: res.status,
        ok: res.ok,
        url: current,
        contentType: (res.headers.get("content-type") || "").toLowerCase(),
        contentDisposition: res.headers.get("content-disposition") || "",
        bytes
      };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new DocExtractError("NETWORK_ERROR", "Too many redirects while downloading the document.", 502);
}

function looksLikeHtml(resp) {
  if (resp.contentType.includes("text/html")) return true;
  const head = Buffer.from(resp.bytes.subarray(0, 200)).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

function fileNameFromDisposition(cd) {
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch (_e) {}
  }
  const plain = cd.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : "";
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

const PRIVATE_MESSAGE =
  "This document or Drive file is private. Open it → Share → General access → 'Anyone with the link' (Viewer).";

/** Try Google Docs native export for an ID; returns null if it's not a native Google Doc. */
async function tryGoogleDocExport(id) {
  const resp = await safeFetch(`https://docs.google.com/document/d/${encodeURIComponent(id)}/export?format=txt`).catch(
    (err) => {
      if (err instanceof DocExtractError && err.code === "PRIVATE") return { private: true };
      return null;
    }
  );
  if (!resp) return null;
  if (resp.private) return { private: true };
  if (!resp.ok || looksLikeHtml(resp)) return null;
  const text = cleanText(decodeTextBytes(resp.bytes));
  if (!text) return null;
  return { format: "gdoc", text: text.slice(0, MAX_TEXT_CHARS), truncated: text.length > MAX_TEXT_CHARS };
}

/** Download a Google Drive file (PDF/DOCX/TXT), handling the large-file virus-scan confirm page. */
async function downloadDriveFile(id) {
  const urls = [
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&confirm=t`
  ];
  let sawPrivate = false;
  let sawNotFound = false;
  for (const url of urls) {
    let resp;
    try {
      resp = await safeFetch(url);
    } catch (err) {
      if (err instanceof DocExtractError && err.code === "PRIVATE") {
        sawPrivate = true;
        continue;
      }
      if (err instanceof DocExtractError && err.code === "FILE_TOO_LARGE") throw err;
      continue;
    }
    if (resp.status === 401 || resp.status === 403) {
      sawPrivate = true;
      continue;
    }
    if (resp.status === 404) {
      sawNotFound = true;
      continue;
    }
    if (!resp.ok) continue;

    if (looksLikeHtml(resp)) {
      const html = Buffer.from(resp.bytes).toString("utf8");
      // "Google Drive can't scan this file for viruses" confirmation form
      const form = html.match(/<form[^>]+id="download-form"[^>]+action="([^"]+)"[\s\S]*?<\/form>/i);
      if (form) {
        const action = form[1].replace(/&amp;/g, "&");
        const params = new URLSearchParams();
        for (const m of form[0].matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi)) {
          params.set(m[1], m[2].replace(/&amp;/g, "&"));
        }
        const confirmUrl = new URL(action);
        params.forEach((v, k) => confirmUrl.searchParams.set(k, v));
        const confirmed = await safeFetch(confirmUrl.toString());
        if (confirmed.ok && !looksLikeHtml(confirmed)) return confirmed;
      }
      if (/accounts\.google\.com|ServiceLogin|You need access|Request access/i.test(html)) {
        sawPrivate = true;
      }
      continue;
    }
    return resp;
  }
  if (sawPrivate) throw new DocExtractError("PRIVATE", PRIVATE_MESSAGE, 403);
  if (sawNotFound) throw new DocExtractError("NOT_FOUND", "Document or Drive file not found (404). Please check the link.", 404);
  throw new DocExtractError(
    "DOWNLOAD_FAILED",
    "Could not download this Drive file. Make sure it is shared as 'Anyone with the link' and is a PDF, DOCX, TXT, or Google Doc.",
    502
  );
}

function extractGoogleId(input) {
  const s = String(input || "");
  const m = s.match(/\/(?:document|file|presentation|spreadsheets)\/d\/(?!e\/)([a-zA-Z0-9_-]{15,})/);
  if (m) return m[1];
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    if (GOOGLE_HOSTS.has(host)) {
      const q = u.searchParams.get("id");
      if (q && /^[a-zA-Z0-9_-]{15,}$/.test(q)) return q;
    }
  } catch (_e) {}
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s.trim())) return s.trim();
  return "";
}

/**
 * Fetches and extracts lesson text from a Google Doc, Google Drive file (PDF/DOCX/TXT),
 * published Google Doc, or a direct https link to a .pdf/.docx/.txt file.
 */
export async function fetchAndExtractFromUrl(rawUrl) {
  const input = String(rawUrl || "").trim();
  if (!input) throw new DocExtractError("INVALID_URL", "Missing document URL.");

  // Published-to-web Google Doc
  const pub = input.match(/docs\.google\.com\/document\/d\/e\/([a-zA-Z0-9_-]+)/i);
  if (pub) {
    const resp = await safeFetch(`https://docs.google.com/document/d/e/${pub[1]}/pub`);
    if (!resp.ok) throw new DocExtractError("NOT_FOUND", "Published Google Doc could not be loaded.", 404);
    const text = cleanText(htmlToText(Buffer.from(resp.bytes).toString("utf8")));
    if (!text) throw new DocExtractError("EMPTY_TEXT", "The published document is empty.");
    return { format: "gdoc", text: text.slice(0, MAX_TEXT_CHARS), truncated: text.length > MAX_TEXT_CHARS, charCount: Math.min(text.length, MAX_TEXT_CHARS) };
  }

  const id = extractGoogleId(input);
  if (id) {
    // Native Google Doc → plain-text export. Word/PDF files opened in Docs (rtpof=true)
    // are not native, so fall through to a Drive download for those.
    const exported = await tryGoogleDocExport(id);
    if (exported && !exported.private) {
      return { ...exported, charCount: exported.text.length };
    }
    const file = await downloadDriveFile(id);
    const fileName = fileNameFromDisposition(file.contentDisposition);
    const result = await extractTextFromBuffer(file.bytes, { fileName, contentType: file.contentType });
    return { ...result, fileName };
  }

  // Direct https link to a document file
  const resp = await safeFetch(input);
  if (resp.status === 401 || resp.status === 403) throw new DocExtractError("PRIVATE", "Access to this file is denied.", 403);
  if (resp.status === 404) throw new DocExtractError("NOT_FOUND", "File not found (404).", 404);
  if (!resp.ok) throw new DocExtractError("DOWNLOAD_FAILED", `Could not download the file (HTTP ${resp.status}).`, 502);
  const fileName = fileNameFromDisposition(resp.contentDisposition) || decodeURIComponent(new URL(resp.url).pathname.split("/").pop() || "");
  const result = await extractTextFromBuffer(resp.bytes, { fileName, contentType: resp.contentType });
  return { ...result, fileName };
}
