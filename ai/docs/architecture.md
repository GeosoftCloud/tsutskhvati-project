# Architecture

## Components

```
server.js
 ├─ routes/widget.js        GET  /widget/:agentId.js
 ├─ routes/config.js        GET  /api/agents/:id/config
 ├─ routes/chat.js          POST /api/agents/:id/chat
 ├─ routes/conversation.js  GET/POST/DELETE conversation + message endpoints
 └─ routes/channels/meta.js GET/POST /webhooks/messenger|instagram/:agentId
      │                          │
      │                          ▼
      │                    lib/channel-pipeline.js ──▶ lib/agent-runner.js (same as chat.js below)
      ▼
agent-config-loader.js  ──▶  agent-cache.js (in-memory TTL cache)
      │                          │
      ▼                          ▼
platform-client.js  ──▶  Geosoft admin platform (PLATFORM_BASE_URL)
      │
      ▼
lib/secrets.js (decrypt custom tool configs)
      │
      ▼
lib/agent-runner.js  ──▶  lib/vertex-ai.js ──▶ Vertex AI (Gemini)
      │                ├─▶ lib/google-workspace.js ──▶ Docs/Sheets/Calendar/Drive APIs
      │                └─▶ lib/custom-tool-runner.js (vm sandbox)
      ▼
lib/firestore/chat-history.js ──▶ chat-history Firestore DB (per customer)
lib/firestore/agent-usage.js  ──▶ default Firestore DB
```

This service has no database of its own for agent definitions — it is a stateless runtime that fetches an agent's graph from the admin platform, runs it, and only persists the *results* (chat history, leads, usage counters) into Firestore.

## Request lifecycle: loading an agent

Every route that serves an agent (`config`, `chat`, `conversation`) starts by calling `loadAgentConfig(agentId, requestOrigin)` (`src/agent-config-loader.js`):

1. Check the in-memory cache (`agent-cache.js`, keyed by `agentId`, TTL = `CONFIG_CACHE_TTL_MS`, default 60s).
2. **Cache hit:** the domain allowlist is still re-checked against the *current* request's origin (see [security.md](security.md)) — a domain removed from an agent's allowlist stops working within one TTL window, not only once the cache entry itself expires.
3. **Cache miss:** fetch fresh from the platform (`platform-client.js` → `GET {PLATFORM_BASE_URL}/api/public/agents/:id/config`, forwarding the visitor's origin as `x-embed-origin` and this service's `CDN_SHARED_SECRET` as `x-cdn-secret`), decrypt any `customTool` node configs (`lib/secrets.js`), extract `allowedDomains`/`dailyLimit`/`visitorDailyLimit` from the graph's Start node, cache the result, and return it.

`AgentConfigError` carries an HTTP status (404 agent not found, 403 domain not authorized) that route handlers propagate directly to the response.

## Request lifecycle: a chat turn (`POST /api/agents/:id/chat`)

1. Load the agent config (above).
2. If the conversation is already `jumpin` or `solved` (a human has taken over or closed it), skip the AI entirely — append the visitor's message if still `jumpin`, and return that status immediately. This guards against a client racing a status change mid-request.
3. Enforce `visitorDailyLimit` then `dailyLimit` (visitor cap checked first, so an over-limit visitor never burns the shared per-agent counter — see `lib/firestore/agent-usage.js`).
4. Run the graph (`runAgentGraph`, see [agent-execution.md](agent-execution.md)), streaming nothing mid-run — the public widget never sees "thinking"/tool-call progress events (unlike the admin platform's own test chat), only the final result.
5. Stream the result back as one `application/x-ndjson` line: `{"type":"final",...}` or `{"type":"error",...}`.
6. Persist the turn (`recordConversationTurn`) and any captured lead (`recordLead`) to the chat-history Firestore database, best-effort (a persistence failure is logged but doesn't fail the response — the visitor already has their reply).

## Caching layers

| Cache | File | Scope | TTL | Purpose |
| --- | --- | --- | --- | --- |
| Agent config | `agent-cache.js` | per `agentId`, process memory | `CONFIG_CACHE_TTL_MS` (default 60s) | Avoid round-tripping to the platform on every widget load/chat message |
| Tool call results | `agent-tool-cache.js` | per chat `sessionId` | 2h inactivity, capped at 500 sessions | Avoid re-running an idempotent tool (e.g. `read_google_doc_*`) if the model calls it again with identical args in the same conversation; write-style tools (append/create/update) are marked non-cacheable so they always execute |

Both caches are plain in-memory `Map`s — they reset on deploy/restart and are not shared across Cloud Run instances/revisions.

## Multi-tenancy within one deployment

Each `cdn-service` deployment serves **all** agents belonging to one customer (agents are looked up by `:agentId` in every route), but the deployment itself lives inside that customer's own GCP project. Isolation between customers is physical: separate GCP projects, separate Firestore databases (`FIRESTORE_PROJECT_ID`/`FIRESTORE_DATABASE_ID` for tool/usage data, `CHAT_HISTORY_PROJECT_ID`/`CHAT_HISTORY_DATABASE_ID` for chat transcripts), and separate Vertex AI billing (`GCP_PROJECT_ID`).
