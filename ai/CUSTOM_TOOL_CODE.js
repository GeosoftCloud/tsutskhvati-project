//> pdf-parse
//> mammoth

/**
 * Geosoft Custom Tool — Sandboxed Function Body (`code`)
 * Tool Name: Google Doc & Drive File Lesson Reader
 * Icon: FileText
 * Returns HTML: false
 *
 * Supported formats:
 *   - Google Docs (shared as 'Anyone with the link can view')
 *   - Published Google Docs (/document/d/e/.../pub)
 *   - Google Drive PDFs (/file/d/<ID>/... or open?id=<ID>)
 *   - Google Drive Word DOCX files
 *   - Google Drive plain text files (.txt)
 *   - Direct public URLs to .pdf, .docx, or .txt lesson files
 *
 * Paste ONLY the code below into Geosoft Admin -> Tools -> + New -> Code
 * (Do NOT wrap in `async function run(config, args) { ... }` — Geosoft wraps it automatically.)
 */

const rawInput = String((args && (args.docUrl || args.fileUrl)) || "").trim();
if (!rawInput) {
  throw new Error("Missing docUrl argument. Provide a Google Docs, Drive file (PDF, DOCX, TXT) share link, or document ID.");
}

// Built-in contest demo preset guard
if (/^DEMO_/i.test(rawInput) || rawInput.includes("/d/DEMO_")) {
  return {
    ok: true,
    isDemoPreset: true,
    docUrl: rawInput,
    fileType: "demo",
    note: "This is a built-in contest demo preset. Use the inline teacher lesson text provided in LESSON_CONTEXT plus curriculum-accurate subject knowledge."
  };
}

const maxChars = Math.min(
  Math.max(Number((config && config.maxChars) || 45000), 2000),
  120000
);

// ============================================================================
// Case 0: Use the SnowDay site server's extractor first (real PDF/DOCX parsing,
// Drive virus-scan page handling, and teacher-uploaded files).
// Servers are tried in order until one answers. The Cloud Run URL keeps working
// even after answer.ge is mapped to the same service, so it stays first.
// Optional override: config.extractApiBase (tried before the defaults).
// ============================================================================
const SITE_API_BASES = [
  config && config.extractApiBase,
  "https://tsutskhvati-web-617054738609.europe-west1.run.app",
  "https://answer.ge"
]
  .filter(Boolean)
  .map((b) => String(b).trim().replace(/\/+$/, ""))
  .filter((b, i, arr) => /^https:\/\//i.test(b) && arr.indexOf(b) === i);

const DEFINITIVE_SITE_ERRORS = ["PRIVATE", "NOT_FOUND", "PDF_NO_TEXT", "PDF_ENCRYPTED", "UNSUPPORTED_FORMAT", "FILE_TOO_LARGE"];

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...(options || {}), signal: ctrl.signal });
    return await res.json().catch(() => null);
  } catch (_e) {
    return null; // network error / timeout → try next server
  } finally {
    clearTimeout(timer);
  }
}

{
  const uploadMatch = rawInput.match(/^(https:\/\/[^/\s]+)\/api\/docs\/uploads\/([A-Za-z0-9_-]{16,64})/i);
  // Uploaded files: try the host in the link first, then the known servers (same Firestore data)
  const candidates = uploadMatch
    ? [uploadMatch[1], ...SITE_API_BASES].filter((b, i, arr) => arr.indexOf(b) === i)
    : SITE_API_BASES;

  for (const base of candidates) {
    const siteData = uploadMatch
      ? await fetchJsonWithTimeout(base + "/api/docs/uploads/" + uploadMatch[2], { method: "GET" }, 15000)
      : await fetchJsonWithTimeout(
          base + "/api/docs/extract",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: rawInput })
          },
          40000
        );

    if (!siteData || typeof siteData.ok !== "boolean") continue; // not reachable / not our server

    if (siteData.ok && siteData.text) {
      const text = String(siteData.text).slice(0, maxChars);
      return {
        ok: true,
        fileType: siteData.format || "doc",
        sourceUrl: rawInput,
        charCount: text.length,
        truncated: Boolean(siteData.truncated) || siteData.text.length > maxChars,
        content: text
      };
    }
    if (siteData.ok === false && DEFINITIVE_SITE_ERRORS.includes(siteData.error)) {
      throw new Error(siteData.message || siteData.error);
    }
    // Other errors (rate limit, temporary failure) → try the next server
  }

  if (uploadMatch) {
    throw new Error("Uploaded lesson file could not be loaded from the SnowDay server. Please try again later.");
  }
  // No site server reachable → fall back to the built-in readers below
}

