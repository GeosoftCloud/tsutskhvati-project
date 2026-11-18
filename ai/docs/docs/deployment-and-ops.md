# Deployment & operations

## This app's own deployment

Deployed to Cloud Run via **source deploy** (`gcloud run deploy --source .`), not a pre-built image from a Dockerfile step in CI — though a root `Dockerfile` exists (multi-stage, builds a standalone Next output and copies `cdn-service/` and `customer-panel/` into the final image, since those subdirectories need to be present at runtime for the per-customer deploy pipeline to tar/upload them — see [customer-lifecycle.md](customer-lifecycle.md#the-shared-deploy-mechanism-srclibgcp-deploy-sharedts)). Target: project `geosoft-agents-admin-505117`, region `europe-west1`, service `geosoft-agents-admin`.

## Three chained GitHub Actions workflows

All three live in `.github/workflows/` and share one convention: **a commit message tag decides what redeploys**. A single commit can opt into any combination of `[admin]`, `[cdn]`, `[panel]`.

1. **`deploy-cloud-run.yml`** ("Deploy Admin Platform to Cloud Run") — triggers on every push to `main` (plus manual `workflow_dispatch`), but only actually deploys if the commit message contains `[admin]` (a manual dispatch always deploys regardless of message). It runs unconditionally on push anyway — even without `[admin]` — purely so the next workflow in the chain gets a chance to fire.
2. **`deploy-cdn-service.yml`** ("Deploy CDN Service to Customers") — chains off workflow (1) via `workflow_run`, and only proceeds if that upstream run was itself triggered by a push (not a manual dispatch) whose commit message contains `[cdn]`. When it runs, it calls `scripts/redeploy-cdn-service.ts`, which rebuilds `cdn-service` from current source and redeploys it **to every customer with an existing `deployed` cdn-service** (concurrency 3) — same GCP project/region/service id per customer, so this updates the running service in place rather than creating anything new. Also independently runnable via manual `workflow_dispatch`, in which case it diffs `cdn-service/` against a `cdn-service-last-deploy` git tag and skips the deploy job entirely if nothing changed (unless `force: true`, the default).
3. **`deploy-customer-panel.yml`** ("Deploy Customer Panel to Customers") — chains off workflow (2) the same way, gated on `[panel]` and on workflow (2) itself having been triggered by the chain (not a manual dispatch) — so a manual click on the Actions page never cascades further. Calls `scripts/redeploy-customer-panel.ts`, the equivalent of `redeploy-cdn-service.ts` for `customer-panel`.

Each of the two "Deploy to Customers" workflows moves its own git tag (`cdn-service-last-deploy` / `customer-panel-last-deploy`) to the deployed commit on success — that tag is only consulted by the manual `workflow_dispatch` diff-check path, not by the auto-chain path (which always deploys when tagged, since a tagged commit is explicit intent regardless of which files it touched).

What both redeploy scripts do besides deploying:

- **Fail fast without mail.** They refuse to start when the platform's own `GMAIL_*` env is incomplete (`requireCompleteMailEnv`, `src/lib/deploy-mail-env.ts`), because every deployment would otherwise ship without handoff and invite emails and nothing would say so. `ALLOW_DEPLOY_WITHOUT_MAIL=true` is the explicit opt-out. `deployCdnService`/`deployCustomerPanel` throw on a partial set (1–3 of the 4) and warn on every deploy made without one (the registration and retry routes).
- **Re-apply env older deployments may lack.** Every deploy bakes the complete env from scratch: `GMAIL_*`, and `CUSTOMER_COMPANY_NAME` (now always set; it used to be skipped along with `GMAIL_*`). `PANEL_BASE_URL` reaches cdn-service through `updateCdnServicePanelUrl` after a cdn redeploy **and** after a panel redeploy (for deployments older than that function). `patchCloudRunServiceEnv` skips the patch when the values are already set, so this doesn't restart anything needlessly.
- **Visitor numbers** (cdn script only). Runs the idempotent `backfillVisitorNumbers` against each customer's `chat-history` database before the deploy and again after it (the second pass catches visitors the old code created during the deploy). See [scripts](#one-off-scripts-scripts).
- **Summary table.** Both end with one row per customer, read back from the live Cloud Run env (names only, never values):

  ```
  project                 customer  cdn ok  panel ok  mail configured  PANEL_BASE_URL set  visitor numbers
  ----------------------  --------  ------  --------  ---------------  ------------------  ---------------
  geosoft-agents-cust-1   Acme      ok      skipped   yes              yes                 ok (+312)
  ```

  "mail configured" is `yes` when every deployed service of that customer has all four `GMAIL_*`; "PANEL_BASE_URL set" is about cdn-service. Any `no` is repeated as a WARNING line. A failed deploy, `PANEL_BASE_URL` patch or backfill makes the script exit 1.

Redeploying via these scripts never touches a customer's Firestore-recorded `cdnService`/`customerPanel` status/URL on failure — a failed redeploy just logs and leaves the record as `deployed` with the previous URL, since the customer's prior revision keeps serving traffic; it isn't actually down.

## One-off scripts (`scripts/`)

- **`seed-admin.mjs email name`** — the only way to create the very first `teamMembers` doc (there is no bootstrap-admin sign-in path on this app, unlike `customer-panel` — see [auth-and-permissions.md](auth-and-permissions.md)). Seeds `permission: "write"`, `isAdmin: true`, `status: "active"`.
- **`get-gmail-refresh-token.mjs`** — interactive, one-time. Requires a Google OAuth **"Desktop app"** client (`GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` in `.env.local`) — desktop clients can use an arbitrary `http://localhost:<port>` redirect without pre-registering it. Opens a consent URL for the `gmail.send` scope, runs a tiny local HTTP server to catch the redirect, exchanges the code for a refresh token. **Sign in as the mailbox that should send the emails**, not your own account. Always passes `prompt=consent` so a repeat run still gets a fresh refresh token back.
- **`setup-billing-webhook.mjs https://your-deployed-domain.com`** — one-time. Creates the shared Pub/Sub topic (`billing-budget-alerts`) and a push subscription (`billing-budget-alerts-webhook`) delivering to `<domain>/api/billing/webhook`, OIDC-authenticated as the running service account. Must be run against a real public HTTPS URL, not localhost. Prints `BILLING_PUBSUB_TOPIC`/`BILLING_WEBHOOK_AUDIENCE` to add to the environment. If `GCP_BILLING_ACCOUNT_ID` is set, also creates/updates a budget for this platform's *own* project against the same topic (wires up the admin dashboard's own spend metric). Newly registered customers get a per-project budget automatically once `BILLING_PUBSUB_TOPIC` is set (see [customer-lifecycle.md](customer-lifecycle.md)); existing customers registered before that need `upsertProjectBudget` run for them manually.
- **`redeploy-cdn-service.ts`** / **`redeploy-customer-panel.ts`** — see the workflow descriptions above; also runnable locally via `npx tsx scripts/<name>.ts`.
- **`backfill-visitor-numbers.ts [gcpProjectId]`** — numbers every visitor without a "Visitor N" number, in order of their first conversation, in each customer's `chat-history` database (or one), and writes `visitorNumber` onto their conversations and leads (`src/lib/visitor-number-backfill.ts`). Idempotent; a second run writes nothing. It reserves its block of numbers on the same `counters/visitors` doc cdn-service allocates from, in a transaction, and creates mappings with `create()`, so it can't collide with a live cdn-service. Never touches `updatedAt`. The cdn redeploy script runs it for everyone; run it by hand with `npx tsx scripts/backfill-visitor-numbers.ts`.

## Gmail sender setup

One shared mailbox sends every email: the platform's onboarding emails, each customer-panel's team invites, and each cdn-service's handoff notifications. The From **name** is the customer's company (`CUSTOMER_COMPANY_NAME`) and `Reply-To` is that customer's own admin, so recipients see and reply to the customer, but the address is the shared sender. Four values make it work: `GMAIL_SENDER_EMAIL`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`. All four or none.

1. **Pick the sender mailbox**, e.g. `noreply@geosoft.dev` (a Google Workspace user or a Gmail account you can sign in as). That address is `GMAIL_SENDER_EMAIL`.
2. **Enable the Gmail API** in `geosoft-agents-admin-505117`: Console → APIs & Services → Library → Gmail API → Enable.
3. **OAuth consent screen** (APIs & Services → OAuth consent screen, or Google Auth Platform → Audience): add the scope `https://www.googleapis.com/auth/gmail.send`, and set the publishing status to **In production**, not **Testing**. A Testing app's refresh tokens expire after 7 days, after which every email fails with `invalid_grant` (the panel shows it as "the mail sender's sign-in expired"). If the sender is in the same Workspace organization as the project, user type **Internal** also avoids expiry. An unverified External app in production shows a "Google hasn't verified this app" screen during step 5; for this one-time sign-in by your own mailbox, continue through Advanced.
4. **Create a Desktop-app OAuth client**: APIs & Services → Credentials → Create credentials → OAuth client ID → Application type **Desktop app**. This is a different client from `AUTH_GOOGLE_ID` and `CUSTOMER_PANEL_AUTH_GOOGLE_ID`. Desktop clients accept any `http://localhost:<port>` redirect, which the script relies on. Put its id and secret in `.env.local` as `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`.
5. **Mint the refresh token**: `node scripts/get-gmail-refresh-token.mjs`, open the printed URL **while signed in as the sender mailbox** (not your own account), approve `gmail.send`, and copy the printed `GMAIL_REFRESH_TOKEN`. The token only works with the client id/secret that requested it.
6. **Put the four values in every place deploys read them from:**
   - `.env.local` (local runs of the redeploy scripts);
   - the **GitHub Actions secrets** (repo → Settings → Secrets and variables → Actions): `GMAIL_SENDER_EMAIL`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, read by `deploy-cdn-service.yml` and `deploy-customer-panel.yml`;
   - the admin platform's own Cloud Run service env (`geosoft-agents-admin`, Console → Cloud Run → Edit & deploy new revision → Variables & Secrets), since registrations and retries deploy from there. `deploy-cloud-run.yml` doesn't set env, so revisions keep what's set there.
7. **Roll it out**: run "Deploy CDN Service to Customers" and then "Deploy Customer Panel to Customers" (workflow_dispatch). The summary table should say `mail configured: yes` and `PANEL_BASE_URL set: yes` for every customer.
8. **Verify each customer**: their Team page → **Handoff email** → **Send test email**. It sends the real handoff template from cdn-service to the signed-in admin, with the company as From name and the customer's admin as Reply-To.

Rotating: repeat steps 5–7. A revoked token shows up as `handoffNotification.reason: "token_expired"` on conversations and as `[handoff-mail] failed: token_expired` in cdn-service logs.

## Firestore indexes

None to provision. Every query the panel, cdn-service and the backfill run uses single-field indexes (automatic, including map subfields such as `unreadMentions.<memberId>`) or filters in memory, so a new customer database works as created. Queries that would need a composite index were avoided deliberately: the Solved and AI-handling views scan by `updatedAt` and filter in memory, the note-change delta orders by `notesChangedAt` alone, notes are ordered by `createdAt` within one subcollection, and bulk deletes read by id. Keep it that way, or add index creation to the deploy code for every customer project; nobody creates indexes by hand.

## Prerequisites called out in code comments but not automated

- The Gmail sender: see [Gmail sender setup](#gmail-sender-setup) above.
- Adding a new customer-panel deployment's OAuth callback URL to the shared `CUSTOMER_PANEL_AUTH_GOOGLE_ID` client's authorized redirect URIs is **always manual** (Google exposes no API for it) — see [customer-lifecycle.md](customer-lifecycle.md#grant-panel-access).
- Backfilling a billing budget for a customer registered before `BILLING_PUBSUB_TOPIC` was configured has no dedicated script — it requires calling `upsertProjectBudget` from a one-off script, per `setup-billing-webhook.mjs`'s own printed guidance.
