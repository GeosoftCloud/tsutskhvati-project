# თოვლის დღის კლასი (SnowDay Class) · `answer.ge`

Resilient bilingual (Georgian / English) AI school lesson portal and QR studio built for mountainous and regional schools. When heavy snow prevents a teacher from reaching school, the teacher shares today's lesson outline via **Google Docs, Google Drive (PDF, DOCX, TXT), or uploaded files**, generates a **QR code** on `answer.ge`, and the **Geosoft AI Agent** automatically generates:
1. **Learning Cards (`სასწავლო ბარათები`)** grounded in the teacher's Doc + curriculum context from that academic subject,
2. **Hard Words Glossary (`რთული სიტყვების ლექსიკონი`)** with simple 1-line student definitions,
3. **3-Option Questionnaire (`შემაჯამებელი კითხვარი`)** with 1st-try hints and score tracking,
4. **Interactive AI Lesson Tutor (`AI რეპეტიტორი`)** in chat (plus live **JumpIn** teacher handoff so the absent teacher can answer live from home).

---

## 1. Entry Flow & Zero-Token Two-Tier Caching

- **First Visit without `?doc=...` (`https://answer.ge`)**:
  - **For Students**: Paste the teacher's Google Docs link directly (or reopen a saved lesson in 1 click).
  - **For Teachers**: Paste a public Google Docs link (`Anyone with the link → Viewer`) to generate a scannable Student QR Code (`https://answer.ge/?doc=...`), download PNG, print, or preview the generated lesson.
- **Two-Tier Caching (Zero Redundant AI Token Usage)**:
  1. **Browser `localStorage` Cache (`0 ms`)**: Refreshing or revisiting the same `?doc=...` URL renders the full generated lesson instantaneously without network calls or AI tokens.
  2. **Cross-Student Shared Server Cache (`lessoncache_<DOC_ID>_<HASH8>`)**: Once the first student (or teacher) generates a lesson for a Google Doc, every subsequent student scanning that same QR code on any phone or browser retrieves the already-generated bilingual lesson JSON from Geosoft session storage in ~120 ms—consuming **zero extra AI tokens** unless the teacher edits the Google Doc or clicks **Regenerate**.

---

## 2. Project Files Overview

| File | Purpose |
| :--- | :--- |
| [`server.js`](./server.js) | Production Node.js HTTP server for Google Cloud Run deployment |
| [`Dockerfile`](./Dockerfile) | Production Docker container configuration |
| [`index.html`](./index.html) | Main static web app (`answer.ge`), Entry Landing Hub (Student + Teacher QR), AI Tutor chat, Learning Cards, Glossary, and Questionnaire |
| [`styles.css`](./styles.css) | Responsive design system + classroom QR print stylesheet |
| [`app.js`](./app.js) | `?doc=` QR reader, direct Google Docs CORS reader, Two-Tier Cache (`localStorage` + shared Geosoft cache), and JumpIn polling |
| [`qrcode.js`](./qrcode.js) | Zero-dependency ISO/IEC 18004 QR Code encoder (crisp SVG + downloadable PNG) |
| [`chatbot-config.js`](./chatbot-config.js) | Geosoft Headless Agent URL (`agentBaseUrl`) & caching settings |
| [`auth-config.js`](./auth-config.js) | Google Cloud / Firebase (`tsutskhvati-teacher-auth`) config & main Super Admin email (`luka@geosoft.dev`) |
| [`teacher-auth.js`](./teacher-auth.js) | Teacher Google OAuth authentication gate & Super Admin authorized teachers group manager |
| [`firestore.rules`](./firestore.rules) | Cloud Firestore Security Rules enforcing verified Google OAuth, Super Admin RBAC, and non-enumerable teacher checks |
| [`firebase.json`](./firebase.json) | Firebase Auth (Google Sign-In) & Firestore configuration |
| [`ai/snowday-school-agent.json`](./ai/snowday-school-agent.json) | **Import-ready Geosoft AI Agent JSON** (Mode Router + Student Tutor + Lesson JSON Architect) |
| [`ai/CUSTOM_TOOL_CODE.js`](./ai/CUSTOM_TOOL_CODE.js) | Optional sandboxed JS code for the **`Google Doc Lesson Reader`** Custom Tool in Geosoft Admin |
| [`ai/google-doc-reader-custom-tool.json`](./ai/google-doc-reader-custom-tool.json) | Optional field & argument specification for the Custom Tool |
| [`ai/AGENT_SETUP_AND_ARCHITECTURE.md`](./ai/AGENT_SETUP_AND_ARCHITECTURE.md) | Complete step-by-step Geosoft Admin setup & teacher instructions |

---

## 3. Running Locally or Deploying to `answer.ge`

Upload the static files directly to `answer.ge` or test locally:

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## 4. Google Cloud Run Deployment

The web portal is containerized and hosted on **Google Cloud Run**:
- **Service Name:** `tsutskhvati-web`
- **Region:** `europe-west1`
- **Live URL:** [https://tsutskhvati-web-617054738609.europe-west1.run.app](https://tsutskhvati-web-617054738609.europe-west1.run.app)
- **Health Check:** `https://tsutskhvati-web-617054738609.europe-west1.run.app/health`

Deploy command:
```bash
gcloud run deploy tsutskhvati-web \
  --source . \
  --project=geosoft-agents-customer-whc5sa \
  --region=europe-west1 \
  --allow-unauthenticated
```

