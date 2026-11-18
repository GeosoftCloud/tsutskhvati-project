# API reference

All routes are mounted in `src/server.js`. None require a session/cookie — authorization is the per-agent domain allowlist (see [security.md](security.md)), checked against the request's `Origin`/`Referer` header.

## `GET /healthz`

Liveness check. Always returns `200 text/plain "ok"`.

## `GET /widget/:agentId.js`

Serves the embeddable widget as a self-invoking JavaScript file (see [widget.md](widget.md)).

- `agentId` must match `^[A-Za-z0-9_-]{1,128}$`, else `400 text/plain "Invalid agent id."`.
- Response: `Content-Type: application/javascript`, `Cache-Control: public, max-age=300`.
- The API base URL baked into the script is `PUBLIC_BASE_URL` if set, otherwise the incoming request's own protocol + host.

## `GET /api/agents/:id/config`

Public chatbox config — name and chatbox styling only (no graph, no secrets).

- Loads the agent via `loadAgentConfig` using the request's `Origin` (falling back to `Referer`) as the domain to check.
- **200** → `{ "name": string, "chatbox": ChatboxConfig }`
- **403** → `{ "error": "This domain isn't authorized to use this agent." }` (domain not allowlisted)
- **404** → `{ "error": "Agent not found." }`
- **500** → `{ "error": "Failed to load agent." }`

## `POST /api/agents/:id/chat`

Runs the agent's conversation graph for one turn and streams the result.

**Request body** (JSON):

```jsonc
{
  "history": [{ "role": "user" | "model" | "human", "text": string, "allowHtml"?: boolean }],
  "sessionId"?: string,   // omit to get a fresh crypto.randomUUID()
  "visitorId"?: string    // defaults to sessionId if omitted
}
```

**Response**: `Content-Type: application/x-ndjson`, `Cache-Control: no-store`. Body is newline-delimited JSON events written as they occur — in practice exactly one event per request:

- `{"type":"final","reply":string,"allowHtml":boolean,"status":"jumpin"|null}` — normal completion. `status:"jumpin"` means the agent asked for human handoff on this turn.
- `{"type":"final","reply":"...daily message limit...","allowHtml":false}` — visitor or agent daily cap reached.
- `{"type":"final","reply":"","allowHtml":false,"status":"jumpin"|"solved"}` — conversation was already handed off/closed; the AI did not run this turn.
- `{"type":"error","message":string}` — the graph run threw.

Side effects on success: the turn is appended to the conversation's Firestore document (`recordConversationTurn`), and if the agent's "collect leads" tool fired, a lead document is written (`recordLead`). Both are best-effort — failures are logged, not surfaced to the caller.

## `GET /api/agents/:id/conversation/:sessionId`

Fetches a conversation's current state. Used by the widget's JumpIn poll loop and when reopening a past conversation from history.

- **200** → `{ "status": string|null, "name": string|null, "assigned": boolean, "messages": Message[] }`, or `{ "status": null, "messages": [] }` if the conversation doesn't exist. `assigned` is true once a customer-panel team member has taken the conversation.
- Side effect: asynchronously (fire-and-forget, after responding) clears `unseenByVisitor` on the conversation.
- `Cache-Control: no-store`.
- Errors mirror `loadAgentConfig` (403/404/500), since it first verifies the agent/domain is allowed.

## `GET /api/agents/:id/conversations?visitorId=`

Lists a visitor's own conversations with this agent, newest first (max 30), for the widget's history view.

- `visitorId` query param is required → `400 { "error": "visitorId is required." }` if missing.
- **200** → `{ "conversations": [{ id, status, startedAt, updatedAt, unseenByVisitor, lastMessagePreview }] }`

## `POST /api/agents/:id/message`

Sends a visitor message while a conversation is in `jumpin` status (human handoff) — no AI run, just appended for the support agent to see.

**Request body**: `{ "sessionId": string, "text": string }` — both required, else `400`.

- **200** → `{ "ok": true }`
- **500** → `{ "error": "Failed to send message." }`

## `POST /api/agents/:id/conversation/:sessionId/cancel-jumpin`

Lets the visitor back out of a JumpIn handoff and return to the AI.

**Request body**: `{ "visitorId": string }` (required, else `400`).

- **200** → `{ "cancelled": true }`, or `{ "cancelled": false }` if the conversation wasn't `jumpin`.
- **403** if `visitorId`/`agentId` don't match the document. **404** if it doesn't exist.
- **409** `{ "error": "A support agent has already joined this conversation." }` once a human has replied or an active customer-panel team member has taken the conversation. The widget resyncs by polling.

## `DELETE /api/agents/:id/conversation/:sessionId?visitorId=`

Hard-deletes one of the visitor's own conversations.

- `visitorId` query param required → `400` if missing.
- Ownership is checked against the document's own `visitorId`/`agentId` fields — **403** `{ "error": "Not allowed to delete this conversation." }` on mismatch.
- **200** → `{ "ok": true }`

## `GET /api/handoff-mail/status`, `POST /api/handoff-mail/test`

Server-to-server, for the customer panel's Team page "Handoff email" card. Both require `x-cdn-secret` (constant-time compared against `CDN_SHARED_SECRET`, same as `POST /api/conversations/:id/reply`) → **401** otherwise.

