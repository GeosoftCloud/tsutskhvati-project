# Headless Agent API (Custom Website Chatbot UI)

When a client builds a fully bespoke chatbot UI on their website instead of using the default Geosoft `<script>` widget, create the agent in **API only** (`deliveryMode: "api"`) mode from **Agents → + New** (or switch an existing agent via **Start node → Integration mode**).

In **API only** mode:
- The built-in JavaScript widget (`/widget/:agentId.js` and `/api/agents/:id/config`) is **disabled** so no default UI can load.
- Clean, pure-JSON REST endpoints under `/api/v1/agents/:agentId/*` are enabled on the customer's dedicated `cdn-service` Cloud Run deployment.
- Every conversation, lead, registration, visitor memory entry, feedback rating, daily quota, and human handoff (`JumpIn`) continues to work identically with the customer's **Customer Panel** inbox and their isolated GCP project billing.

---

## 1. Base URL

Every customer has a dedicated Cloud Run `cdn-service` URL provisioned at registration:

```text
https://<customer-cdn-service-host>/api/v1/agents/<agentId>
```

You can copy the exact generated URL and credentials from:
1. The **API** button in the Agent Builder top toolbar, or
2. Clicking the **Start** node on the builder canvas.

> **Important:** Just like widget agents, an API agent must be **Published** (**Publish** button in the builder toolbar) before external requests succeed. Unpublished agents return `404`.

---

## 2. Authentication & Security

Clients can call the API in **two ways** depending on their website architecture:

### Option A — Direct from Browser JavaScript (Frontend SPA / React / Vue / Vanilla JS)
- **Do not** place any secret API key in frontend browser code.
- Instead, add the client's domain (e.g. `example.com` — subdomains like `www.example.com` and `app.example.com` match automatically) under **Start node → Allowed domains**, then click **Publish**.
- Browser `fetch()` requests automatically include the `Origin` header; `cdn-service` reflects CORS headers (`Access-Control-Allow-Origin`) and verifies the `Origin` hostname against `allowedDomains` (deny-by-default).

### Option B — Server-to-Server Proxy (Next.js Route Handler / Node / Python / PHP Backend)
- Pass the generated per-agent API key (`gsa_...`) in either header:
  - `Authorization: Bearer gsa_...`
  - `X-API-Key: gsa_...`
- Server-to-server requests have no browser `Origin` header and authenticate via constant-time key comparison.
- **Strict backend-only lockdown:** If you leave **Allowed domains** empty (`[]`), browser requests without the secret key are completely blocked (`403`), and only backend requests carrying the secret API key succeed.
- **Defense-in-depth:** If **Allowed domains** *is* configured and a request arrives from a browser (`Origin` header present) with an API key, the `Origin` must *still* match `allowedDomains` — protecting clients even if a developer accidentally leaks the key in frontend code.
- **Key rotation:** Clicking **Regenerate API key** in the builder immediately replaces the stored encrypted key; cached `cdn-service` instances pick up the rotation within `CONFIG_CACHE_TTL_MS` (60 seconds).

---

## 3. Endpoints Reference

