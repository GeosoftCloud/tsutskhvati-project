import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  normalizeUsername,
  isValidUsername,
  usernameToAuthEmail,
  authEmailToUsername,
  validateStrongPassword,
  generateOneTimePassword,
  timingSafeEqualStrings
} from "./auth-utils.mjs";
import crypto from "node:crypto";
import {
  extractTextFromBuffer,
  fetchAndExtractFromUrl,
  DocExtractError,
  MAX_FILE_BYTES
} from "./doc-extract.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 8080;
const HOST = "0.0.0.0";
const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "geosoft-agents-customer-whc5sa";
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || "AIzaSyBn1C2_j4WOkIQGtciIk6haHHxKh7i-b-8";

// Initialize Firebase Admin SDK (uses Cloud Run ADC automatically in production,
// or FIREBASE_SERVICE_ACCOUNT_JSON / local gcloud ADC in development)
function initFirebaseAdmin() {
  if (getApps().length > 0) return getApps()[0];
  const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawSa && rawSa.trim()) {
    const parsed = JSON.parse(rawSa);
    return initializeApp({
      credential: cert(parsed),
      projectId: parsed.project_id || PROJECT_ID
    });
  }
  return initializeApp({ projectId: PROJECT_ID });
}

const adminApp = initFirebaseAdmin();
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);

// ============================================================================
// Rate Limiting (Brute-Force Protection for Auth Endpoints)
// ============================================================================

const rateBuckets = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 12;

function checkRateLimit(key, maxAttempts = RATE_MAX_ATTEMPTS) {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets.entries()) {
    if (now > v.resetAt) rateBuckets.delete(k);
  }
}, 5 * 60 * 1000).unref();

// ============================================================================
// HTTP / JSON Helpers
// ============================================================================

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 16384) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error("Payload too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_e) {
        reject(Object.assign(new Error("Invalid JSON payload"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] || 0);
    if (declared > maxBytes) {
      reject(Object.assign(new Error("File is larger than 20 MB."), { statusCode: 413, code: "FILE_TOO_LARGE" }));
      req.resume();
      return;
    }
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error("File is larger than 20 MB."), { statusCode: 413, code: "FILE_TOO_LARGE" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    req.on("error", reject);
  });
}

// Short-lived cache of extracted text for shared links, so a class of students
// scanning the same QR code doesn't re-download the same Drive file 30 times.
const extractCache = new Map();
const EXTRACT_CACHE_TTL_MS = 10 * 60 * 1000;
const EXTRACT_CACHE_MAX = 100;

function getCachedExtract(key) {
  const hit = extractCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    extractCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedExtract(key, value) {
  if (extractCache.size >= EXTRACT_CACHE_MAX) {
    extractCache.delete(extractCache.keys().next().value);
  }
  extractCache.set(key, { value, expiresAt: Date.now() + EXTRACT_CACHE_TTL_MS });
}

function sendDocExtractError(res, err) {
  if (err instanceof DocExtractError) {
    sendJson(res, err.statusCode || 400, { ok: false, error: err.code, message: err.message });
    return true;
  }
  return false;
}

function extractBearerToken(req) {
  const hdr = req.headers.authorization || "";
  if (typeof hdr === "string" && hdr.startsWith("Bearer ")) {
    return hdr.slice(7).trim();
  }
  return "";
}

function isAdcUnavailableError(err) {
  const msg = String((err && err.message) || err || "");
  return (
    msg.includes("Could not load the default credentials") ||
    msg.includes("Unable to detect a Project Id") ||
    msg.includes("invalid_grant") ||
    msg.includes("reauth")
  );
}

function handleServerApiError(res, err) {
  if (err && err.statusCode) {
    sendJson(res, err.statusCode, { ok: false, error: err.code || "BAD_REQUEST", message: err.message });
    return;
  }
  if (isAdcUnavailableError(err)) {
    sendJson(res, 503, {
      ok: false,
      error: "ADMIN_CREDENTIALS_UNAVAILABLE",
      message:
        "Firebase Admin credentials are not active in this local environment. Run `gcloud auth application-default login` locally or use the deployed Cloud Run service."
    });
    return;
  }
  console.error("[SnowDay API Error]", err);
  sendJson(res, 500, {
    ok: false,
    error: "INTERNAL_ERROR",
    message: (err && err.message) || "Unexpected server error"
  });
}

/**
 * Verifies a user's current password via Firebase Identity Toolkit REST API
 * (or local Auth Emulator if FIREBASE_AUTH_EMULATOR_HOST is configured).
 */
async function verifyCurrentPassword(authEmail, currentPassword) {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const endpoint = emulatorHost
    ? `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`
    : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: authEmail,
      password: currentPassword,
      returnSecureToken: false
    })
  });

  return resp.ok;
}