function decodeHtmlEntities(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Pure JS ZIP entry finder to locate and extract uncompressed/compressed files inside a ZIP (DOCX)
 */
function findZipEntry(buffer, targetName) {
  const bytes = new Uint8Array(buffer);
  let pos = 0;
  while (pos < bytes.length - 30) {
    if (bytes[pos] === 0x50 && bytes[pos + 1] === 0x4b && bytes[pos + 2] === 0x03 && bytes[pos + 3] === 0x04) {
      const compMethod = bytes[pos + 8] | (bytes[pos + 9] << 8);
      const compSize = (bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)) >>> 0;
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8);
      const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8);
      const nameBytes = bytes.slice(pos + 30, pos + 30 + nameLen);
      const name = new TextDecoder("utf-8").decode(nameBytes);
      const dataOffset = pos + 30 + nameLen + extraLen;
      if (name === targetName) {
        return { compMethod, data: bytes.slice(dataOffset, dataOffset + compSize) };
      }
      pos = dataOffset + compSize;
    } else {
      pos++;
    }
  }
  return null;
}

/**
 * Decompress deflate-raw bytes using Web Streams DecompressionStream
 */
async function decompressRaw(compressedBytes) {
  if (typeof DecompressionStream === "function") {
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();
    const chunks = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
  throw new Error("DecompressionStream is not supported in this runtime environment.");
}

async function decompressZlib(compressedBytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("DecompressionStream is not supported in this runtime environment.");
  }
  const stream = new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Extract clean plain text from DOCX XML (word/document.xml)
 */
function extractDocxXmlText(xml) {
  const paragraphs = [];
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[0];
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let tMatch;
    let pText = "";
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      pText += tMatch[1];
    }
    if (pText.trim()) {
      paragraphs.push(pText.trim());
    }
  }
  return paragraphs.join("\n\n");
}

/**
 * Pure JS text extraction from a DOCX buffer
 */
async function extractDocxText(buffer) {
  // Option 1: Try mammoth if available
  try {
    const mammoth = typeof require === "function" ? require("mammoth") : null;
    if (mammoth && typeof mammoth.extractRawText === "function") {
      const res = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      if (res && res.value && res.value.trim()) {
        return res.value.trim();
      }
    }
  } catch (_e) {}

  // Option 2: Pure JS ZIP extraction of word/document.xml
  const entry = findZipEntry(buffer, "word/document.xml");
  if (!entry) {
    throw new Error("Could not find word/document.xml inside DOCX file.");
  }
  let xmlBytes;
  if (entry.compMethod === 0) {
    xmlBytes = entry.data;
  } else if (entry.compMethod === 8) {
    xmlBytes = await decompressRaw(entry.data);
  } else {
    throw new Error("Unsupported DOCX compression method: " + entry.compMethod);
  }
  const xml = new TextDecoder("utf-8").decode(xmlBytes);
  return extractDocxXmlText(xml);
}

/**
 * Pure JS text extraction from PDF stream blocks
 */
