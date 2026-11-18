# Agent builder

## The graph model

An agent is a node/edge graph (`AgentGraph` — see [data-model.md](data-model.md#agents)), edited visually with `@xyflow/react` in `src/components/builder/` and executed by `src/lib/agent-runner.ts`. Node types:

- **start** — entry point. `data: StartNodeData` holds `dailyLimit` (total messages/day across all visitors), `visitorDailyLimit` (per-visitor), and `allowedDomains` (the widget's domain allowlist — see [cdn-service's security docs](../cdn-service/docs/security.md), since this list is enforced there and in `GET /api/public/agents/[id]/config`, not by the runner itself).
- **agent** — one Gemini call. `data: AgentNodeData` — `systemPrompt`, `useChatHistory`, `allowHtmlOutput`, `allowHumanHandoff`, `collectLeads`, `bookingUrl`, `registrationFormUrl`, `model`.
- **condition** — an AI-routed branch. `data: ConditionNodeData` — `conditionPrompt`, `options: {id, label}[]`, `model`. Routes via a dedicated Gemini call that picks one option by number.
- **googleDocs / sheets / calendar / drive** — leaf nodes representing one specific Workspace resource. `data: GoogleToolNodeData` — `name`, `description`, `resourceId`, `permission: "read"|"write"`. Only usable by being bound to an agent node's tools (via a `sourceHandle: "tools"` edge) — never continue the main flow themselves.
- **customTool** — a leaf node calling a `CustomTool` document. `data: CustomToolNodeData` — `toolId`, `name`, `description`, `icon`, `config` (encrypted at rest).
- **end** — terminates the run.

## Running a graph (`src/lib/agent-runner.ts`)

This file is **line-for-line duplicated** into `cdn-service/src/lib/agent-runner.js` (a plain-JS port, since `cdn-service` is a separate deployable with no build step) — see [cdn-service/docs/agent-execution.md](../cdn-service/docs/agent-execution.md) for the full walk-through of `runAgentGraph`/`runAgentNode`/tool binding/human handoff/lead capture/the 8-iteration function-calling loop, all identical here. The two genuine differences on the admin side:

1. **Google Workspace calls take an explicit `googleServiceAccountKeyJson`** parameter, threaded all the way from the route handler down through `buildToolsForAgent`. `POST /api/agents/[id]/run` looks this up as `customer.serviceAccount.keyJson` — the admin test chatbox impersonates that specific customer's own service account (provisioned at registration, see [customer-lifecycle.md](customer-lifecycle.md)) so Docs/Sheets/Calendar/Drive access matches exactly what the deployed `cdn-service` would see. `cdn-service` itself doesn't need this parameter since it *is* already running as that service account via `GOOGLE_APPLICATION_CREDENTIALS`.
2. **`onNode`/`onThinking` callbacks are actually wired up** here: `POST /api/agents/[id]/run` streams `{type: "node", ...}` and `{type: "thinking", ...}` ndjson events for the builder's live "thinking" UI, showing which node is executing and what each tool call returned. `cdn-service`'s own chat route calls `runAgentGraph` without these callbacks — the public widget never sees this internal detail.

Everything else — the `MAX_ITERATIONS = 8` function-calling loop, the `[[JUMPIN_REQUEST]]` human-handoff marker, the `submit_lead_contact_details` and `save_workspace_registration` synthetic tools (the test chat's registration tool saves nothing), per-session tool-result caching (`agent-tool-cache.ts`), condition-node routing — is identical logic to `cdn-service`.

## LLM-assisted generation

Three separate codegen modules, all built on `src/lib/vertex-ai.ts`'s `generateContent()` with a JSON `responseSchema` (structured output, not free-form text parsing):

### `agent-schema-codegen.ts` — generate an entire agent graph

`generateAgentSchema({ description, functionality, model, customTools, createdBy })`, invoked by `POST /api/agents/[id]/generate-schema`. Given a plain-English description, asks Gemini for a `{ nodes, newTools, todo }` structure using **tempIds** (not real Firestore/graph ids) and a simplified topology (`next`, `options[].next`, `tools[]`, `newToolRef`) — the prompt includes a full worked example agent and an explicit list of node-type rules (start/end mandatory, leaves must be tool-bound, etc).

The function then:
1. **Repairs structural violations** the model still occasionally produces — missing/duplicate Start node, missing End node, dangling branches — by synthesizing/rewiring rather than failing the generation, appending a human-readable note to `todo` for each repair.
2. **Creates any requested brand-new custom tools** (`newTools` entries) by calling `generateCustomToolCode()` (below) for each and persisting them via `createCustomTool()` — so "the agent needs a tool that doesn't exist yet" is handled in the same request, not a separate step.
3. **Auto-repairs orphan leaf nodes** — a Google Workspace/customTool node the model created but forgot to bind to any agent — by attaching it to the agent closest to Start, rather than leaving it permanently unreachable in the editor.
4. Materializes real node/edge ids, lays the graph out left-to-right by BFS layer from Start (tool leaves positioned under their owning agent), and returns `{ graph, todo, createdTools }`. The caller (`generate-schema/route.ts`) persists `generation` metadata but does **not** save the graph itself — the builder UI presents it as a proposal the admin can review before saving.

### `chatbox-codegen.ts` — generate widget styling/copy

`generateChatboxContent({ agentName, description, model, current })` — produces per-locale starter messages + quick replies, custom CSS (targeting the real `.geosoft-chatbox*` class names the widget renders — see [cdn-service/docs/widget.md](../cdn-service/docs/widget.md)), and custom JS. Locale selection: explicit languages named in the description win; otherwise it refines whatever locales already exist; otherwise defaults to `en`. Always regenerates the **full** value of every field (not a diff), but is prompted with the current configuration as a baseline to refine rather than replace outright.

### `custom-tool-codegen.ts` — generate a custom tool's code

`generateCustomToolCode({ name, description, functionality, model })` and `fixCustomToolCode({ ..., testOutput, note })`. Produces the **body** of an implicit `async function run(config, args)`, plus `fields` (static config, always starting with fixed `name`/`description` entries) and `args` (per-call parameters the calling agent's LLM fills in). The fix variant is given the tool's last test-run output (result/error/stack/console logs) and an optional developer note, and is told explicitly to check for missing `//> package-name` declarations if the failure looks like an unresolved module.

## Cover SVG (`cover-svg.ts`)

`generateCoverSvg(graph)` renders a tiny abstract diagram (colored rects per node type + connecting lines, scaled into a fixed viewBox) purely from node positions/types/edges — no text, no real layout fidelity. Regenerated on every `saveAgentGraph()` call and stored as `agent.coverSvg`, used as a lightweight visual thumbnail on the Agents list page instead of a screenshot or a heavier live-rendered preview.

## Custom tool sandbox

`src/lib/custom-tool-runner.ts` is the same `vm`-based sandboxing model as `cdn-service`'s port — see [cdn-service/docs/security.md#custom-tool-sandbox](../cdn-service/docs/security.md#custom-tool-sandbox) for the full mechanism (blocked builtins, `//> package` declarations, per-scope `.tool-modules/<scope>/` install directories, 5s/15s timeouts). Two admin-only additions not present in `cdn-service`'s copy:

- **`getDeclaredModuleNames(code)`** — parses just the `//>` header without running anything, used by `tools/actions.ts`'s `deleteCustomToolAction` to check whether *other* still-existing tools declare the same module before deciding it's safe to uninstall.
- **`removeUnusedModules(scopeId, moduleNames)`** — runs `npm uninstall` in a scope's `.tool-modules/<scope>/` directory, best-effort (logs and swallows failures). Called when a tool is deleted and none of its declared packages are needed by any other tool in that same scope anymore.

Scoping here uses `session.user.memberId` (or email) as the `scopeId` for admin test-runs (`runCustomToolTestAction`), and `` `widget:${agentId}` `` when the graph runs for real via `cdn-service` — so a tool's admin-side test-run dependencies are isolated per team member, not shared with (or cleaned up by) production traffic's own scope.

## Secrets

`src/lib/secrets.ts` — AES-256-GCM, `TOOL_CONFIG_ENCRYPTION_KEY` (base64, 32 bytes). `encryptGraphToolConfigs`/`decryptGraphToolConfigs` operate on every `customTool` node's `data.config` in a graph. Centralizing this in `src/lib/firestore/agents.ts`'s write path (`saveAgentGraph` always encrypts before writing) means every other consumer of an agent's graph — the builder editor, the test-chat run route, `publishAgentAction`'s re-fetch — either explicitly decrypts via `decryptGraphToolConfigs()` or (for `GET /api/public/agents/[id]/config`) deliberately forwards the still-encrypted blob to `cdn-service`, which holds the identical key (`TOOL_CONFIG_ENCRYPTION_KEY` baked into its deployment by `cdn-deploy.ts`) and decrypts it there, right before running a tool. The plaintext key itself never has to leave this platform's own environment.
