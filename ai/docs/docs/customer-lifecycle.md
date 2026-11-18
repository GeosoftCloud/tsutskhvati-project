# Customer lifecycle

## Status progression

```
pending ──(cdnService + customerPanel both "deployed")──▶ awaiting_panel_access ──(admin confirms OAuth redirect URI added)──▶ active
   │
   └─(any provisioning step fails before the customer record even fully exists)─▶ customer record deleted, nothing left behind
```

Both transitions are system/admin-driven, never a free-form status edit — see `markAwaitingPanelAccessIfFullyDeployed` and `grantPanelAccess` in [data-model.md](data-model.md#customers).

## Registration (`POST /api/customers/register`)

Streams ndjson `{type: "stage", stage, label}` progress events while it runs. Sequence, each step's failure rolling back everything created so far in that same request:

1. **Create the Firestore `customers` doc** (`status: "pending"`, `gcpProjectId: ""`).
2. **Create a dedicated GCP project** (`createCustomerProject`, `src/lib/gcp-projects.ts`): `projectId` is derived from the Firestore doc id (`buildCustomerProjectId` — prefix `geosoft-agents-customer-`, truncated/sanitized to fit GCP's 30-char project id limit), created under `GCP_FOLDER_ID`, then bound to the billing account the admin selected in the registration form. On failure: delete the customer doc (no project was successfully created, nothing to clean up there).
3. **Provision a per-customer service account** (`provisionCustomerServiceAccount`): creates a service account named `geosoft-agent-sa` inside the new project, grants it `roles/owner`, `roles/editor`, `roles/aiplatform.user`, `roles/iam.serviceAccountUser` on that project, mints a JSON key. On failure: delete the GCP project too, then the customer doc.
4. **Enable the Google Workspace APIs** (`enableGoogleToolsApis`) — Docs/Sheets/Calendar-json/Drive — on the new project, so Workspace tool nodes work once resource IDs are shared with the service account's email. On failure: same rollback as step 3.
5. **Mark both `cdnService` and `customerPanel` as `status: "pending"`**, then respond-and-continue: everything from here runs inside `next/server`'s `after()`, since Cloud Build/Cloud Run/Artifact Registry aren't reliably usable for several minutes on a brand-new project — far too long to hold the HTTP request open.
6. **(inside `after()`) Shared prerequisites**: `grantCentralFirestoreAccess` (grants the new service account `roles/datastore.user` on *this platform's own* project, so the deployed `cdn-service` can read/write central `customTools`/`agentUsage` cross-project) and `ensureChatHistoryDatabase` (creates the customer's own `chat-history` Firestore Native-mode database, inside their project). Both are prerequisites for **both** deploys below and neither depends on the other. Failure here fails both `cdnService` and `customerPanel` with a shared error.
7. **Deploy `cdn-service` and `customer-panel` concurrently** (`Promise.allSettled` — one failing doesn't block the other) via `deployCdnService`/`deployCustomerPanel` (see below). Each result independently updates that customer's `cdnService`/`customerPanel` field to `deployed`+URL or `failed`+error.
8. **`markAwaitingPanelAccessIfFullyDeployed`** — flips status if both landed.
9. **(back on the original request, not in `after()`) Billing budget**: if `BILLING_PUBSUB_TOPIC` is configured, `upsertProjectBudget` creates/updates a Cloud Billing budget scoped to the new project with no threshold rules — just enough to make Cloud Billing publish regular spend notifications to the shared Pub/Sub topic (see [deployment-and-ops.md](deployment-and-ops.md#billing-webhook-setup)). A failure here is logged, not fatal to registration.

## The shared deploy mechanism (`src/lib/gcp-deploy-shared.ts`)

Both `cdn-deploy.ts` and `customer-panel-deploy.ts` build on the same primitives — no Docker CLI, no Cloud Build trigger config, no Terraform; everything is direct Google API calls (`googleapis`):

1. **`enableApis`** — batch-enables the Cloud Run/Artifact Registry/Cloud Build/Storage/(Vertex AI for cdn-service) APIs on the customer's project.
2. **`grantCloudBuildRoles`** — grants `roles/artifactregistry.writer`, `roles/logging.logWriter`, `roles/storage.objectViewer` to *both* the classic Cloud Build service account and the Compute Engine default service account (newer projects default build execution to the latter, confirmed by testing — granting both sidesteps needing to know which one actually runs the build).
3. **`ensureArtifactRepo`** — creates a Docker-format Artifact Registry repo if missing.
4. **`buildSourceArchive(sourceDirName, envVars, keyJson?)`** — copies `cdn-service/` or `customer-panel/` (already present in *this app's own* container image — the root `Dockerfile` copies both subdirectories in directly, sidestepping Next's file-tracing since the directory name is chosen dynamically) into a temp dir, writes a generated `.env` (and `key.json` for cdn-service only) into it, tars+gzips it in memory.
5. **`uploadSourceArchive`** — uploads that archive to a per-project, per-purpose GCS staging bucket (created on demand: `` `${projectId}-${purpose}-build` ``).
6. **`submitBuild`** — submits a Cloud Build job (`docker build -t <imageUri> .` against the uploaded source) targeting the just-created Artifact Registry repo, polls until `SUCCESS`/failure. Retried a few times on generic (non-obviously-permission) errors too, since a brand-new project's Cloud Build control plane can be flaky for the first attempt or two.
7. **`grantServiceAccountUser`** — grants this platform's own provisioning identity `roles/iam.serviceAccountUser` on the customer's service account (a separate, narrowly-scoped requirement from any project-level role, needed to deploy Cloud Run *as* that service account).
8. **`deployCloudRunService`** — creates (or, on retry, patches) a Cloud Run v2 service running as the customer's service account, opens it to `allUsers` (`roles/run.invoker`), then patches in any `urlDependentEnv` (env vars that need the service's own freshly-assigned URL, e.g. `PUBLIC_BASE_URL`/`AUTH_URL`) — Cloud Run only reveals that URL after the service exists. Every patch pins a fresh `revision` name (`` `${serviceId}-${Date.now().toString(36)}` ``) so a redeploy with an unchanged image/env spec still forces a new revision rather than silently no-opping.

**`withPropagationRetry`** wraps most of the above: IAM grants and freshly-created resources can take up to a minute or two to propagate through Google's control plane, so a permission-denied error immediately after granting a role is retried rather than treated as a real authorization failure.

## `deployCdnService` (`src/lib/cdn-deploy.ts`)

Builds `cdn-service` region `CDN_DEPLOY_REGION` (default `europe-west1`), service id `cdn-service`. Env vars baked in include: `PLATFORM_BASE_URL`, `CDN_SHARED_SECRET`, `GCP_PROJECT_ID` (the *customer's* project, for Vertex AI billing), `FIRESTORE_PROJECT_ID`/`FIRESTORE_DATABASE_ID` (this *platform's* central Firestore, for `customTools`/`agentUsage`), `TOOL_CONFIG_ENCRYPTION_KEY` (must match this platform's own — see [agent-builder.md](agent-builder.md#secrets)), `CHAT_HISTORY_PROJECT_ID`/`CHAT_HISTORY_DATABASE_ID` (the customer's own project — set up by `ensureChatHistoryDatabase`, which must run first). `PUBLIC_BASE_URL` is the one URL-dependent var, patched in after the Cloud Run service exists.

## `deployCustomerPanel` (`src/lib/customer-panel-deploy.ts`)

Builds `customer-panel`, service id `customer-panel`. No `key.json` baked in — relies on Application Default Credentials via the Cloud Run service account instead (matching this platform's own convention). Notable env vars: `INITIAL_ADMIN_EMAIL` (the customer's own `adminEmail`, bootstraps their first team member — see [customer-panel/docs/auth-and-tenancy.md](../customer-panel/docs/auth-and-tenancy.md)), a freshly-generated `AUTH_SECRET` per deployment (so a leaked/rotated secret on one customer can't forge sessions on another), `CUSTOMER_PANEL_AUTH_GOOGLE_ID`/`_SECRET` (one Google OAuth client **shared across every customer-panel deployment** — Google exposes no API to create OAuth clients or manage their redirect URIs, so each new deployment's callback URL has to be added to that one client by hand), the shared Gmail sender credentials (`GMAIL_*`: all four or none; a missing set warns on every deploy and the redeploy scripts refuse to run without it, see [deployment-and-ops.md](deployment-and-ops.md#gmail-sender-setup)), and `CUSTOMER_COMPANY_NAME`, always (the From name on that customer's emails and the panel's tab title). `AUTH_URL` and `PANEL_BASE_URL` are the URL-dependent vars.

`customerPanelOAuthConsoleUrl()` builds a deep link straight to that shared OAuth client's edit page in Google Cloud Console — surfaced by the "Grant Panel Access" UI so an admin doesn't have to go hunting for it.

## Retry (`POST /api/customers/[id]/retry`)

For a customer whose `cdnService` and/or `customerPanel` ended up `status: "failed"`. Re-runs only the failed side(s) — `retryCdn`/`retryPanel` flags computed independently — and always re-runs the shared prerequisites (`grantCentralFirestoreAccess`, `ensureChatHistoryDatabase`) first since they're idempotent and may have been what failed originally. Deliberately **sequential**, not concurrent like the initial registration's `Promise.allSettled` — both deploys mutate the same per-project IAM resources (`grantCloudBuildRoles`, `grantServiceAccountUser`), and running them concurrently would race on those read-modify-write IAM policy calls.

## Grant panel access

A **manual, human-in-the-loop** step: after both deployments land, an admin must go to the shared OAuth client's console page (linked via `customerPanelOAuthConsoleUrl()`) and add `<customer's customer-panel URL>/api/auth/callback/google` to its authorized redirect URIs — Google exposes no API to automate this. Once done, clicking "Grant Panel Access" in the UI calls `grantPanelAccessAction` → `grantPanelAccess()`, which just flips `status` from `awaiting_panel_access` to `active` (guarded on that precondition) — it doesn't verify the redirect URI was actually added; that's on the admin.

## Editing registration details after the fact

`updateCustomerRegistrationDetailsAction` lets an admin correct `companyEmail`/`companyPhone`/`adminName`/`adminEmail`/`adminPhone` post-registration. If the admin's identity (name or email) changed and the customer has a GCP project, it also best-effort patches the matching doc in that customer's **own** `customer-panel` `team` collection (`syncCustomerPanelAdminIdentity`, `src/lib/customer-panel-team.ts`) — since that collection was seeded once from the original `adminEmail` at first sign-in and is otherwise fully independent of this platform's `customers` doc. This can silently no-op if the customer hasn't signed into their panel yet (no team doc to find) or isn't deployed yet.

## Offboarding (`deleteCustomerAction`)

Deletes the customer's GCP project (`deleteCustomerProject` — GCP keeps it recoverable for a 30-day grace period, not an instant hard delete), best-effort revokes the cross-project Firestore IAM grant (`revokeCentralFirestoreAccess`), deletes every agent belonging to that customer (`deleteAgentsForCustomer`), then deletes the `customers` doc itself. There is no equivalent cleanup of that customer's own `chat-history` database contents — it goes away along with the deleted GCP project.
