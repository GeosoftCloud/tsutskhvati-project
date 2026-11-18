# geosoft-agents documentation

Technical documentation for the root admin platform (`geosoft-agents`) — the internal Next.js app Geosoft staff use to build AI agents and custom tools, onboard customers, and provision that customer's dedicated `cdn-service`/`customer-panel` deployments. For setup/env vars/run instructions, see the [project README](../README.md).

- [Architecture](architecture.md) — the three-app system, tech stack, request model
- [Auth & permissions](auth-and-permissions.md) — the team whitelist, `read`/`write` permission, admin flag, middleware enforcement
- [Data model](data-model.md) — every Firestore collection this platform owns
- [Agent builder](agent-builder.md) — the graph model, LLM-assisted schema/chatbox/tool generation, the agent runner, custom-tool sandboxing
- [AI Agent Structure & Builder Spec](agent-structure-and-builder-guide.md) — standalone specification, complete node/edge/tool reference, and importable JSON examples for AI agents building Geosoft agents
- [Headless Agent API](custom-ui-api.md) — API-only mode (`/api/v1/agents/:id/*`) for clients building custom website chatbot UIs
- [Client & AI UI-Builder Spec](client-chatbot-ui-api-guide.md) — standalone handoff document for client developers or AI coding agents building a custom chatbot UI
- [Customer lifecycle](customer-lifecycle.md) — registration, GCP provisioning, the cdn-service/customer-panel deploy pipeline, retry, panel access, offboarding
- [API reference](api-reference.md) — every route under `src/app/api`, admin and public
- [Deployment & operations](deployment-and-ops.md) — this app's own CI/CD, Dockerfile, one-off scripts, billing webhook setup

## Source map

| Area | Files |
| --- | --- |
| Auth | `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/lib/permissions.ts`, `src/types/next-auth.d.ts` |
| Customers | `src/app/(app)/customers/**`, `src/app/api/customers/**`, `src/lib/firestore/customers.ts`, `src/lib/gcp-projects.ts`, `src/lib/gcp-billing.ts` |
| Agents / graph builder | `src/app/(app)/agents/**`, `src/app/api/agents/**`, `src/lib/firestore/agents.ts`, `src/lib/agent-runner.ts`, `src/lib/agent-schema-codegen.ts`, `src/lib/chatbox-codegen.ts`, `src/lib/cover-svg.ts`, `src/lib/agent-tool-cache.ts` |
| Custom tools | `src/app/(app)/tools/**`, `src/lib/firestore/custom-tools.ts`, `src/lib/custom-tool-codegen.ts`, `src/lib/custom-tool-runner.ts`, `src/lib/firestore/module-installs.ts` |
| Team | `src/app/(app)/team/**`, `src/lib/firestore/team.ts` |
| Tickets | `src/app/(app)/tickets/**`, `src/app/api/public/tickets/**`, `src/lib/firestore/tickets.ts`, `src/lib/firestore/ticket-messages.ts` |
| Billing | `src/app/api/billing/webhook/route.ts`, `src/app/api/public/billing/route.ts`, `src/lib/gcp-billing.ts`, `src/lib/firestore/platform.ts` |
| Per-customer deployment | `src/lib/gcp-deploy-shared.ts`, `src/lib/cdn-deploy.ts`, `src/lib/customer-panel-deploy.ts`, `src/lib/customer-panel-team.ts` |
| Google/Vertex AI clients | `src/lib/google-auth.ts`, `src/lib/vertex-ai.ts`, `src/lib/google-workspace.ts`, `src/lib/gemini-models.ts` |
| Secrets & security | `src/lib/secrets.ts`, `src/lib/domain-allowlist.ts` |
| Email | `src/lib/mail.ts` |
| Shared types | `src/types/index.ts` |
| Scripts | `scripts/seed-admin.mjs`, `scripts/get-gmail-refresh-token.mjs`, `scripts/setup-billing-webhook.mjs`, `scripts/redeploy-cdn-service.ts`, `scripts/redeploy-customer-panel.ts` |