All endpoints accept and return `application/json` (UTF-8).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/agents/:agentId` | Fetch agent display name & localized starter messages / quick replies |
| `POST` | `/api/v1/agents/:agentId/chat` | Send a visitor message and get the AI reply (or append during human handoff) |
| `GET` | `/api/v1/agents/:agentId/conversations/:sessionId` | Fetch session transcript & JumpIn human-handoff status (for polling or restoring) |
| `POST` | `/api/v1/agents/:agentId/conversations/:sessionId/messages` | Append a visitor message directly while `status === "jumpin"` |
| `POST` | `/api/v1/agents/:agentId/conversations/:sessionId/cancel-handoff` | Cancel waiting for a human support agent and return to AI |
| `GET` | `/api/v1/agents/:agentId/conversations?visitorId=...` | List up to 30 recent conversations for a visitor |
| `DELETE` | `/api/v1/agents/:agentId/conversations/:sessionId?visitorId=...` | Permanently delete a visitor's conversation |
| `POST` | `/api/v1/agents/:agentId/feedback` | Record thumbs-up / thumbs-down + optional comment on an AI reply |

**ID format rule:** Client-supplied `sessionId` and `visitorId` values must match `^[A-Za-z0-9_-]{1,128}$` (standard UUIDs work out of the box). Colons (`:`) and slashes (`/`) are rejected with `400`.

---

### `GET /api/v1/agents/:agentId`

Returns public agent metadata so a custom UI can optionally render the agent's name and localized starter prompts/quick-replies configured in the builder.

**Response `200`:**
```json
{
  "agentId": "8fK29sLmP1xQ",
  "name": "Acme Concierge",
  "starters": {
    "en": {
      "message": "Hi! How can I help you explore our suites today?",
      "quickReplies": ["Check availability", "Pricing & packages", "Talk to sales"]
    },
    "ka": {
      "message": "გამარჯობა! რით შემიძლია დაგეხმაროთ?",
      "quickReplies": ["ფასები", "დაჯავშნა"]
    }
  }
}
```

---

### `POST /api/v1/agents/:agentId/chat`

Runs one turn of the published agent graph (including Condition routing, Knowledge Base, Catalog Search, Google Workspace tools, Custom Tools, Lead Capture, Visitor Memory, and Human Handoff detection) and persists the turn to the customer's `chat-history` Firestore.

**Request Body:**
```jsonc
{
  // Recommended: pass just the new visitor message. When `sessionId` is reused,
  // prior messages in the session are loaded automatically from Firestore.
  "message": "Do you have 2-bedroom apartments available?",

  // Optional alternative to `message`: pass the full conversation array yourself.
  // If provided, the last item must have role: "user" and non-empty text.
  // "history": [{ "role": "user", "text": "..." }],

  // Conversation session ID. Omit on the first turn to auto-generate a UUID,
  // then send the returned `sessionId` on every subsequent turn in that chat.
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",

  // Stable visitor ID (e.g. persisted in localStorage or your authenticated user ID).
  // Powers cross-session visitor memory, Customer Panel visitor numbering, and
  // per-visitor daily rate limits. Defaults to `sessionId` if omitted.
  "visitorId": "vis_9f81c3a0",

  // Optional: quote an earlier message this turn replies to.
  "replyTo": {
    "id": "222e8400-e29b-41d4-a716-446655440000",
    "role": "model",
    "text": "Which bedroom count are you looking for?"
  },

  // Optional: full URL of the page the visitor is currently browsing.
  "pageUrl": "https://example.com/en/apartments"
}
```

**Response `200` (Normal AI reply):**
```json
{
  "reply": "Yes! We currently have three 2-bedroom residences available starting at $145,000.",
  "allowHtml": false,
  "status": "ai",
  "handoff": false,
  "assigned": false,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "visitorId": "vis_9f81c3a0",
  "userMessageId": "a71b98f0-12a4-4f0b-9f11-88c9910293ab",
  "messageId": "c09d14e2-67b1-42c8-8a32-44d8819201ef"
}
```

**Response fields:**
- `reply` (`string | null`): The assistant's message. `null` only if the conversation was already in `jumpin` (human support) mode when called — in which case the visitor's message was appended for the human agent without running the AI.
- `allowHtml` (`boolean`): `true` only when an admin explicitly enabled **HTML output** on the agent node or a custom tool returned HTML (`returnsHtml`). Render `reply` as plain text/Markdown when `false`, and sanitized/trusted HTML only when `true`.
- `status` (`"ai" | "jumpin" | "solved"`):
  - `"ai"` — handled by the AI agent.
  - `"jumpin"` — handed off to a human support teammate in Customer Panel. Start polling `GET /conversations/:sessionId` every ~3 seconds to display human replies.
- `handoff` (`boolean`): Convenience boolean (`status === "jumpin"`).
- `assigned` (`boolean`): `true` once a support teammate has claimed the conversation in Customer Panel.
- `sessionId` (`string`): Active session ID — store and reuse for subsequent messages in the same chat.
- `visitorId` (`string`): Resolved visitor ID.
- `userMessageId` (`string | null`): Persisted ID of the visitor's message.
- `messageId` (`string | null`): Persisted ID of the AI's reply — use for `POST /feedback` or `replyTo.id`.

**Rate Limit Response `429`:**
```json
{
  "error": "You've reached today's message limit for this chat. Please try again tomorrow.",
  "code": "visitor_daily_limit_exceeded",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "visitorId": "vis_9f81c3a0"
}
```
(`code` is `"visitor_daily_limit_exceeded"` or `"agent_daily_limit_exceeded"`.)

---

### `GET /api/v1/agents/:agentId/conversations/:sessionId`

Fetches the current status and full message transcript of a session.
- Call on page load if restoring an existing `sessionId` from `sessionStorage`/`localStorage`.
- Poll every ~3 seconds while `status === "jumpin"` so human replies (`role: "human"`) appear in your custom UI and so you detect when support marks the chat `"solved"` (at which point sending a new message to `POST /chat` seamlessly resumes AI conversation).
- Automatically clears `unseenByVisitor` in Customer Panel.

**Response `200`:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "jumpin",
  "name": "Giorgi",
  "assigned": true,
  "messages": [
    {
      "role": "user",
      "text": "Can I speak with a human agent?",
      "at": "2026-11-16T12:00:01.000Z",
      "messageId": "a71b98f0-..."
    },
    {
      "role": "model",
      "text": "Connecting you with our team right away.",
      "allowHtml": false,
      "at": "2026-11-16T12:00:02.000Z",
      "messageId": "c09d14e2-..."
    },
    {
      "role": "human",
      "text": "Hi Giorgi! Nino here from support — how can I help?",
      "at": "2026-11-16T12:00:18.000Z",
      "messageId": "f91a03b1-..."
    }
  ]
}
```

