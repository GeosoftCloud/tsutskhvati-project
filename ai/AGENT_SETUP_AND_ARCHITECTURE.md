# SnowDay Class (`answer.ge`) — Geosoft AI Agent Architecture & Setup Guide

This folder contains the complete Geosoft AI Agent configuration powering **SnowDay Class** (`answer.ge`):
- **Importable Agent Graph JSON**: [`snowday-school-agent.json`](./snowday-school-agent.json)
- **Custom Tool Sandboxed JS Code**: [`CUSTOM_TOOL_CODE.js`](./CUSTOM_TOOL_CODE.js) (supports Google Docs, Google Drive PDFs, Word DOCX, and TXT files)
- **Custom Tool Schema Reference**: [`google-doc-reader-custom-tool.json`](./google-doc-reader-custom-tool.json)

---

## 1. How the Agent Graph Works

```text
                       ┌───────────────────────────────────────┐
                       │         Student Lesson Tutor          │
        opt-tutor      │          (agent-tutor-chat01)         │── out ──┐
      ┌───────────────▶│  • Gemini 3.8 Flash + Chat History    │         │
      │                │  • JumpIn Teacher Handoff enabled     │         ▼
┌─────┴─────┐          └───────────────────┬───────────────────┘    ┌─────────┐
│   Start   │── out ──▶ Mode Router        │ tools                  │   End   │
│answer.ge  │          (condition-mode-01) ▼                        └─────────┘
└───────────┘          │          ┌────────────────────────────┐         ▲
      │                │          │  Google Doc Lesson Reader  │         │
      │  opt-generate  │          │   (customTool_gdoc_rd01)   │         │
      └───────────────▶│          └────────────────────────────┘         │
                       │                   ▲ tools                       │
                       ┌───────────────────┴───────────────────┐         │
                       │         Lesson Page Generator         │         │
                       │          (agent-lesson-gen02)         │── out ──┘
                       │  • Stateless JSON Portal Architect    │
                       └───────────────────────────────────────┘
```

1. **QR Code Scan (`https://answer.ge/?doc=<GOOGLE_DOC_SHARE_LINK>`)**:
   - When a student scans the teacher's QR code, `answer.ge` reads `?doc=...` and sends:
     ```text
     [[MODE:GENERATE_LESSON]]
     docUrl: https://docs.google.com/document/d/<DOC_ID>/edit?usp=sharing
     ```
   - `Mode Router` (`condition-mode-01`) routes to **`Lesson Page Generator`** (`agent-lesson-gen02`).
   - `Lesson Page Generator` calls **`Google Doc Lesson Reader`**, reads the teacher's Google Doc plain text, enriches it with curriculum-aligned context from that academic subject (e.g., *History — King Tamar*, *Biology*, *Literature*), and outputs a bilingual (`ka` + `en`) JSON lesson object containing **Learning Cards**, **Hard Words Glossary**, and a **3-Option Questionnaire**.
   - `answer.ge` renders the entire website dynamically and caches the generated lesson in `localStorage` keyed by the Google Doc ID.
2. **Interactive Student Chat (`opt-tutor`)**:
   - Every student question in chat routes to **`Student Lesson Tutor`** (`agent-tutor-chat01`).
   - Every chat turn starts with `[[MODE:STUDENT_CHAT]]` so the Mode Router (an LLM condition) routes it to the tutor deterministically. On the first turn of a session, `answer.ge` also attaches `[LESSON_CONTEXT docUrl="..."]` (plus inline `[TEACHER_DOC_START]…[TEACHER_DOC_END]` text when available) and the student's text after `[STUDENT_MESSAGE]`. Without the marker, the router can mistake a first turn carrying a whole teacher document for a lesson-generation request and reply with lesson JSON.
   - If no inline doc text is present, `Student Lesson Tutor` calls **`Google Doc Lesson Reader`**.
   - Safety net: if a chat reply still comes back as lesson JSON, `app.js` retries once as a plain chat turn and never renders the JSON (also filtered when chat history is re-synced).
   - Geosoft's runtime automatically caches `custom_tool_...` results in memory per `(sessionId, args)` for **2 hours**, so subsequent student turns have **zero Google Docs fetch latency**!
   - If the student asks to talk directly to their absent human teacher, `allowHumanHandoff: true` triggers Geosoft **JumpIn**, allowing the teacher to answer live from home via the Geosoft Customer Panel while `answer.ge` polls every 3 seconds.

---

## 2. Step-by-Step Setup in Geosoft Admin (`geosoft-agents`)

