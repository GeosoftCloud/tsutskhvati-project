# Data model

All collections below live in this platform's own central Firestore database (`GCP_PROJECT_ID`/`FIRESTORE_DATABASE_ID`, client in `src/lib/firestore/client.ts`). Types are defined in `src/types/index.ts`; each collection has its own module under `src/lib/firestore/`.

## `customers`

```ts
type CustomerStatus = "pending" | "awaiting_panel_access" | "active" | "disabled";

type Customer = {
  id, companyName, companyEmail, companyPhone, companyDomain,
  adminName, adminEmail, adminPhone,
  billingAccountId, gcpProjectId, status: CustomerStatus, createdBy, createdAt,
  billingSpend: CustomerBillingSpend | null,               // current-value convenience column
  billingSpendByMonth: Record<string, CustomerBillingSpend>, // "YYYY-MM" -> spend, full history
  serviceAccount: CustomerServiceAccount | null,             // { email, keyJson, createdAt }
  cdnService: CustomerCdnService | null,                     // { url, status, error?, deployedAt }
  customerPanel: CustomerCustomerPanel | null,                // { url, status, error?, deployedAt }
  onboardingEmailSentAt: string | null,
};
```

Status progression is one-directional and system-driven, not admin-editable directly: `pending` (just registered, GCP provisioning/deploys in flight) → `awaiting_panel_access` (both `cdnService` and `customerPanel` report `status: "deployed"` — set by `markAwaitingPanelAccessIfFullyDeployed`, guarded to only fire once) → `active` (an admin manually confirms the customer-panel OAuth redirect URI was added, via `grantPanelAccess`, guarded to require `awaiting_panel_access`). `disabled` exists in the type but no code path in this codebase currently sets it (`updateCustomerStatus` is generic, so it's a lever available for future/manual use).

`getEffectiveBillingSpendByMonth(customer)` reconciles `billingSpendByMonth` with the older single-value `billingSpend` field for customers that predate per-month tracking, or whose first webhook notification for the current month hasn't landed yet.

See [customer-lifecycle.md](customer-lifecycle.md) for how each field gets populated during provisioning.

## `agents`

```ts
type Agent = {
  id, customerId, name,
  deliveryMode: "widget" | "api",   // chosen at creation: embeddable CDN widget vs headless JSON API
  apiKey?: string,                  // AES-256-GCM encrypted at rest; used for server-to-server calls in "api" mode
  graph: AgentGraph,                // live draft — customTool node configs stored encrypted
  coverSvg: string,                 // auto-generated mini diagram, regenerated on every graph save
  generation: AgentGenerationMeta, // { description, functionality, model, todo } from the last LLM generation
  chatbox: ChatboxConfig,           // draft chatbox styling/scripts/starters
  createdBy, createdAt, updatedAt,
  publishedGraph: AgentGraph | null,       // snapshot served to real visitors, via "Publish"
  publishedChatbox: ChatboxConfig | null,
  publishedAt: string | null,
};
```

The draft (`graph`/`chatbox`) and the published snapshot (`publishedGraph`/`publishedChatbox`) are deliberately separate — editing and saving an agent never affects live visitor traffic until an admin clicks **Publish** (`publishAgentAction` → `publishAgent()`), which copies the current draft over. `GET /api/public/agents/[id]/config` (called by `cdn-service`) only ever serves the published snapshot, and 404s if the agent has never been published.

`customTool` node `data.config` values are AES-256-GCM encrypted at rest (`encryptGraphToolConfigs`/`decryptGraphToolConfigs`, `src/lib/secrets.ts`) — every write path through `saveAgentGraph` encrypts, every read path that needs real values (`api/agents/[id]/run`, the builder page, `publishAgentAction`'s re-fetch) explicitly decrypts. See [agent-builder.md](agent-builder.md#secrets).

### `AgentGraph` shape

```ts
type NodeType = "start" | "end" | "agent" | "condition" | "googleDocs" | "sheets" | "calendar" | "drive" | "customTool";
type FlowNode = { id, type: NodeType, position: {x,y}, data: Record<string, unknown> };
type FlowEdge = { id, source, target, sourceHandle?, targetHandle? };
type AgentGraph = { nodes: FlowNode[]; edges: FlowEdge[] };
```

Per-type `data` shapes (`StartNodeData`, `AgentNodeData`, `ConditionNodeData`, `GoogleToolNodeData`, `CustomToolNodeData`) are documented in [agent-builder.md](agent-builder.md).

## `customTools`

```ts
type CustomTool = {
  id, name, description, icon, functionality, model, code,
  fields: CustomToolField[],   // static per-instance config the admin fills in the node editor
  args: CustomToolArgument[],  // per-call parameters the calling agent's LLM supplies
  saved: boolean,               // drafts (saved: false) are invisible to listCustomTools()
  createdBy, createdAt, updatedAt,
};
```

Tools are **global** — not scoped to a customer — reusable across any agent for any customer. `listCustomTools()` filters to `saved: true` client-side (to avoid a composite index); `listAllCustomTools()` returns everything including drafts, used for cross-tool checks like "is this npm module still needed by some other tool" during deletion.

## `moduleInstalls`

One doc per `(toolId, module, scopeId)` triple, recorded whenever a custom tool's declared npm package is installed (see [agent-builder.md](agent-builder.md#custom-tool-sandbox)):

```ts
type ModuleInstall = { id, module, toolId, toolName, scopeId, installedAt };
```

Uses a deterministic doc id plus `.create()` (not `.set()`) so a re-install (e.g. after a Cloud Run cold start wipes local `.tool-modules/`) doesn't pile up duplicates — a `code === 6` (ALREADY_EXISTS) is swallowed. `listAllModuleInstalls()` de-dupes to the earliest record per key when reading, as a defense against any older duplicates that predate this convention.

## `teamMembers`

```ts
type Permission = "read" | "write";
type TeamMember = { id, email, name, permission: Permission, isAdmin: boolean, status: "active"|"disabled", invitedBy: string|null, createdAt };
```

See [auth-and-permissions.md](auth-and-permissions.md) for the full permission model. Distinct from `customer-panel`'s own `team` collection, which lives in each customer's separate `chat-history` database.

## `tickets` / `ticketMessages`

```ts
type TicketStatus = "pending" | "working" | "solved";
type Ticket = {
  id, customerId, customerName,        // denormalized at creation
  subject, description,
  reporterName, reporterEmail,          // the customer-panel member who filed it — platform has no visibility into their team collection, so this is passed through as-is
  status: TicketStatus, createdAt, updatedAt,
  unseenByAdmin: number, unseenByCustomer: number,
};
type TicketMessageSender = "admin" | "customer";
type TicketMessage = { id, ticketId, sender: TicketMessageSender, senderName, senderEmail, text, createdAt };
```

Status transitions are guarded, not free-form: `updateTicketStatus` only allows the forward path `pending → working → solved` (`VALID_TRANSITIONS`, throws otherwise); `reopenTicket` is the one allowed backward transition (`solved → pending`), gated on its own precondition and callable by the customer side. `createTicketMessage` always calls `incrementUnseenForRecipientOf` — the *other* side's unseen counter — so `tickets.ts` stays the sole writer of the `tickets` collection itself even though messages live in a separate collection.

## `agentUsage`

Same shape and purpose as `cdn-service`'s own copy (they're independent implementations of the same scheme, not a shared table — the two apps write to different documents for the same agent since the admin test chat and real visitor traffic are tracked separately... actually they share the *same* collection and doc-id scheme when `cdn-service`'s `FIRESTORE_PROJECT_ID` points at this central project, so a `dailyLimit` cap is enforced jointly across dashboard test runs and public widget traffic):

```
doc "${agentId}_${date}"                      -> { agentId, date, count }              // consumeDailyMessage
doc "${agentId}_visitor_${visitorId}_${date}" -> { agentId, visitorId, date, count }   // consumeVisitorDailyMessage
```

`date` is `YYYY-MM-DD` UTC. The admin test chatbox scopes its own "visitor" id to `session.user.memberId` (or email) rather than a real visitor id, and `resetAgentTestUsageAction` clears just that scoped counter — so an admin can reset their own test quota without touching real visitor counts.

## `platformSettings`

Single document (`billing`) holding this platform's own GCP project spend history:

```ts
type PlatformBillingSpend = CustomerBillingSpend; // { amount, currencyCode, updatedAt }
// doc "billing" -> { billingSpendByMonth: Record<string, PlatformBillingSpend> }
```

Populated by the same `POST /api/billing/webhook` that populates each customer's `billingSpend`/`billingSpendByMonth` — routed by comparing the incoming budget notification's project id against `process.env.GCP_PROJECT_ID`.