/**
 * Ensures a Firebase Auth user exists with the given synthetic email & password.
 */
async function upsertFirebaseAuthUser({ username, password, displayName }) {
  const authEmail = usernameToAuthEmail(username);
  let existingUser = null;
  try {
    existingUser = await adminAuth.getUserByEmail(authEmail);
  } catch (err) {
    if (!err || err.code !== "auth/user-not-found") {
      throw err;
    }
  }

  if (existingUser) {
    const updatePayload = { password };
    if (displayName) updatePayload.displayName = displayName.slice(0, 120);
    return adminAuth.updateUser(existingUser.uid, updatePayload);
  }

  // Also check if UID `username` is already taken
  try {
    const byUid = await adminAuth.getUser(username);
    return adminAuth.updateUser(byUid.uid, {
      email: authEmail,
      password,
      displayName: (displayName || username).slice(0, 120)
    });
  } catch (err) {
    if (err && err.code !== "auth/user-not-found") {
      throw err;
    }
  }

  return adminAuth.createUser({
    uid: username,
    email: authEmail,
    password,
    displayName: (displayName || username).slice(0, 120)
  });
}

/**
 * Authenticates the caller via Firebase ID token and loads their `/teachers/{username}` record.
 */
async function authenticateCaller(req, { requireSuperAdmin = false, allowMustChangePassword = false } = {}) {
  const token = extractBearerToken(req);
  if (!token) {
    throw Object.assign(new Error("Missing authentication token"), {
      statusCode: 401,
      code: "UNAUTHENTICATED"
    });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch (_e) {
    throw Object.assign(new Error("Invalid or expired authentication token"), {
      statusCode: 401,
      code: "INVALID_TOKEN"
    });
  }

  const username = authEmailToUsername(decoded.email || "");
  if (!username) {
    throw Object.assign(new Error("Invalid username identity"), {
      statusCode: 403,
      code: "INVALID_IDENTITY"
    });
  }

  const teacherRef = adminDb.collection("teachers").doc(username);
  const snap = await teacherRef.get();
  if (!snap.exists) {
    throw Object.assign(new Error("Account is not registered in the teachers directory"), {
      statusCode: 403,
      code: "NOT_AUTHORIZED"
    });
  }

  const data = snap.data() || {};
  const mustChangePassword = Boolean(data.mustChangePassword);

  if (!allowMustChangePassword && mustChangePassword) {
    throw Object.assign(new Error("Password change is required before performing this action"), {
      statusCode: 403,
      code: "MUST_CHANGE_PASSWORD"
    });
  }

  if (requireSuperAdmin && data.role !== "super_admin") {
    throw Object.assign(new Error("Super Admin privileges are required"), {
      statusCode: 403,
      code: "FORBIDDEN"
    });
  }

  return {
    uid: decoded.uid,
    username,
    teacherRef,
    teacherData: data
  };
}

// ============================================================================
// Optional Env Var Super Admin Bootstrap (`SUPER_ADMIN_USERNAME` + `SUPER_ADMIN_PASSWORD`)
// ============================================================================

async function bootstrapSuperAdminFromEnv() {
  const rawUser = process.env.SUPER_ADMIN_USERNAME;
  const rawPass = process.env.SUPER_ADMIN_PASSWORD;
  if (!rawUser || !rawPass) return;

  const username = normalizeUsername(rawUser);
  if (!isValidUsername(username)) {
    console.error(
      "[Bootstrap] SUPER_ADMIN_USERNAME is invalid. Must match ^[a-z0-9][a-z0-9._-]{2,31}$."
    );
    return;
  }

  const pwdCheck = validateStrongPassword(rawPass);
  if (!pwdCheck.valid) {
    console.error(
      "[Bootstrap] SUPER_ADMIN_PASSWORD does not meet strong password requirements (8+ chars, upper, lower, number, special)."
    );
    return;
  }

  try {
    const note = String(process.env.SUPER_ADMIN_NOTE || "Main Super Admin").trim().slice(0, 160);
    await upsertFirebaseAuthUser({ username, password: rawPass, displayName: note });
    const ref = adminDb.collection("teachers").doc(username);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.update({
        username,
        role: "super_admin",
        mustChangePassword: false,
        initialPassword: FieldValue.delete()
      });
    } else {
      await ref.set({
        username,
        role: "super_admin",
        mustChangePassword: false,
        note,
        displayName: note.slice(0, 120),
        addedBy: "system",
        addedAt: FieldValue.serverTimestamp()
      });
    }
    console.log(`[Bootstrap] Super Admin '${username}' verified and ready.`);
  } catch (err) {
    console.warn(`[Bootstrap] Could not run env Super Admin bootstrap: ${err.message}`);
  }
}

