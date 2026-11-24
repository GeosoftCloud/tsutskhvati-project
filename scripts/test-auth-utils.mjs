import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTH_EMAIL_DOMAIN,
  normalizeUsername,
  isValidUsername,
  usernameToAuthEmail,
  authEmailToUsername,
  validateStrongPassword,
  generateOneTimePassword,
  timingSafeEqualStrings
} from "../auth-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// 1. Username normalization & validation tests
assert.equal(normalizeUsername("  Nino.Beridze  "), "nino.beridze");
assert.equal(normalizeUsername("admin@teachers.tsutskhvati.app"), "admin");
assert.equal(isValidUsername("admin"), true);
assert.equal(isValidUsername("nino.beridze_01"), true);
assert.equal(isValidUsername("ab"), false, "Too short (<3)");
assert.equal(isValidUsername(".leadingdot"), false, "Must start with alphanumeric");
assert.equal(isValidUsername("bad space"), false, "Spaces not allowed");
assert.equal(isValidUsername("user@gmail.com"), false, "External email symbols not allowed");

assert.equal(usernameToAuthEmail("Nino.Beridze"), `nino.beridze@${AUTH_EMAIL_DOMAIN}`);
assert.equal(authEmailToUsername(`nino.beridze@${AUTH_EMAIL_DOMAIN}`), "nino.beridze");
assert.equal(authEmailToUsername("someone@gmail.com"), "");

// 2. Strong password validation tests
assert.equal(validateStrongPassword("Short1!").valid, false, "Reject <8 chars");
assert.equal(validateStrongPassword("alllowercase1!").valid, false, "Reject missing uppercase");
assert.equal(validateStrongPassword("ALLUPPERCASE1!").valid, false, "Reject missing lowercase");
assert.equal(validateStrongPassword("NoNumbersHere!").valid, false, "Reject missing digit");
assert.equal(validateStrongPassword("NoSpecialChar12").valid, false, "Reject missing special");
assert.equal(validateStrongPassword("ValidStr0ng!Pass").valid, true, "Accept strong password");

// 3. One-time password generator tests (200 iterations)
const seen = new Set();
for (let i = 0; i < 200; i++) {
  const otp = generateOneTimePassword(14);
  assert.equal(otp.length, 14);
  assert.equal(validateStrongPassword(otp).valid, true, `Generated OTP failed strength: ${otp}`);
  assert.equal(/[0O1lI]/.test(otp), false, `Generated OTP contained ambiguous char: ${otp}`);
  seen.add(otp);
}
assert.equal(seen.size, 200, "Generated OTPs should be cryptographically unique");

// 4. Timing-safe string equality tests
assert.equal(timingSafeEqualStrings("Str0ng!Pass", "Str0ng!Pass"), true);
assert.equal(timingSafeEqualStrings("Str0ng!Pass", "Str0ng!PasX"), false);
assert.equal(timingSafeEqualStrings("Str0ng!Pass", "Short"), false);

// 5. Verify Google OAuth has been completely removed from auth files
const teacherAuthSrc = fs.readFileSync(path.join(rootDir, "teacher-auth.js"), "utf8");
assert.equal(teacherAuthSrc.includes("GoogleAuthProvider"), false, "GoogleAuthProvider must be removed");
assert.equal(teacherAuthSrc.includes("signInWithPopup"), false, "signInWithPopup must be removed");
assert.equal(teacherAuthSrc.includes("signInWithRedirect"), false, "signInWithRedirect must be removed");

const firebaseJson = JSON.parse(fs.readFileSync(path.join(rootDir, "firebase.json"), "utf8"));
assert.equal(Boolean(firebaseJson.auth?.providers?.googleSignIn), false, "googleSignIn must be removed");
assert.equal(firebaseJson.auth?.providers?.emailPassword, true, "emailPassword must be enabled");

console.log("✓ All username/password, strong-password, OTP generator, and Google-Auth-removal checks passed!");
