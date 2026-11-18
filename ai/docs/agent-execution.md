# Agent execution

`src/lib/agent-runner.js` executes an agent's conversation graph. It's a line-for-line port of the admin platform's own `src/lib/agent-runner.ts`, so a graph behaves identically whether it's run from the admin's test chatbox or from a deployed `cdn-service`.

## The graph model

A graph is `{ nodes, edges }`. Node types relevant here:

- **start** — holds `allowedDomains`, `dailyLimit`, `visitorDailyLimit` in its `data` (read by `agent-config-loader.js`, not by the runner itself).
- **agent** — an LLM turn. `data` includes `systemPrompt`, `model`, `useChatHistory`, `allowHtmlOutput`, `allowHumanHandoff`, `collectLeads`, `bookingUrl`, `registrationFormUrl`.
- **condition** — routes to one of several `options` by asking Gemini to pick the best match for the current input text.
- **end** — terminates the run.
- **googleDocs / sheets / calendar / drive** — bound to an *agent* node as tools (see below), not part of the main node chain.
- **customTool** — same binding mechanism, backed by admin-authored JavaScript.

Edges connect `source` → `target` via a `sourceHandle`. An edge with `sourceHandle: "tools"` from an agent node attaches a tool node to that agent rather than continuing the main flow; any other edge is the "next node" link (or, for a `condition` node, is keyed by the chosen option's id).

## Top-level run (`runAgentGraph`)

```
runAgentGraph(graph, history, sessionId, scopeId, onNode?, onThinking?)
```

1. Find the `start` node; bail out with a friendly message if there isn't one.
2. Walk forward up to 20 hops via `resolveNext`, following the plain "next" edge for most node types or `pickConditionTarget` for `condition` nodes.
3. Stop at an `end` node, or after 20 hops.
4. Each `agent` node encountered is executed via `runAgentNode`; its text output becomes the input to whatever comes next. `allowHtml` on the final reply reflects the *last* agent node's `allowHtmlOutput`.
5. If no `agent` node ever ran, returns a placeholder telling the admin to connect one.
6. Returns `{ reply, allowHtml, wantsHumanHandoff, capturedLead }`.

`onNode`/`onThinking` callbacks exist for the admin platform's live "thinking" UI; `cdn-service`'s own `POST /chat` route calls `runAgentGraph` without them, so the public widget never sees intermediate tool-call detail.

## Running one agent node (`runAgentNode`)

1. Build the Gemini function-calling `tools` declarations for whatever's bound to this node (`buildToolsForAgent`, see below), plus a synthetic lead-capture tool if `data.collectLeads` is set.
2. Build `contents`: the full history (as Gemini `contents`) if `data.useChatHistory`, otherwise none — then append the current input turn if it isn't already the last history entry.
3. Append extra system-prompt instructions for human handoff / lead capture (`buildSystemPrompt`) — these are the literal instructions steering the model to emit `[[JUMPIN_REQUEST]]` or call the lead tool; see below.
4. Loop (max **8** iterations): call `generateContent` (Vertex AI). If it returns function calls, execute each (checking the per-session tool-result cache first — see `agent-tool-cache.js`), append `functionResponse` parts, and loop again. Otherwise, treat the text as the final answer, strip any handoff marker, and return.
5. If the loop exhausts 8 iterations without a plain-text answer, make one final call with no tools attached to force a text response.

## Tool binding (`buildToolsForAgent`)

For each tool node connected to the agent node via a `tools`-handle edge:

- **Google Workspace nodes** (`googleDocs`/`sheets`/`calendar`/`drive`): generates one Gemini function declaration per capability the node's `permission` (`read`/`write`) allows, named e.g. `read_google_doc_<slug>` / `write_sheet_<slug>` / `list_events_<slug>` / `create_event_<slug>` / `list_drive_files_<slug>` / `read_drive_file_<slug>` / `create_drive_file_<slug>` / `edit_drive_file_<slug>`, where `<slug>` is the last 12 sanitized characters of the node id. Dispatches to `src/lib/google-workspace.js`, which calls the real Docs/Sheets/Calendar/Drive APIs via a service-account `GoogleAuth` client (scopes: documents, spreadsheets, calendar, drive). Write-style calls (append/create/update) are marked non-cacheable.
- **customTool nodes**: looked up by `data.toolId` in Firestore (`getCustomTool`); skipped if missing or has no code. Declares one function `custom_tool_<slug>` whose parameters come from the tool's `args` definition. Dispatches to `runCustomToolCode` (see below), passing the node's `data.config` and the model's call arguments; a non-`ok` result is surfaced to the model as `"Error: <message>"` rather than throwing.

Tool names are namespaced by node id (`slug()`), not tool id, so the same custom tool bound at two different nodes gets two distinct function names.

## Human handoff

If `data.allowHumanHandoff` is set on an agent node, the system prompt gains an instruction telling the model to end its reply with a literal `[[JUMPIN_REQUEST]]` line when the visitor clearly asks for a human. `extractHandoff` strips that marker out of the text before it's ever returned — the visitor never sees the token, only its effect (`wantsHumanHandoff: true` → the calling route sets `status: "jumpin"`, and the widget switches into polling mode).

Right at the AI → `jumpin` transition, both callers (`routes/chat.js`, `lib/channel-pipeline.js`) call `notifyHandoff` (`src/lib/notify-handoff.js`). It emails every active team member tagged `support`, from the shared Gmail sender with the From name set to `CUSTOMER_COMPANY_NAME` and `Reply-To` set to this panel's own admin (the bootstrap admin, else the longest-standing active admin, read from `team` at send time). The body has the visitor's display name, the channel, the last visitor message (escaped, 200 chars) and the waiting-since time. It sends at most one email per conversation per 10 minutes. It never throws and never fails silently: each attempt logs one `[handoff-mail] sent|skipped|failed|throttled: …` line naming the missing piece (e.g. `GMAIL_SENDER_EMAIL, PANEL_BASE_URL unset`) and stores the outcome as `handoffNotification` on the conversation doc, which the panel shows in the conversation header. Reasons: `mail_not_configured`, `panel_url_missing`, `no_recipients`, `token_expired` (Gmail answered `invalid_grant`: the refresh token was revoked or expired), `send_failed`, `error`.

Once a conversation is `jumpin`, `POST /chat` stops running the AI for that session entirely (see `routes/chat.js`); visitor messages go through `POST /message` instead, and a human replies out-of-band (from the customer-panel app), which the widget picks up by polling `GET /conversation/:sessionId` every 3 seconds.

## Lead capture

If `data.collectLeads` is set, a synthetic `submit_lead_contact_details` function is added to the declarations, alongside a system-prompt instruction telling the model to ask for name/email/phone once it can't otherwise help, and to call the function (with an inferred `interest` summary) once it has all three. The dispatcher just captures the args into `capturedLead`; it's returned up through `runAgentNode` → `runAgentGraph` → the chat route, which persists it as a `leads` document if present.

If `data.registrationFormUrl` is set, the system prompt tells the model it may share that registration form (a Google Form for creating the customer's Google Workspace: domain, company name, TAX ID, address), or take the same answers in chat. A synthetic `save_workspace_registration` function is declared with those fields plus `contactName`/`email`/`phone`, all optional; the model calls it as soon as the visitor gives any of them. Captured fields merge into `capturedRegistration`, and the chat route / channel pipeline pass them to `recordRegistration`, which in one transaction merges them into `conversation.registration`, rewrites a single "AI assistant" team note (`notes/registration`) on the conversation, and upserts one lead per conversation (`leads/registration-<conversationId>`, `source: "registration"`).

## Condition nodes

`pickConditionTarget` builds a numbered-list prompt from the node's `options`, asks Gemini (no tools, no history) to answer with a single number, parses the first digit sequence out of the reply (clamped into range, defaulting to option 0 on a bad response), then follows the edge whose `sourceHandle` equals the chosen option's id.

## Custom tool sandboxing

`src/lib/custom-tool-runner.js` executes admin-authored JavaScript inside Node's `vm` module — ported from the platform's own `src/lib/custom-tool-runner.ts`.

- The sandbox exposes only `config`, `args`, `fetch`, `require` (a restricted version, see below), `console` (log/error/warn, captured into an array rather than the real stdout), `JSON`, `Math`, `Date`, `URL`, `URLSearchParams`, `setTimeout`/`clearTimeout`.
- Code is wrapped as `(async () => { ...code... })()` and run with a `vm.Script` timeout of 5s, plus an outer `Promise.race` hard limit of 15s (`EXECUTION_TIMEOUT_MS`).
- **npm modules**: a tool declares dependencies via one `//> package-name` comment per line at the very top of its code (parsing stops at the first non-comment line). Each declared name must match a plain package-spec regex and must not be one of the blocked Node builtins (`fs`, `child_process`, `net`, `http(s)`, `vm`, `process`, `os`, etc. — the same list the platform enforces). `require()` inside the sandbox only resolves modules that were declared this way; anything else throws.
- **Per-scope install directories**: each custom tool run is scoped by `scopeId` (the chat route passes `` `widget:${agentId}` ``), which maps to its own directory under `.tool-modules/<sanitized-scope>/`. Missing declared packages are installed there via `npm install` (spawned as a child process, 120s timeout), deduped across concurrent calls into the same scope, and every successful install is recorded to the `moduleInstalls` Firestore collection for auditing.
- A failed/erroring run returns `{ ok: false, error, stack?, logs, durationMs }` rather than throwing, so a broken tool degrades to an error string the model sees, not a crashed request.