// ============================================================================
// API Route Handler
// ============================================================================

async function handleApiRequest(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }

  const clientIp = getClientIp(req);

  // 1. POST /api/auth/bootstrap-login
  // Supports manual Firestore Console creation where a system admin creates `/teachers/<username>`
  // with `{ role: "super_admin", initialPassword: "..." }`. On first login, provisions Firebase Auth
  // and permanently deletes `initialPassword` from Firestore.
  if (req.method === "POST" && pathname === "/api/auth/bootstrap-login") {
    const body = await readJsonBody(req);
    const username = normalizeUsername(body.username);
    const password = typeof body.password === "string" ? body.password : "";

    if (!checkRateLimit(`bootstrap:${clientIp}:${username}`)) {
      sendJson(res, 429, {
        ok: false,
        error: "TOO_MANY_ATTEMPTS",
        message: "Too many sign-in attempts. Please wait a few minutes and try again."
      });
      return;
    }

    if (!isValidUsername(username) || !password) {
      sendJson(res, 401, { ok: false, error: "INVALID_CREDENTIALS" });
      return;
    }

    const ref = adminDb.collection("teachers").doc(username);
    const snap = await ref.get();
    if (!snap.exists) {
      sendJson(res, 401, { ok: false, error: "INVALID_CREDENTIALS" });
      return;
    }

    const data = snap.data() || {};
    if (
      typeof data.initialPassword !== "string" ||
      !data.initialPassword ||
      !timingSafeEqualStrings(data.initialPassword, password)
    ) {
      sendJson(res, 401, { ok: false, error: "INVALID_CREDENTIALS" });
      return;
    }

    const role = data.role === "super_admin" ? "super_admin" : "teacher";
    const note = String(data.note || (role === "super_admin" ? "Main Super Admin" : "")).slice(0, 160);
    const displayName = String(data.displayName || note || username).slice(0, 120);

    await upsertFirebaseAuthUser({ username, password, displayName });
    await ref.set(
      {
        username,
        role,
        mustChangePassword:
          typeof data.mustChangePassword === "boolean"
            ? data.mustChangePassword
            : role !== "super_admin",
        note,
        displayName,
        addedBy: String(data.addedBy || "system").slice(0, 64),
        addedAt: data.addedAt || FieldValue.serverTimestamp(),
        initialPassword: FieldValue.delete()
      },
      { merge: true }
    );

    sendJson(res, 200, { ok: true, bootstrapped: true });
    return;
  }

  // 2. POST /api/auth/checkin
  // Normalizes any manually created Firestore record and updates lastLoginAt when active.
  if (req.method === "POST" && pathname === "/api/auth/checkin") {
    const { username, teacherRef, teacherData } = await authenticateCaller(req, {
      allowMustChangePassword: true
    });

    const role = teacherData.role === "super_admin" ? "super_admin" : "teacher";
    const mustChangePassword = Boolean(teacherData.mustChangePassword);
    const updates = {
      username,
      role,
      mustChangePassword
    };

    if (!teacherData.addedBy) updates.addedBy = "system";
    if (!teacherData.addedAt) updates.addedAt = FieldValue.serverTimestamp();
    if ("initialPassword" in teacherData) updates.initialPassword = FieldValue.delete();
    if (!mustChangePassword) {
      updates.lastLoginAt = FieldValue.serverTimestamp();
    }

    await teacherRef.set(updates, { merge: true });

    sendJson(res, 200, {
      ok: true,
      teacher: {
        username,
        role,
        mustChangePassword,
        note: String(teacherData.note || ""),
        displayName: String(teacherData.displayName || "")
      }
    });
    return;
  }

  // 3. POST /api/auth/change-password
  // Enforces strong password complexity, verifies current password, prevents reusing the
  // 1-time/old password, updates Firebase Auth, and clears `mustChangePassword: false`.
  if (req.method === "POST" && pathname === "/api/auth/change-password") {
    const { uid, username, teacherRef } = await authenticateCaller(req, {
      allowMustChangePassword: true
    });

    if (!checkRateLimit(`chgpass:${clientIp}:${username}`)) {
      sendJson(res, 429, {
        ok: false,
        error: "TOO_MANY_ATTEMPTS",
        message: "Too many password change attempts. Please wait and try again."
      });
      return;
    }

    const body = await readJsonBody(req);
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword) {
      sendJson(res, 400, {
        ok: false,
        error: "MISSING_CURRENT_PASSWORD",
        message: "Current password is required."
      });
      return;
    }

    const strength = validateStrongPassword(newPassword);
    if (!strength.valid) {
      sendJson(res, 400, {
        ok: false,
        error: "WEAK_PASSWORD",
        checks: strength.checks,
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      });
      return;
    }

    if (timingSafeEqualStrings(currentPassword, newPassword)) {
      sendJson(res, 400, {
        ok: false,
        error: "SAME_PASSWORD",
        message: "New password must be different from your current / one-time password."
      });
      return;
    }

    const authEmail = usernameToAuthEmail(username);
    const currentOk = await verifyCurrentPassword(authEmail, currentPassword);
    if (!currentOk) {
      sendJson(res, 401, {
        ok: false,
        error: "WRONG_CURRENT_PASSWORD",
        message: "Current password is incorrect."
      });
      return;
    }

    await adminAuth.updateUser(uid, { password: newPassword });
    await teacherRef.set(
      {
        mustChangePassword: false,
        passwordChangedAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
        initialPassword: FieldValue.delete()
      },
      { merge: true }
    );

    sendJson(res, 200, { ok: true, username });
    return;
  }

  // 4. POST /api/admin/teachers
  // Super Admin creates a new teacher with an automatically generated strong 1-time password.
  if (req.method === "POST" && pathname === "/api/admin/teachers") {
    const { username: callerUsername } = await authenticateCaller(req, {
      requireSuperAdmin: true,
      allowMustChangePassword: false
    });

    const body = await readJsonBody(req);
    const targetUsername = normalizeUsername(body.username);
    const noteClean = String(body.note || "").trim().slice(0, 160);

    if (!isValidUsername(targetUsername)) {
      sendJson(res, 400, {
        ok: false,
        error: "INVALID_USERNAME",
        message:
          "Invalid username. Use 3–32 lowercase letters, numbers, dots (.), hyphens (-), or underscores (_)."
      });
      return;
    }

    const targetRef = adminDb.collection("teachers").doc(targetUsername);
    const existingSnap = await targetRef.get();
    if (existingSnap.exists) {
      sendJson(res, 409, {
        ok: false,
        error: "USERNAME_EXISTS",
        message: `Username '${targetUsername}' already exists.`
      });
      return;
    }

    const oneTimePassword = generateOneTimePassword(14);
    const displayName = (noteClean || targetUsername).slice(0, 120);

    await upsertFirebaseAuthUser({
      username: targetUsername,
      password: oneTimePassword,
      displayName
    });

    await targetRef.set({
      username: targetUsername,
      role: "teacher",
      mustChangePassword: true,
      note: noteClean,
      displayName,
      addedBy: callerUsername,
      addedAt: FieldValue.serverTimestamp(),
      passwordResetAt: FieldValue.serverTimestamp(),
      passwordResetBy: callerUsername
    });

    sendJson(res, 201, {
      ok: true,
      username: targetUsername,
      oneTimePassword,
      note: noteClean
    });
    return;
  }

  // 5. POST /api/admin/teachers/:username/reset-password
  // Super Admin resets a teacher's password to a newly generated strong 1-time password.
  const resetMatch = pathname.match(/^\/api\/admin\/teachers\/([^/]+)\/reset-password$/);
  if (req.method === "POST" && resetMatch) {
    const { username: callerUsername } = await authenticateCaller(req, {
      requireSuperAdmin: true,
      allowMustChangePassword: false
    });

    const targetUsername = normalizeUsername(decodeURIComponent(resetMatch[1]));
    if (!isValidUsername(targetUsername)) {
      sendJson(res, 400, { ok: false, error: "INVALID_USERNAME" });
      return;
    }

    const targetRef = adminDb.collection("teachers").doc(targetUsername);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      sendJson(res, 404, {
        ok: false,
        error: "TEACHER_NOT_FOUND",
        message: `Teacher '${targetUsername}' was not found.`
      });
      return;
    }

    const targetData = targetSnap.data() || {};
    if (targetData.role === "super_admin") {
      sendJson(res, 403, {
        ok: false,
        error: "CANNOT_RESET_SUPER_ADMIN",
        message: "Super Admin passwords cannot be reset from the teacher table."
      });
      return;
    }

    const oneTimePassword = generateOneTimePassword(14);
    const authUser = await upsertFirebaseAuthUser({
      username: targetUsername,
      password: oneTimePassword,
      displayName: String(targetData.displayName || targetData.note || targetUsername)
    });

    try {
      await adminAuth.revokeRefreshTokens(authUser.uid);
    } catch (_e) {}

    await targetRef.set(
      {
        mustChangePassword: true,
        passwordResetAt: FieldValue.serverTimestamp(),
        passwordResetBy: callerUsername,
        initialPassword: FieldValue.delete()
      },
      { merge: true }
    );

    sendJson(res, 200, {
      ok: true,
      username: targetUsername,
      oneTimePassword
    });
    return;
  }

  // 6. DELETE /api/admin/teachers/:username
  // Super Admin deletes a teacher from both Firebase Auth and Firestore.
  const deleteMatch = pathname.match(/^\/api\/admin\/teachers\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const { username: callerUsername } = await authenticateCaller(req, {
      requireSuperAdmin: true,
      allowMustChangePassword: false
    });

    const targetUsername = normalizeUsername(decodeURIComponent(deleteMatch[1]));
    if (!isValidUsername(targetUsername)) {
      sendJson(res, 400, { ok: false, error: "INVALID_USERNAME" });
      return;
    }

    if (targetUsername === callerUsername) {
      sendJson(res, 403, {
        ok: false,
        error: "CANNOT_DELETE_SELF",
        message: "You cannot delete your own Super Admin account."
      });
      return;
    }

    const targetRef = adminDb.collection("teachers").doc(targetUsername);
    const targetSnap = await targetRef.get();
    if (targetSnap.exists && (targetSnap.data() || {}).role === "super_admin") {
      sendJson(res, 403, {
        ok: false,
        error: "CANNOT_DELETE_SUPER_ADMIN",
        message: "Super Admin accounts are protected from deletion."
      });
      return;
    }

    const authEmail = usernameToAuthEmail(targetUsername);
    try {
      const u = await adminAuth.getUserByEmail(authEmail);
      await adminAuth.deleteUser(u.uid);
    } catch (err) {
      if (!err || err.code !== "auth/user-not-found") {
        throw err;
      }
    }

    // Delete saved lesson docs subcollection if any exist
    const docsSnap = await targetRef.collection("docs").get();
    if (!docsSnap.empty) {
      const batch = adminDb.batch();
      docsSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(targetRef);
      await batch.commit();
    } else {
      await targetRef.delete();
    }

    sendJson(res, 200, { ok: true, username: targetUsername });
    return;
  }

  // 7. POST /api/docs/extract  { url }
  // Public: downloads a shared Google Doc / Drive file (PDF, DOCX, TXT) or direct file link
  // server-side (no browser CORS limits) and returns its plain text.
  if (req.method === "POST" && pathname === "/api/docs/extract") {
    if (!checkRateLimit(`extract:${clientIp}`, 60)) {
      sendJson(res, 429, {
        ok: false,
        error: "TOO_MANY_REQUESTS",
        message: "Too many document requests. Please wait a few minutes and try again."
      });
      return;
    }
    const body = await readJsonBody(req, 4096);
    const url = typeof body.url === "string" ? body.url.trim().slice(0, 2048) : "";
    if (!url) {
      sendJson(res, 400, { ok: false, error: "INVALID_URL", message: "Missing document URL." });
      return;
    }
    const cached = getCachedExtract(url);
    if (cached) {
      sendJson(res, 200, { ok: true, cached: true, ...cached });
      return;
    }
    try {
      const result = await fetchAndExtractFromUrl(url);
      setCachedExtract(url, result);
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      if (!sendDocExtractError(res, err)) throw err;
    }
    return;
  }

  // 8. POST /api/docs/upload  (raw file body; headers: Authorization, X-File-Name)
  // Signed-in teachers upload a PDF / DOCX / TXT. Text is extracted server-side and stored in
  // Firestore `/uploadedDocs/{id}` so students on any device can open the lesson via link/QR.
  if (req.method === "POST" && pathname === "/api/docs/upload") {
    const { username } = await authenticateCaller(req);
    if (!checkRateLimit(`upload:${username}`, 40)) {
      sendJson(res, 429, {
        ok: false,
        error: "TOO_MANY_REQUESTS",
        message: "Too many uploads. Please wait a few minutes and try again."
      });
      return;
    }
    let fileName = "lesson";
    try {
      fileName = decodeURIComponent(String(req.headers["x-file-name"] || "lesson"));
    } catch (_e) {}
    fileName = fileName.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200) || "lesson";

    const bytes = await readRawBody(req, MAX_FILE_BYTES);
    let result;
    try {
      result = await extractTextFromBuffer(bytes, {
        fileName,
        contentType: String(req.headers["content-type"] || "")
      });
    } catch (err) {
      if (!sendDocExtractError(res, err)) throw err;
      return;
    }

    const id = crypto.randomBytes(18).toString("base64url");
    await adminDb.collection("uploadedDocs").doc(id).set({
      name: fileName,
      format: result.format,
      text: result.text,
      charCount: result.charCount,
      truncated: result.truncated,
      sizeBytes: bytes.length,
      ownerUsername: username,
      createdAt: FieldValue.serverTimestamp()
    });

    sendJson(res, 201, {
      ok: true,
      id,
      path: `/api/docs/uploads/${id}`,
      name: fileName,
      format: result.format,
      charCount: result.charCount,
      truncated: result.truncated,
      text: result.text
    });
    return;
  }

  // 9. GET /api/docs/uploads/:id
  // Public read of an uploaded lesson's extracted text (IDs are unguessable random tokens).
  const uploadMatch = pathname.match(/^\/api\/docs\/uploads\/([A-Za-z0-9_-]{16,64})$/);
  if (req.method === "GET" && uploadMatch) {
    const snap = await adminDb.collection("uploadedDocs").doc(uploadMatch[1]).get();
    if (!snap.exists) {
      sendJson(res, 404, { ok: false, error: "NOT_FOUND", message: "Uploaded lesson file not found." });
      return;
    }
    const d = snap.data() || {};
    res.setHeader("Access-Control-Allow-Origin", "*");
    sendJson(res, 200, {
      ok: true,
      id: uploadMatch[1],
      name: String(d.name || ""),
      format: String(d.format || "txt"),
      charCount: Number(d.charCount) || 0,
      truncated: Boolean(d.truncated),
      text: String(d.text || "")
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "NOT_FOUND", message: "API endpoint not found" });
}

