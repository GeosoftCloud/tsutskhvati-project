#!/usr/bin/env node
/**
 * Manual System Bootstrap CLI for creating or updating the initial Super Admin account.
 *
 * Usage:
 *   npm run create-super-admin -- <username> [password] [displayName]
 *
 * Examples:
 *   npm run create-super-admin -- admin
 *   npm run create-super-admin -- admin "MyStr0ng!Pass2026" "Main Super Admin"
 *
 * Works with BOTH Application Default Credentials (`firebase-admin`) AND active `gcloud auth login`.
 */
import { execSync } from "node:child_process";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  normalizeUsername,
  isValidUsername,
  usernameToAuthEmail,
  validateStrongPassword,
  generateOneTimePassword
} from "../auth-utils.mjs";

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "geosoft-agents-customer-whc5sa";

function printUsageAndExit(code = 1) {
  console.error(
    "Usage: npm run create-super-admin -- <username> [strongPassword] [fullNameOrNote]\n" +
      "Example: npm run create-super-admin -- admin"
  );
  process.exit(code);
}

async function provisionViaFirebaseAdmin({ username, authEmail, password, note }) {
  if (getApps().length === 0) {
    const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawSa && rawSa.trim()) {
      const parsed = JSON.parse(rawSa);
      initializeApp({ credential: cert(parsed), projectId: parsed.project_id || PROJECT_ID });
    } else {
      initializeApp({ projectId: PROJECT_ID });
    }
  }

  const adminAuth = getAuth();
  const adminDb = getFirestore();

  let userRecord = null;
  try {
    userRecord = await adminAuth.getUserByEmail(authEmail);
    await adminAuth.updateUser(userRecord.uid, {
      password,
      displayName: note.slice(0, 120)
    });
  } catch (err) {
    if (err && err.code === "auth/user-not-found") {
      userRecord = await adminAuth.createUser({
        uid: username,
        email: authEmail,
        password,
        displayName: note.slice(0, 120)
      });
    } else {
      throw err;
    }
  }

  const teacherRef = adminDb.collection("teachers").doc(username);
  await teacherRef.set(
    {
      username,
      role: "super_admin",
      mustChangePassword: false,
      note,
      displayName: note.slice(0, 120),
      addedBy: "system",
      addedAt: FieldValue.serverTimestamp(),
      initialPassword: FieldValue.delete()
    },
    { merge: true }
  );

  return userRecord.uid;
}

async function provisionViaGcloudToken({ username, authEmail, password, note }) {
  const token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
  if (!token) {
    throw new Error("Could not obtain access token from `gcloud auth print-access-token`.");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "x-goog-user-project": PROJECT_ID,
    "Content-Type": "application/json"
  };

  // 1. Lookup existing Firebase Auth user by email
  const lookupResp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ email: [authEmail] })
    }
  );
  const lookupJson = await lookupResp.json();
  if (!lookupResp.ok) {
    throw new Error(lookupJson.error?.message || `Auth lookup failed (${lookupResp.status})`);
  }

  let uid = username;
  if (Array.isArray(lookupJson.users) && lookupJson.users.length > 0) {
    uid = lookupJson.users[0].localId;
    const updResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          localId: uid,
          password,
          displayName: note.slice(0, 120)
        })
      }
    );
    const updJson = await updResp.json();
    if (!updResp.ok) {
      throw new Error(updJson.error?.message || `Auth update failed (${updResp.status})`);
    }
  } else {
    const createResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          localId: username,
          email: authEmail,
          password,
          displayName: note.slice(0, 120),
          emailVerified: true
        })
      }
    );
    const createJson = await createResp.json();
    if (!createResp.ok) {
      throw new Error(createJson.error?.message || `Auth create failed (${createResp.status})`);
    }
    uid = createJson.localId || username;
  }

  // 2. Upsert `/teachers/{username}` in Firestore
  const nowIso = new Date().toISOString();
  const docUrl =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/teachers/${encodeURIComponent(username)}` +
    `?updateMask.fieldPaths=username&updateMask.fieldPaths=role&updateMask.fieldPaths=mustChangePassword` +
    `&updateMask.fieldPaths=note&updateMask.fieldPaths=displayName&updateMask.fieldPaths=addedBy&updateMask.fieldPaths=addedAt`;

  const fsResp = await fetch(docUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      fields: {
        username: { stringValue: username },
        role: { stringValue: "super_admin" },
        mustChangePassword: { booleanValue: false },
        note: { stringValue: note },
        displayName: { stringValue: note.slice(0, 120) },
        addedBy: { stringValue: "system" },
        addedAt: { timestampValue: nowIso }
      }
    })
  });
  const fsJson = await fsResp.json();
  if (!fsResp.ok) {
    throw new Error(fsJson.error?.message || `Firestore write failed (${fsResp.status})`);
  }

  return uid;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsageAndExit(args.length === 0 ? 1 : 0);
  }

  const username = normalizeUsername(args[0]);
  if (!isValidUsername(username)) {
    console.error(
      `Error: Invalid username "${args[0]}". Use 3–32 lowercase letters, digits, '.', '-', or '_' (starting with letter or digit).`
    );
    process.exit(1);
  }

  const passwordWasGenerated = !args[1];
  const password = args[1] ? String(args[1]) : generateOneTimePassword(16);
  const strength = validateStrongPassword(password);
  if (!strength.valid) {
    console.error(
      "Error: Password is not strong enough. Must be 8–128 characters and include uppercase, lowercase, digit, and special character."
    );
    process.exit(1);
  }

  const note = String(args[2] || "Main Super Admin").trim().slice(0, 160);
  const authEmail = usernameToAuthEmail(username);

  let uid = username;
  try {
    uid = await provisionViaFirebaseAdmin({ username, authEmail, password, note });
  } catch (_adcErr) {
    // Fall back to active `gcloud auth` token with explicit x-goog-user-project header
    uid = await provisionViaGcloudToken({ username, authEmail, password, note });
  }

  console.log("==========================================================");
  console.log("  Super Admin Account Provisioned Successfully");
  console.log("==========================================================");
  console.log(`  Project:        ${PROJECT_ID}`);
  console.log(`  Username:       ${username}`);
  console.log(`  Auth Mapping:   ${authEmail} (UID: ${uid})`);
  if (passwordWasGenerated) {
    console.log(`  Generated Pass: ${password}`);
  } else {
    console.log("  Password:       (set to provided strong password)");
  }
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("Failed to provision Super Admin:", err && err.message ? err.message : err);
  process.exit(1);
});
