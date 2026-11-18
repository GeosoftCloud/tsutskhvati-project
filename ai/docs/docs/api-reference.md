# API reference

Nearly all UI-driven mutations are Server Actions, not routes — see each feature's own docs page. This covers everything under `src/app/api/`.

## Admin-session routes (require a signed-in team member)

### `POST /api/agents/[id]/run`

The admin test chatbox. Requires only a signed-in session (any `permission`, since this doesn't mutate the agent). Body: `{ history: ChatTurn[], sessionId?: string }`. Looks up the agent's owning customer to get their `serviceAccount.keyJson` (so Workspace tool calls run as that customer's own service account), decrypts `customTool` configs, and streams ndjson: `{type:"node", id, nodeType, label}` per node visited, `{type:"thinking", nodeId, toolName, args, result?, cached, error?}` per tool call, then `{type:"final", reply, allowHtml}` or `{type:"error", message}`. Enforces the agent's `dailyLimit`/`visitorDailyLimit` exactly like `cdn-service` does, scoped to `session.user.memberId`/email as the "visitor".

### `POST /api/agents/[id]/generate-schema`

Requires `canWrite()`. Body: `{ description, functionality, model }`. Streams `{type:"status", message}` progress events (including per-new-tool-created messages), then `{type:"done", graph, todo, createdToolsCount}` or `{type:"error", message}`. Persists `generation` metadata (`saveAgentGenerationMeta`) but not the graph itself — see [agent-builder.md](agent-builder.md#agent-schema-codegents--generate-an-entire-agent-graph).

### `POST /api/customers/register`

Requires `canWrite()`. Body: the registration form fields (`companyName`, `companyEmail`, ..., `billingAccountId`). Streams `{type:"stage", stage, label}` through the full provisioning pipeline (see [customer-lifecycle.md](customer-lifecycle.md)), then `{type:"done", customerId}` or `{type:"error", message}`. Note the deploy steps themselves continue in the background (`after()`) past whenever this stream closes — closing the stream does not mean deployment finished.

### `POST /api/customers/[id]/retry`

Requires `canWrite()`. Not streamed — returns `{ok: true}` immediately once it has flipped the failed side(s) to `pending` and kicked off `after()` background work; the UI relies on Firestore reads / `revalidatePath` for progress, not this response.

## Public, server-to-server routes (`src/app/api/public/**`)

All gated by a shared secret: `x-cdn-secret` header must equal `process.env.CDN_SHARED_SECRET`. No session cookie is ever checked — the caller is always another server (a customer's deployed `cdn-service` or `customer-panel`), never a browser directly.

On top of that auth header, every request and response body on these routes is wrapped in an
encrypted envelope (`src/lib/system-crypto.ts`, key `SYSTEM_API_SECRET`) — GET params travel as
`?payload=<ciphertext>` (decrypting to the params object, e.g. `{ customerId }`) instead of plain
query params, POST bodies travel as `{ payload: <ciphertext> }` instead of the plain JSON shown
below, and every response body (success or error) is `{ payload: <ciphertext> }` decrypting to the
shapes described here. This is a second, independent layer on top of the `x-cdn-secret` auth check
— see `cdn-service/docs/security.md` for the wire format.

### `GET /api/public/agents/[id]/config`

Called by `cdn-service`. No `x-cdn-secret` requirement to respond (it degrades gracefully — see below) but the secret changes what's trusted as the visitor's origin. Serves the agent's **published** snapshot only — 404s with "hasn't been published yet" if `publishedGraph`/`publishedChatbox` are null, even if the draft has been saved. Domain allowlist enforced here too (deny-by-default), matching `cdn-service`'s own re-check — this is the authoritative check; `cdn-service`'s is a fast-path cache validity check on top of it. Takes no request payload (no query params); only the response is encrypted.

If `x-cdn-secret` matches, trusts the forwarded `x-embed-origin` header (the *visitor's* real page origin) for the allowlist check. Otherwise falls back to this request's own `Origin`/`Referer` — useful for direct manual testing, but not a path a real browser embed would ever hit (a browser calls `cdn-service`, not this route, directly).

### `GET /api/public/agents/count?payload=`

Called by `customer-panel`'s dashboard. Requires the shared secret. Decrypted params: `{ customerId }`. Returns `{ count }` — `countAgentsForCustomer`.

### `GET /api/public/billing?payload=`

Called by `customer-panel`'s dashboard. Requires the shared secret. Decrypted params: `{ customerId }`. Returns `{ billingSpendByMonth }` via `getEffectiveBillingSpendByMonth`.

### `GET/POST /api/public/tickets?payload=` / body `{ payload }`

Called by `customer-panel`. `GET` decrypted params `{ customerId }`, returns `{ tickets }` (`listTicketsByCustomer`). `POST` decrypted body `{ customerId, subject, description, reporterName, reporterEmail }` creates a ticket (`status: "pending"`), returns `{ ticket }` with `201`.

### `GET/POST /api/public/tickets/[id]/messages?payload=` / body `{ payload }`

`GET` decrypted params `{ customerId }`, returns `{ messages }`. `POST` decrypted body `{ customerId, text, reporterName, reporterEmail }` — **only accepted while `ticket.status === "working"`** (403 otherwise); creates an `admin`... actually `sender: "customer"` message and bumps `unseenByAdmin`. Ownership check: `ticket.customerId !== customerId` → 404 (not 403), so a mismatched id doesn't confirm a ticket exists under a different customer.

### `POST /api/public/tickets/[id]/seen`

Decrypted body `{ customerId }`. Clears `unseenByCustomer` to 0 — called whenever a customer-panel member opens a ticket's chat.

### `POST /api/public/tickets/[id]/reopen`

Decrypted body `{ customerId, reason, reporterName, reporterEmail }`. Only valid from `status: "solved"` (delegates the guard to `reopenTicket()`, returns 400 on violation). Records `reason` as a new customer message directly via `createTicketMessage` — deliberately bypassing the sibling messages route's "only while working" gate, since reopening is the one case a customer message during a non-`working` status is intentional.

## External webhook

### `POST /api/billing/webhook`

Google Cloud Pub/Sub push endpoint for Cloud Billing budget alert notifications. **Not** gated by `x-cdn-secret** — authenticated via OIDC: verifies the `Authorization: Bearer <token>` against `BILLING_WEBHOOK_AUDIENCE` using `google-auth-library`'s `OAuth2Client.verifyIdToken`. Decodes the Pub/Sub envelope's base64 `message.data` into `{ budgetDisplayName, costAmount, currencyCode, costIntervalStart }` — `budgetDisplayName` is actually the GCP **project id** the budget was scoped to (see `upsertProjectBudget` in [customer-lifecycle.md](customer-lifecycle.md)). Routes to `setPlatformBillingSpend` if it matches this platform's own `GCP_PROJECT_ID`, otherwise looks up the customer by `gcpProjectId` and calls `setCustomerBillingSpend`. Silently no-ops (`{ok: true}`) on any malformed/unrecognized payload rather than erroring, since Pub/Sub will otherwise retry-storm a permanently-unparseable message.