### Step 1 — Create the Custom Tool (`Google Doc & Drive File Lesson Reader`)
1. Open **Geosoft Admin → Tools → + New**.
2. Fill in the metadata (matching [`google-doc-reader-custom-tool.json`](./google-doc-reader-custom-tool.json)):
   - **Name**: `Google Doc Lesson Reader`
   - **Description**: `Fetches the full UTF-8 plain text of a teacher's shared Google Doc, Google Drive PDF, Word DOCX, or TXT file ('Anyone with the link can view') given its share URL or Document/File ID.`
   - **Icon**: `FileText`
   - **Returns HTML**: **Off** (`false`)
3. Add **Static Fields (`fields`)**:
   - `name` (`string`, optional) — Label: `Name`
   - `description` (`string`, optional) — Label: `Description`
   - `maxChars` (`number`, optional) — Label: `Maximum Characters to Extract`
4. Add **LLM Call Argument (`args`)**:
   - `docUrl` (`string`, **required: true**) — Description: `Full Google Docs or Drive share URL (https://docs.google.com/document/d/... or https://drive.google.com/file/d/...), direct document link (.pdf, .docx, .txt), or bare Document/File ID.`
5. Paste the contents of [`CUSTOM_TOOL_CODE.js`](./CUSTOM_TOOL_CODE.js) into the **Code** editor and click **Save**.
6. Copy the newly created **Tool ID** from the URL (`/tools/<TOOL_ID>`) — or simply select it on the canvas in Step 2!

### Step 2 — Create & Import the Agent (`API only` Mode)
1. Go to **Agents → + New**:
   - **Name**: `SnowDay Class — School Lesson & Tutor Agent`
   - **Integration / Delivery Mode**: Select **API only** (`deliveryMode: "api"`) so `/api/v1/agents/<agentId>/*` headless JSON endpoints are enabled.
2. Inside the Agent Builder, click **Import** and select [`snowday-school-agent.json`](./snowday-school-agent.json).
3. Click the **`Google Doc Lesson Reader`** bottom leaf node (`customTool_gdoc_rd01`) on the canvas and select the **`Google Doc Lesson Reader`** Custom Tool you created in Step 1 (replacing `REPLACE_WITH_GOOGLE_DOC_READER_TOOL_ID`).
4. Click the **`Start`** node (`start-snowday-01`) and verify:
   - **Integration mode**: `API only`
   - **Allowed domains**:
     - `answer.ge` *(automatically covers `answer.ge` and `www.answer.ge`)*
     - `localhost` *(for local testing)*
     - `127.0.0.1` *(for local testing)*
5. *(Optional)* Open **Chatbox / Starters** and add localized greetings for `ka` and `en`.
6. Click **Save**, then click **Publish** (unpublished agents return `404` on `/api/v1/agents/:id/*`).

### Step 3 — Connect `answer.ge` to Your Published Agent
1. Click the **API** button in the Geosoft Agent Builder toolbar and copy your **Agent Base URL**:
   ```text
   https://<YOUR_CUSTOMER_CDN_HOST>/api/v1/agents/<YOUR_AGENT_ID>
   ```
   *(Note: Because `answer.ge` calls the agent directly from the browser using CORS + `allowedDomains`, **do NOT** put any `gsa_...` server secret key in browser code!)*
2. Paste that URL into [`../chatbot-config.js`](../chatbot-config.js):
   ```js
   window.SNOWDAY_AGENT_CONFIG = {
     agentBaseUrl: "https://<YOUR_CUSTOMER_CDN_HOST>/api/v1/agents/<YOUR_AGENT_ID>",
     publicSiteBaseUrl: "https://answer.ge",
     defaultLessonId: "history-tamar",
     cacheGeneratedLessons: true
   };
   ```
   *(Tip for live stage demos: You can also paste or update `agentBaseUrl` live in the browser inside **Teacher QR Studio → AI Agent API Connection**!)*

---

## 3. Teacher Instructions for Preparing a Lesson Google Doc
1. Write or paste today's lesson outline in **Google Docs** (any school subject: History, Biology, Literature, Geography, Physics, Math, etc.).
2. Click **Share (გაზიარება)** in the top-right corner of Google Docs.
3. Under **General access (ზოგადი წვდომა)**, choose **Anyone with the link → Viewer (ნებისმიერი მომხმარებელი, ვისაც აქვს ბმული → მნახველი)** and click **Copy link**.
4. Open `https://answer.ge`, click **მასწავლებლის QR სტუდია / Teacher QR Studio**, paste the Google Docs link, and download or share the generated **QR Code** with students!