async function extractPdfText(buffer) {
  // Option 1: Try pdf-parse if available in Node environment
  try {
    const pdfParse = typeof require === "function" ? require("pdf-parse") : null;
    if (pdfParse && typeof pdfParse === "function") {
      const data = await pdfParse(Buffer.from(buffer));
      if (data && data.text && data.text.trim()) {
        return data.text.trim();
      }
    }
  } catch (_e) {}

  // Option 2: Pure JS stream parser fallback
  const bytes = new Uint8Array(buffer);
  const latin1 = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
  const textParts = [];

  // 1. Scan for uncompressed text commands
  const tjRegex = /\(([\s\S]*?)\)\s*Tj/g;
  let m;
  while ((m = tjRegex.exec(latin1)) !== null) {
    const s = m[1].replace(/\\([()\\])/g, "$1").trim();
    if (s) textParts.push(s);
  }
  const tjArrRegex = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = tjArrRegex.exec(latin1)) !== null) {
    const inner = m[1];
    const subRegex = /\(([\s\S]*?)\)/g;
    let sm;
    let combined = "";
    while ((sm = subRegex.exec(inner)) !== null) {
      combined += sm[1].replace(/\\([()\\])/g, "$1");
    }
    if (combined.trim()) textParts.push(combined.trim());
  }

  // 2. Scan for FlateDecode streams and decompress
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let sm;
  while ((sm = streamRegex.exec(latin1)) !== null) {
    const startIdx = sm.index + (sm[0].startsWith("stream\r\n") ? 8 : 7);
    const endIdx = startIdx + sm[1].length;
    const streamBytes = bytes.slice(startIdx, endIdx);
    try {
      // PDF FlateDecode streams are zlib-wrapped ("deflate"), not raw deflate
      let decompressed;
      try {
        decompressed = await decompressZlib(streamBytes);
      } catch (_zErr) {
        decompressed = await decompressRaw(streamBytes);
      }
      const decStr = new TextDecoder("utf-8", { fatal: false }).decode(decompressed);
      let tm;
      const decTj = /\(([\s\S]*?)\)\s*Tj/g;
      while ((tm = decTj.exec(decStr)) !== null) {
        const s = tm[1].replace(/\\([()\\])/g, "$1").trim();
        if (s) textParts.push(s);
      }
      const decTjArr = /\[([\s\S]*?)\]\s*TJ/g;
      while ((tm = decTjArr.exec(decStr)) !== null) {
        const sub = tm[1];
        const subR = /\(([\s\S]*?)\)/g;
        let ssm;
        let c = "";
        while ((ssm = subR.exec(sub)) !== null) {
          c += ssm[1].replace(/\\([()\\])/g, "$1");
        }
        if (c.trim()) textParts.push(c.trim());
      }
    } catch (_err) {
      // Not a deflate stream or non-text stream, continue
    }
  }

  const result = textParts.join(" ").replace(/\s{2,}/g, " ").trim();
  if (!result) {
    throw new Error("Could not extract readable text from PDF. Ensure the PDF contains digital text (not a scanned raster image).");
  }
  return result;
}

// ============================================================================
// Case 1: Published-to-web Google Doc (/document/d/e/2PACX-.../pub)
// ============================================================================
const pubMatch = rawInput.match(/docs\.google\.com\/document\/d\/e\/([a-zA-Z0-9_-]+)/i);
if (pubMatch) {
  const pubUrl = "https://docs.google.com/document/d/e/" + pubMatch[1] + "/pub";
  const res = await fetch(pubUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error("Could not fetch published Google Doc (HTTP " + res.status + ").");
  }
  const html = await res.text();
  const text = decodeHtmlEntities(html).slice(0, maxChars);
  if (!text) {
    throw new Error("Published Google Doc returned empty text.");
  }
  return {
    ok: true,
    docId: pubMatch[1],
    fileType: "gdoc_pub",
    sourceUrl: pubUrl,
    charCount: text.length,
    content: text
  };
}

// ============================================================================
// Case 2: Google Docs / Drive File / Bare ID / Direct Link
// ============================================================================
let fileId = "";
let isDocUrl = false;
let isDriveUrl = false;

const docPathMatch = rawInput.match(/\/document\/d\/([a-zA-Z0-9_-]{15,})/);
const filePathMatch = rawInput.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/);
const bareIdMatch = rawInput.match(/^[a-zA-Z0-9_-]{20,}$/);

if (docPathMatch) {
  fileId = docPathMatch[1];
  isDocUrl = true;
} else if (filePathMatch) {
  fileId = filePathMatch[1];
  isDriveUrl = true;
} else if (bareIdMatch) {
  fileId = bareIdMatch[0];
} else {
  try {
    const parsed = new URL(rawInput);
    const qId = parsed.searchParams.get("id");
    if (qId && /^[a-zA-Z0-9_-]{15,}$/.test(qId)) {
      fileId = qId;
      isDriveUrl = parsed.hostname.includes("drive.google.com");
      isDocUrl = parsed.hostname.includes("docs.google.com");
    }
  } catch (_e) {}
}

// ----------------------------------------------------------------------------
// 2A: If recognized as Google Doc, try standard Google Docs export first
// ----------------------------------------------------------------------------
if (fileId && (isDocUrl || !isDriveUrl)) {
  const exportUrl = "https://docs.google.com/document/d/" + encodeURIComponent(fileId) + "/export?format=txt";
  try {
    const response = await fetch(exportUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/plain, text/*;q=0.9, */*;q=0.5" }
    });
    const cType = (response.headers.get("content-type") || "").toLowerCase();
    const finalUrl = response.url || exportUrl;

    if (
      response.ok &&
      !finalUrl.includes("accounts.google.com") &&
      !cType.includes("text/html")
    ) {
      const rawText = (await response.text()).replace(/^\uFEFF/, "").trim();
      if (rawText) {
        const truncated = rawText.length > maxChars;
        const clean = rawText.slice(0, maxChars);
        return {
          ok: true,
          docId: fileId,
          fileType: "gdoc",
          sourceUrl: "https://docs.google.com/document/d/" + fileId + "/edit",
          charCount: clean.length,
          truncated,
          content: clean
        };
      }
    }
  } catch (_err) {
    // Fall through to Drive download
  }
}

