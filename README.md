# თოვლის დღის კლასი (SnowDay Class) · `answer.ge`

Resilient bilingual (Georgian / English) AI school lesson portal and QR studio built for mountainous and regional schools. When heavy snow prevents a teacher from reaching school, the teacher shares today's lesson outline via **Google Docs, Google Drive (PDF, DOCX, TXT), or uploaded files**, generates a **QR code** on `answer.ge`, and the **Geosoft AI Agent** automatically generates:
1. **Learning Cards (`სასწავლო ბარათები`)** grounded in the teacher's Doc + curriculum context from that academic subject,
2. **Hard Words Glossary (`რთული სიტყვების ლექსიკონი`)** with simple 1-line student definitions,
3. **3-Option Questionnaire (`შემაჯამებელი კითხვარი`)** with 1st-try hints and score tracking,
4. **Interactive AI Lesson Tutor (`AI რეპეტიტორი`)** in chat (plus live **JumpIn** teacher handoff so the absent teacher can answer live from home).

---

## 1. Teacher Username + Password Authentication & One-Time Password Flow

Google OAuth sign-in has been removed. Teacher and Super Admin authentication uses **Username + Strong Password** backed by Firebase Authentication (`emailPassword`), Cloud Firestore (`geosoft-agents-customer-whc5sa`), and the Node.js Admin API in [`server.js`](./server.js):

1. **Manual System Bootstrap for the First Super Admin** (supports both CLI/env and Firebase Console):
   - **Option A — CLI Script (Recommended)**:
     ```bash
     # Auto-generates and prints a strong password if [password] is omitted:
     npm run create-super-admin -- admin
     # Or specify a custom strong password and display name:
     npm run create-super-admin -- admin "MyStr0ng!Pass2026" "Main Super Admin"
     ```
   - **Option B — Environment Variables on Server Startup / Cloud Run**:
     Set `SUPER_ADMIN_USERNAME` and `SUPER_ADMIN_PASSWORD` (must meet strong password rules) on `server.js` / Cloud Run; the server idempotently provisions the Super Admin on boot.
   - **Option C — Manual Entry in Firebase Console**:
     - **Via Firebase Auth + Firestore UI**:
       1. In **Firebase Console → Authentication → Users → Add user**, add email `<username>@teachers.answer.ge` (e.g. `admin@teachers.answer.ge`) and a strong password.
       2. In **Firestore Database → `teachers` collection**, add document ID `<username>` (e.g. `admin`) with fields `username: "admin"`, `role: "super_admin"`, `mustChangePassword: false`.
     - **Or Firestore UI Only (`initialPassword` bootstrap)**:
       Create `/teachers/<username>` in Firestore with `{ role: "super_admin", initialPassword: "<StrongPassword>" }`. On first login through the portal, `server.js` automatically creates the Firebase Auth account and permanently deletes `initialPassword` from Firestore.
2. **Creating Teachers (Super Admin Panel)**:
   - The Super Admin enters a teacher `username` (3–32 chars: `a-z`, `0-9`, `.`, `-`, `_`) and optional full name/subject note.
   - `server.js` automatically generates a cryptographically strong 14-character **one-time password** and displays it once with one-click Copy buttons.
3. **Mandatory First-Login Password Change & Strong Password Policy**:
   - When a teacher signs in with a one-time password, workspace and Firestore `/docs` access remain locked (`mustChangePassword: true`) until they set their own strong password.
   - Strong password rules (enforced both in UI and server-side): **8–128 characters**, including at least **1 uppercase letter (`A–Z`)**, **1 lowercase letter (`a–z`)**, **1 digit (`0–9`)**, and **1 special character (`!@#$%...`)**, and **must differ** from the one-time/current password.
4. **Admin Password Reset**:
   - If a teacher forgets their password, the Super Admin clicks **🔑 Reset Password (`პაროლის აღდგენა`)** next to that teacher in the Admin Panel.
   - Existing refresh tokens are revoked immediately, a new strong one-time password is generated and displayed to the Super Admin, and the teacher is prompted to choose a new strong password on next login.

---