// ============================================================================
// Static Web Server + API Router
// ============================================================================

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xml": "application/xml"
};

// Block direct HTTP access to server-side / config / backup files
const BLOCKED_EXACT_FILES = new Set([
  "/server.js",
  "/auth-utils.mjs",
  "/doc-extract.mjs",
  "/package.json",
  "/package-lock.json",
  "/Dockerfile",
  "/firebase.json",
  "/firestore.rules",
  "/firestore.indexes.json",
  "/backup-tsutskhvati-teacher-auth.json"
]);

function isBlockedStaticPath(reqPath) {
  const lower = reqPath.toLowerCase();
  if (BLOCKED_EXACT_FILES.has(reqPath)) return true;
  if (lower.startsWith("/.") || lower.startsWith("/scripts/") || lower.startsWith("/node_modules/")) {
    return true;
  }
  if (lower.startsWith("/backup-")) return true;
  return false;
}

const server = http.createServer(async (req, res) => {
  // Cloud Run Health Check
  if (req.url === "/health" || req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  // Parse path without query string
  let reqPath = "/";
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    reqPath = decodeURIComponent(parsedUrl.pathname);
  } catch (_e) {
    reqPath = req.url.split("?")[0];
  }

  // Handle Backend Auth & Admin API routes
  if (reqPath === "/api" || reqPath.startsWith("/api/")) {
    try {
      await handleApiRequest(req, res, reqPath);
    } catch (err) {
      handleServerApiError(res, err);
    }
    return;
  }

  if (isBlockedStaticPath(reqPath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  // Security: prevent path traversal
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(__dirname, safePath);

  // Default to index.html for root or directories
  if (reqPath === "/" || reqPath === "") {
    filePath = path.join(__dirname, "index.html");
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If direct file not found, fall back to index.html (SPA routing support)
      filePath = path.join(__dirname, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const headers = {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*"
    };

    // Keep HTML and JS fresh on redeploy; cache static fonts/images
    if (ext === ".html" || ext === ".js" || ext === ".css") {
      headers["Cache-Control"] = "no-cache, must-revalidate";
    } else {
      headers["Cache-Control"] = "public, max-age=3600";
    }

    const stream = fs.createReadStream(filePath);
    stream.on("open", () => {
      res.writeHead(200, headers);
      stream.pipe(res);
    });

    stream.on("error", (streamErr) => {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server Error: " + streamErr.message);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`SnowDay Class web & auth server running on http://${HOST}:${PORT}`);
  bootstrapSuperAdminFromEnv();
});