// ----------------------------------------------------------------------------
// 2B: Google Drive File Download (PDF, DOCX, TXT, or generic Drive file)
// ----------------------------------------------------------------------------
let downloadUrl = "";
let sourceUrl = rawInput;

if (fileId) {
  sourceUrl = "https://drive.google.com/file/d/" + fileId + "/view";
  downloadUrl = "https://drive.usercontent.google.com/download?id=" + encodeURIComponent(fileId) + "&export=download&confirm=t";
} else if (/^https?:\/\//i.test(rawInput)) {
  downloadUrl = rawInput;
} else {
  throw new Error("Unrecognized document or Google Drive file URL format.");
}

let response = await fetch(downloadUrl, {
  method: "GET",
  redirect: "follow",
  headers: { Accept: "*/*" }
});

// Fallback to drive.google.com/uc if drive.usercontent fails
if (!response.ok && fileId) {
  downloadUrl = "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(fileId) + "&confirm=t";
  response = await fetch(downloadUrl, {
    method: "GET",
    redirect: "follow",
    headers: { Accept: "*/*" }
  });
}

const finalUrl = response.url || downloadUrl;
const contentType = (response.headers.get("content-type") || "").toLowerCase();

if (
  response.status === 401 ||
  response.status === 403 ||
  finalUrl.includes("accounts.google.com")
) {
  throw new Error(
    "The document or Google Drive file is restricted/private. Please set Google Drive/Docs Share access to 'Anyone with the link -> Viewer' (ნებისმიერი მომხმარებელი, ვისაც აქვს ბმული -> მნახველი)."
  );
}

if (!response.ok) {
  throw new Error(
    "Failed to download file from Google Drive (HTTP " + response.status + "). Check that the link is valid and publicly shared."
  );
}

const buffer = await response.arrayBuffer();
const bytes = new Uint8Array(buffer);

// Check if response is a virus warning confirmation HTML page
if (contentType.includes("text/html")) {
  const html = new TextDecoder("utf-8").decode(bytes);
  const confirmMatch = html.match(/href="([^"]*(?:confirm=[0-9a-zA-Z_-]+|drive\.usercontent\.google\.com)[^"]*)"/i);
  if (confirmMatch) {
    let nextUrl = confirmMatch[1].replace(/&amp;/g, "&");
    if (nextUrl.startsWith("/")) {
      nextUrl = "https://drive.google.com" + nextUrl;
    }
    const followRes = await fetch(nextUrl, { redirect: "follow" });
    if (followRes.ok) {
      const fBuf = await followRes.arrayBuffer();
      return processFileBytes(fBuf, followRes.headers.get("content-type") || "", sourceUrl, fileId);
    }
  }
}

return await processFileBytes(buffer, contentType, sourceUrl, fileId);

async function processFileBytes(buf, cType, srcUrl, fId) {
  const b = new Uint8Array(buf);
  const head = String.fromCharCode(...b.slice(0, 8));
  let detectedType = "txt";

  if (head.startsWith("%PDF-") || cType.includes("pdf") || /\.pdf($|\?)/i.test(srcUrl)) {
    detectedType = "pdf";
  } else if (
    (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) ||
    cType.includes("openxmlformats") ||
    cType.includes("wordprocessingml") ||
    /\.docx($|\?)/i.test(srcUrl)
  ) {
    detectedType = "docx";
  } else if (cType.includes("text/plain") || /\.txt($|\?)/i.test(srcUrl)) {
    detectedType = "txt";
  }

  let extractedText = "";

  if (detectedType === "pdf") {
    extractedText = await extractPdfText(buf);
  } else if (detectedType === "docx") {
    extractedText = await extractDocxText(buf);
  } else {
    extractedText = new TextDecoder("utf-8", { fatal: false }).decode(buf).replace(/^\uFEFF/, "").trim();
  }

  extractedText = extractedText.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (!extractedText) {
    throw new Error("The file (" + detectedType.toUpperCase() + ") appears to be empty or contains no readable text.");
  }

  const truncated = extractedText.length > maxChars;
  const clean = extractedText.slice(0, maxChars);

  return {
    ok: true,
    fileId: fId || "external_file",
    fileType: detectedType,
    sourceUrl: srcUrl,
    charCount: clean.length,
    truncated,
    content: clean
  };
}
