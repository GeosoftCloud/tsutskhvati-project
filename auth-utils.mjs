import crypto from "node:crypto";

export const AUTH_EMAIL_DOMAIN = "teachers.tsutskhvati.app";
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Unambiguous character pools for system-generated one-time passwords
const OTP_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const OTP_LOWER = "abcdefghijkmnopqrstuvwxyz";
const OTP_DIGITS = "23456789";
const OTP_SPECIAL = "!@#$%&*+-=?";
const OTP_ALL = OTP_UPPER + OTP_LOWER + OTP_DIGITS + OTP_SPECIAL;

/**
 * Normalizes a raw username input into canonical lowercase form.
 * Strips `@teachers.tsutskhvati.app` if the user pasted the synthetic auth email.
 */
export function normalizeUsername(raw) {
  let s = String(raw || "").trim().toLowerCase();
  const suffix = `@${AUTH_EMAIL_DOMAIN}`;
  if (s.endsWith(suffix)) {
    s = s.slice(0, -suffix.length);
  }
  return s;
}

export function isValidUsername(username) {
  return typeof username === "string" && USERNAME_REGEX.test(username);
}

export function usernameToAuthEmail(username) {
  const clean = normalizeUsername(username);
  if (!isValidUsername(clean)) return "";
  return `${clean}@${AUTH_EMAIL_DOMAIN}`;
}

export function authEmailToUsername(email) {
  const s = String(email || "").trim().toLowerCase();
  const suffix = `@${AUTH_EMAIL_DOMAIN}`;
  if (!s.endsWith(suffix)) return "";
  const uname = s.slice(0, -suffix.length);
  return isValidUsername(uname) ? uname : "";
}

/**
 * Validates strong password rules:
 * - 8..128 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (non-alphanumeric)
 * - No control characters
 */
export function validateStrongPassword(password) {
  const pwd = typeof password === "string" ? password : "";
  const checks = {
    minLength: pwd.length >= PASSWORD_MIN_LENGTH,
    maxLength: pwd.length <= PASSWORD_MAX_LENGTH,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasDigit: /[0-9]/.test(pwd),
    hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    noControlChars: !/[\x00-\x1F\x7F]/.test(pwd)
  };

  const valid =
    checks.minLength &&
    checks.maxLength &&
    checks.hasUpper &&
    checks.hasLower &&
    checks.hasDigit &&
    checks.hasSpecial &&
    checks.noControlChars;

  return { valid, checks };
}

function randomCharFrom(pool) {
  return pool[crypto.randomInt(0, pool.length)];
}

/**
 * Generates a cryptographically strong one-time password (default 14 chars)
 * guaranteed to satisfy all strong password requirements.
 */
export function generateOneTimePassword(length = 14) {
  const targetLen = Math.max(12, Math.min(64, Number(length) || 14));
  const chars = [
    randomCharFrom(OTP_UPPER),
    randomCharFrom(OTP_UPPER),
    randomCharFrom(OTP_LOWER),
    randomCharFrom(OTP_LOWER),
    randomCharFrom(OTP_DIGITS),
    randomCharFrom(OTP_DIGITS),
    randomCharFrom(OTP_SPECIAL),
    randomCharFrom(OTP_SPECIAL)
  ];

  while (chars.length < targetLen) {
    chars.push(randomCharFrom(OTP_ALL));
  }

  // Cryptographic Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join("");
}

/**
 * Constant-time string equality check using SHA-256 digests so lengths never leak.
 */
export function timingSafeEqualStrings(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}
