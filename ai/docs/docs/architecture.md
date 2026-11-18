# Architecture

## The three-app system

This repository builds **three** separate deployables, but only the root app is documented here (see [cdn-service/docs](../cdn-service/docs/README.md) and [customer-panel/docs](../customer-panel/docs/README.md) for the other two):

```
┌─────────────────────────────────────────────────────────────────┐
│                    Root admin platform (this app)                │
│  Next.js — Firestore (central "customers"/"agents"/"customTools"│
│  /"teamMembers"/"tickets"/"agentUsage"/"platformSettings")       │
│  Vertex AI (Gemini) for agent test-runs + LLM-assisted codegen  │
└──────────────┬─────────────────────────────┬────────────────────┘
               │ provisions + deploys         │ provisions + deploys
               ▼                              ▼
   ┌───────────────────────┐      ┌───────────────────────────┐
   │  cdn-service           │      │  customer-panel           │
   │  (per customer's own   │      │  (per customer's own      │
   │   GCP project)         │      │   GCP project)             │
   └───────────┬────────────┘      └────────────┬───────────────┘
               │                                 │
               └──────────► chat-history Firestore (customer's own project) ◄─────┘
```

The root app is the **only** place agents and custom tools are authored. It never runs a customer's *published* agent for real visitor traffic — that's `cdn-service`'s job, running inside the customer's own GCP project. The root app does run agents itself for the **admin test chatbox** (`POST /api/agents/[id]/run`), using a line-for-line duplicate of the same graph-execution logic (see [agent-builder.md](agent-builder.md)).

## Tech stack

- Next.js 16.3.0 (App Router), React 19.2.8, TypeScript 5
- Auth.js / NextAuth v5 (beta), Google OAuth
- Google Cloud Firestore (`@google-cloud/firestore`) — the platform's only database
- Google Vertex AI (Gemini) via REST, for both agent execution and LLM-assisted generation (schema/graph, chatbox content, custom tool code)
- `googleapis` / `google-auth-library` — provisions GCP projects, service accounts, IAM bindings, Cloud Build, Artifact Registry, Cloud Run, Cloud Billing budgets/Pub-Sub, all via direct API calls (no `gcloud` CLI, no Terraform)
- `@xyflow/react` — the visual graph builder canvas
- CodeMirror (`@uiw/react-codemirror`) — the custom-tool code editor
- Tailwind CSS 4, Radix UI / shadcn primitives, `recharts` for billing charts, `tar` for packing deploy source archives

## Request model

Nearly identical pattern to `customer-panel`: `src/app/(app)/**` pages are `async` Server Components reading Firestore directly; mutations are Server Actions (`actions.ts` per route) gated by `canWrite()`/`isAdmin` checks. A handful of routes are real Next.js Route Handlers under `src/app/api/`, needed either for streaming (ndjson) responses or because they're called by something other than this app's own UI:

- **Admin-session, streaming**: `POST /api/agents/[id]/run` (test chat), `POST /api/agents/[id]/generate-schema` (LLM graph generation), `POST /api/customers/register` (provisioning pipeline progress).
- **Server-to-server, `x-cdn-secret`-gated**: everything under `src/app/api/public/**` — called by a customer's own deployed `cdn-service` (agent config) or `customer-panel` (tickets, agent count, billing).
- **External webhook**: `POST /api/billing/webhook` — Google Cloud Pub/Sub push endpoint for billing budget alerts, authenticated via OIDC token verification, not the shared secret.

## `src/proxy.ts` — session enforcement middleware

Next.js middleware (the file is literally named `proxy.ts`, not `middleware.ts`, but serves that role — see its `config.matcher`) runs on every non-API, non-asset request:

- Not logged in and not already on `/login` → redirect to `/login?callbackUrl=<original path>`.
- Logged in but `status !== "active"` (removed/disabled mid-session) → redirect to `/login`, **and explicitly delete every cookie whose name contains `authjs`** — this is the only place that actually clears a revoked admin's session cookie (there's no separate `force-signout` route on this app, unlike `customer-panel`).
- Logged in, active, and on `/login` → redirect to `/` (the dashboard).

This mirrors `auth.ts`'s `jwt` callback, which already re-checks the team whitelist on every token refresh and zeroes out `permission`/`isAdmin`/`memberId` when the member is gone or disabled — the middleware is what actually acts on that revoked state instead of just carrying it in the token.

## Data ownership boundaries

- **Central Firestore** (`GCP_PROJECT_ID`/`FIRESTORE_DATABASE_ID`, this platform's own project): `customers`, `agents`, `customTools`, `moduleInstalls`, `teamMembers`, `tickets`, `ticketMessages`, `agentUsage`, `platformSettings`. Every deployed `cdn-service` also reads `customTools`/`agentUsage` from this same central database cross-project (see [customer-lifecycle.md](customer-lifecycle.md)).
- **Per-customer `chat-history` Firestore** (inside that customer's own GCP project): `conversations`, `leads`, and `customer-panel`'s own `team` collection — this platform never reads or writes any of these directly; they're documented in [cdn-service/docs/data-model.md](../cdn-service/docs/data-model.md) and [customer-panel/docs/data-model.md](../customer-panel/docs/data-model.md).