- `GET /status` → `{ configured, missing: string[] /* env var names, never values */, senderEmail, fromName, replyTo, supportRecipients }`.
- `POST /test` `{ "to": string }` sends the real handoff template, marked as a test. `to` must be an active admin in `team` → **403** otherwise. → `{ "ok": true, fromName, replyTo }` or `{ "ok": false, reason: "mail_not_configured" | "token_expired" | "send_failed", missing?, error? }`.

## `GET /webhooks/messenger/:agentId`, `GET /webhooks/instagram/:agentId`, `GET /webhooks/whatsapp/:agentId`

Meta's webhook verification handshake. Loads that channel's config via `loadAgentChannelConfig`,
checks `hub.mode === "subscribe" && hub.verify_token === config.verifyToken`, and echoes back
`hub.challenge` with **200** on match, or **403** otherwise. Telegram has no equivalent route —
its webhook is registered directly via the platform's `saveTelegramChannelAction` calling
Telegram's own `setWebhook` API.

## `POST /webhooks/messenger/:agentId`, `POST /webhooks/instagram/:agentId`, `POST /webhooks/whatsapp/:agentId`

Receives inbound Messenger/Instagram/WhatsApp events. Verifies `X-Hub-Signature-256` (HMAC-SHA256
of the raw body, keyed by the channel's App Secret) before trusting the payload — **401** on
mismatch. Responds **200** immediately once validated (Meta requires a fast ack), then
asynchronously extracts each inbound text message (`entry[].messaging[]` for Messenger/Instagram,
`entry[].changes[].value.messages[]` for WhatsApp — same webhook object family, different shape)
via `handleInboundChannelMessage` (`src/lib/channel-pipeline.js`, channel-agnostic, shared with the
Telegram route below) and sends the reply back through the Graph API Send API using the channel's
stored access token. JumpIn handoff, daily usage caps, chat history, and lead capture all reuse the
exact same Firestore functions the widget's `/api/agents/:id/chat` route does — a channel
conversation just uses a stable `{channel}:{agentId}:{senderId}` id instead of a fresh
per-page-load session id.

The sender's profile name becomes the conversation's name when nothing better is known (a name the visitor told the agent, or one remembered from before, wins): WhatsApp's webhook carries it in `value.contacts[].profile.name`, Telegram's in `message.from.first_name`/`last_name`, and for Messenger/Instagram it's one Graph API lookup (`fetchMetaProfileName`, `first_name,last_name` / `name,username`) on the sender's first conversation, best-effort with a 3 s timeout.

## `POST /webhooks/telegram/:agentId`

Receives Telegram Bot API updates. Authenticates via the `X-Telegram-Bot-Api-Secret-Token` header
(constant-time compared against the channel's stored `secretToken` — Telegram has no HMAC body
signature like Meta) — **401** on mismatch. Responds **200** immediately, then runs
`handleInboundChannelMessage` for `message.text` and replies via Telegram's `sendMessage` API
using the stored bot token. `message.chat.id` doubles as both the reply target and the
conversation's stable sender id (correct for 1:1 bot chats; group chats aren't given special
handling).

## Headless Agent API (`/api/v1/agents/:id/*`)

When an agent's `deliveryMode` is `"api"` (API-only mode — widget endpoints above return `403`/`404`), pure-JSON endpoints under `/api/v1` are enabled for clients building custom website chatbot UIs. Authenticate either from the browser via the Start-node `allowedDomains` (`Origin` header) or server-to-server via `Authorization: Bearer <apiKey>` / `X-API-Key: <apiKey>`.

- `GET /api/v1/agents/:id` → `{ agentId, name, starters }`
- `POST /api/v1/agents/:id/chat` → `{ message, sessionId?, visitorId?, replyTo?, pageUrl? }` (or `{ history, ... }`) → `200 { reply, allowHtml, status: "ai"|"jumpin"|"solved", handoff, assigned, sessionId, visitorId, userMessageId, messageId }` or `429` when daily limits are reached
- `GET /api/v1/agents/:id/conversations/:sessionId` → `{ sessionId, status, name, assigned, messages }`
- `POST /api/v1/agents/:id/conversations/:sessionId/messages` → `{ text, replyTo? }` → `{ ok: true, messageId }`
- `POST /api/v1/agents/:id/conversations/:sessionId/cancel-handoff` → `{ visitorId }` → `{ cancelled: boolean }`
- `GET /api/v1/agents/:id/conversations?visitorId=...` → `{ conversations }`
- `DELETE /api/v1/agents/:id/conversations/:sessionId?visitorId=...` → `{ ok: true }`
- `POST /api/v1/agents/:id/feedback` → `{ sessionId, messageId, rating: "up"|"down", comment? }` → `{ ok: true }`

Full client integration documentation lives in [`docs/custom-ui-api.md`](../../docs/custom-ui-api.md).

## Errors common to all agent-scoped routes

Every route above (except `/widget/:agentId.js` and `/healthz`) resolves the agent through `loadAgentConfig`, so they share the same failure modes:

| Status | Body | Cause |
| --- | --- | --- |
| 403 | `{ "error": "This domain isn't authorized to use this agent." }` | Requesting origin's hostname isn't in the agent's `allowedDomains` |
| 404 | `{ "error": "Agent not found." }` | No agent with that id on the platform |
| 500 | `{ "error": "Failed to load agent." }` | Platform unreachable or other unexpected error |