---

### `POST /api/v1/agents/:agentId/conversations/:sessionId/messages`

Explicitly appends a visitor message while in `jumpin` mode without invoking the AI. (Calling `POST /chat` during `jumpin` also performs this automatically.)

- **Body:** `{ "text": "Here is my order number: #4821", "replyTo"?: { "id": "...", "role": "human", "text": "..." } }`
- **Response `200`:** `{ "ok": true, "messageId": "d12f..." }`

---

### `POST /api/v1/agents/:agentId/conversations/:sessionId/cancel-handoff`

Lets the visitor cancel waiting for a human support agent and return to the AI **before** a teammate has claimed or replied to the conversation.

- **Body:** `{ "visitorId": "vis_9f81c3a0" }`
- **Response `200`:** `{ "cancelled": true }`
- **Response `409`:** `{ "error": "A support agent has already joined this conversation." }`

---

### `GET /api/v1/agents/:agentId/conversations?visitorId=...`

Lists the visitor's recent conversations with this agent (newest first, max 30).

**Response `200`:**
```json
{
  "conversations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "solved",
      "startedAt": "2026-11-16T12:00:01.000Z",
      "updatedAt": "2026-11-16T12:05:40.000Z",
      "unseenByVisitor": 0,
      "lastMessagePreview": "Thanks for chatting with us!"
    }
  ]
}
```

---

### `DELETE /api/v1/agents/:agentId/conversations/:sessionId?visitorId=...`

Hard-deletes one of the visitor's own conversations (verifies `visitorId` and `agentId` match).

- **Response `200`:** `{ "ok": true }`

---

### `POST /api/v1/agents/:agentId/feedback`

Records a visitor's thumbs-up or thumbs-down rating (and optional text comment) on an assistant reply. Updating an existing rating or adding a comment later overwrites the entry for that `messageId`.

- **Body:**
  ```json
  {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "messageId": "c09d14e2-67b1-42c8-8a32-44d8819201ef",
    "rating": "up",
    "comment": "Very accurate answer!"
  }
  ```
- **Response `200`:** `{ "ok": true }`

---

## 4. Common HTTP Error Codes

| Status | Meaning |
| --- | --- |
| `400` | Missing/invalid `message`, `history`, `sessionId`, `visitorId`, or `rating` |
| `401` | Invalid API key (`Authorization: Bearer` / `X-API-Key`), or key used on a widget-mode agent |
| `403` | Domain not in `allowedDomains`, agent is in `widget` mode (not `api`), or conversation belongs to a different visitor/agent |
| `404` | Agent does not exist, agent has not been **Published** yet, or conversation not found |
| `409` | Cannot cancel handoff because a support teammate has already joined |
| `429` | Visitor or agent daily message limit reached |
| `500` | Unexpected runtime error while loading or executing the agent graph |