## 2. Project Files Overview

| File | Purpose |
| :--- | :--- |
| [`server.js`](./server.js) | Production Node.js HTTP & Firebase Admin Auth API server for Google Cloud Run |
| [`auth-utils.mjs`](./auth-utils.mjs) | Shared username normalization, strong password validator, and CSPRNG one-time password generator |
| [`doc-extract.mjs`](./doc-extract.mjs) | Server-side lesson reader: downloads shared Google Docs / Drive files and extracts text from PDF (`unpdf`), DOCX (`mammoth`) and TXT |
| [`scripts/create-super-admin.mjs`](./scripts/create-super-admin.mjs) | CLI utility to manually create or update a Super Admin from the system |
| [`Dockerfile`](./Dockerfile) | Production Docker container configuration (`node:24-alpine`) |
| [`index.html`](./index.html) | Main web app (`answer.ge`), Landing Hub, Teacher Workspace, Super Admin Panel, AI Tutor, Cards, Glossary, and Quiz |
| [`styles.css`](./styles.css) | Responsive design system, password strength checklist, and classroom QR print stylesheet |
| [`app.js`](./app.js) | `?doc=` QR reader, direct Google Docs/Drive CORS reader, Two-Tier Cache, and JumpIn polling |
| [`qrcode.js`](./qrcode.js) | Zero-dependency ISO/IEC 18004 QR Code encoder (crisp SVG + downloadable PNG) |
| [`chatbot-config.js`](./chatbot-config.js) | Geosoft Headless Agent URL (`agentBaseUrl`) & caching settings |
| [`auth-config.js`](./auth-config.js) | Firebase (`geosoft-agents-customer-whc5sa`) Web SDK & synthetic username domain configuration |
| [`teacher-auth.js`](./teacher-auth.js) | Username/password login, forced one-time password change UI, personal history workspace & Super Admin panel |
| [`firestore.rules`](./firestore.rules) | Cloud Firestore Security Rules enforcing password auth, RBAC, and `mustChangePassword` lockouts |
| [`firebase.json`](./firebase.json) | Firebase Auth (`emailPassword`) & Firestore configuration |

---

### Lesson file reading & uploads

| Endpoint | Access | Purpose |
| :--- | :--- | :--- |
| `POST /api/docs/extract` `{ url }` | Public (rate-limited) | Reads a public Google Doc, Drive PDF / DOCX / TXT, or direct `https://` file link server-side (avoids browser CORS) and returns its text |
| `POST /api/docs/upload` | Signed-in teacher | Raw file body + `X-File-Name` header. Extracts text from PDF / DOCX / TXT (max 20 MB) and stores it in Firestore `uploadedDocs/{id}` |
| `GET /api/docs/uploads/:id` | Public (random ID) | Returns an uploaded lesson's text, so the QR link works on every student's device |

Scanned (image-only) PDFs and legacy `.doc` files are rejected with a clear message: save them as a text PDF or `.docx`.

## 3. Running Locally

```bash
npm install
npm test
npm start
# Open http://localhost:8080
```

> Note: For local teacher creation / password reset via Firebase Admin SDK, ensure Google Cloud Application Default Credentials are active (`gcloud auth application-default login --project=geosoft-agents-customer-whc5sa`).

---

## 4. Deploying Firebase Rules/Auth & Google Cloud Run

1. **Deploy Firebase Auth (`emailPassword`) and Firestore Security Rules**:
   ```bash
   npx -y firebase-tools@latest deploy --only auth,firestore:rules --project geosoft-agents-customer-whc5sa
   ```
2. **Deploy Web & Admin API Server to Google Cloud Run**:
   - **Service Name:** `tsutskhvati-web`
   - **Region:** `europe-west1`
   - **Live URL:** [https://tsutskhvati-web-617054738609.europe-west1.run.app](https://tsutskhvati-web-617054738609.europe-west1.run.app)
   ```bash
   gcloud run deploy tsutskhvati-web \
     --source . \
     --project=geosoft-agents-customer-whc5sa \
     --region=europe-west1 \
     --allow-unauthenticated
   ```
