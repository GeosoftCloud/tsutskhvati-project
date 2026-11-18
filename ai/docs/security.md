# Security model

## Domain allowlist & API keys (`src/lib/api-auth.js`)

Every agent-scoped route resolves through `loadAgentConfig` (`src/agent-config-loader.js`), which enforces the agent's Start-node `allowedDomains` list (`src/lib/domain-allowlist.js`) or — for `"api"`-mode agents — its encrypted per-agent API key:

- **Browser requests (widget and custom website UIs without an API key):** `hostnameFromHeaderValue(value)` parses the hostname out of `Origin` (falling back to `Referer`). **An empty or unset `allowedDomains` list denies every origin.** A hostname matches if it equals an allowed entry or is a subdomain (`hostname.endsWith('.' + entry)`).
- **Server-to-server requests (`deliveryMode === "api"`):** Callers may present `Authorization: Bearer <gsa_...>` or `X-API-Key: <gsa_...>`, compared in constant time (`crypto.timingSafeEqual`). Presenting an invalid key or presenting a key on a `"widget"`-mode agent immediately fails with `401`. If a browser `Origin` header is *also* present and `allowedDomains` is non-empty, `isHostAllowed` is still enforced (`403` on mismatch).
- Both checks run on *every* call, including cache hits — so removing a domain or rotating an API key takes effect within one `CONFIG_CACHE_TTL_MS` window.

## CORS

`src/server.js` reflects any request's `Origin` back as `Access-Control-Allow-Origin` (with `Vary: Origin`), and allows `GET, POST, DELETE, OPTIONS` / `Content-Type`. This is deliberately wide open: the widget is *designed* to run cross-origin on arbitrary customer sites, so CORS here only controls whether a browser can read the response — it is **not** the authorization boundary. That job belongs entirely to the domain allowlist above.

## Server-to-server trust with the admin platform

`src/platform-client.js` calls the admin platform's `GET /api/public/agents/:id/config` with two headers:

- `x-embed-origin` — the visitor's real `Origin`, forwarded so the platform checks *that* value against the allowlist rather than this service's own (server-to-server) request origin.
- `x-cdn-secret` — `CDN_SHARED_SECRET`, proving to the platform that the forwarded `x-embed-origin` can be trusted rather than spoofed by an arbitrary caller. This value must match the platform's own `CDN_SHARED_SECRET`.

## Custom tool config encryption

`src/lib/secrets.js` decrypts `customTool` node configuration fields (API keys, credentials, etc.) that the admin platform stores and serves encrypted, since they travel over the network via the public-ish `/api/public/agents/:id/config` call:

- AES-256-GCM, `TOOL_CONFIG_ENCRYPTION_KEY` (base64, must decode to exactly 32 bytes) — must be byte-identical to the platform's own key.
- Encrypted payload shape: `{ __encrypted: true, value: "enc:v1:<iv-b64>:<tag-b64>:<ciphertext-b64>" }`. Non-matching shapes pass through untouched (a node with no config at all is valid).
- Decryption happens once, in `agent-config-loader.js`, right after fetching — so the cached config and every downstream consumer (`agent-runner.js`) sees plaintext, and the ciphertext never sits in this service's memory cache.
- This logic is a deliberate line-for-line port of the platform's own `src/lib/secrets.ts` (not shared as a package, since this is a separate plain Node/ESM app) — if the encryption scheme changes on one side, it must change on both.

## Payload encryption between cdn-service and the admin platform

`src/lib/system-crypto.js` encrypts/decrypts the whole JSON body of every request and response
exchanged with the admin platform's `/api/public/**` routes — a second, independent layer on top
of the `x-cdn-secret` auth above, so a captured request/response is unreadable on its own even if
TLS were somehow defeated:

- AES-256-GCM, `SYSTEM_API_SECRET` (base64, must decode to exactly 32 bytes) — must be
  byte-identical to the platform's own key. Never sent over the wire itself.
- Wire format: `{ "payload": "sys:v1:<iv-b64>:<tag-b64>:<ciphertext-b64>" }` — a distinct prefix
  from the `enc:v1:` custom-tool-config scheme below, since the two layers nest (a config
  response's `graph` still carries an `enc:v1:` blob inside this layer's `sys:v1:` envelope).
- This service only ever calls one route (`GET /api/public/agents/:id/config`), so it only needs
  the decrypt direction today — but the module exports both, ready for whenever the admin
  platform calls into this service directly.
- Line-for-line port of the platform's own `src/lib/system-crypto.ts`, same reasoning as the
  custom-tool-config port below — must change on both sides together.

## Custom tool sandbox

Admin-authored custom tool JavaScript runs inside Node's `vm` module (`src/lib/custom-tool-runner.js`), not the main process's global scope:

- **No filesystem, network primitives, or process control** beyond an explicitly whitelisted global set (`fetch`, `console`, `JSON`, `Math`, `Date`, `URL`, `URLSearchParams`, `setTimeout`/`clearTimeout`, and a restricted `require`).
- `require()` only resolves npm packages the tool explicitly declared via `//> package-name` header comments, and only after checking each declared name isn't one of the blocked Node builtins (`fs`, `child_process`, `net`, `tls`, `http(s)`, `dns`, `worker_threads`, `vm`, `process`, `os`, etc.).
- Hard execution timeouts: 5s at the `vm.Script` level, 15s outer wall-clock (`EXECUTION_TIMEOUT_MS`).
- Declared npm packages are installed per-scope (`` `widget:${agentId}` `` for this service) under `.tool-modules/<scope>/`, isolating one agent's dependencies from another's and from the host application's own `node_modules`.
- This is a deliberate port of the platform's own `src/lib/custom-tool-runner.ts` sandboxing model — see that file for the full rationale if the blocklist ever needs to change, since it should change in both places together.

Even with the sandbox, custom tool code still runs with this service's own Google service-account credentials available indirectly through whatever the tool's `fetch` calls reach — the sandbox constrains *language capabilities*, not network egress.

## Rate limiting

`src/lib/firestore/agent-usage.js` enforces two independent daily caps, checked in `POST /api/agents/:id/chat` before running the graph: a per-visitor cap (`visitorDailyLimit`) is checked *before* the shared per-agent cap (`dailyLimit`), specifically so a visitor who has already exhausted their own limit can never consume the shared budget by retrying. Both are atomic Firestore transactions keyed by UTC date, so concurrent requests can't race past the limit.

## Secrets and credentials

- `GOOGLE_APPLICATION_CREDENTIALS` (default `./key.json`) is a GCP service-account key file; the service refuses to start if it's missing (`src/server.js`).
- `CDN_SHARED_SECRET`, `TOOL_CONFIG_ENCRYPTION_KEY`, and `SYSTEM_API_SECRET` are shared secrets with the admin platform — treat them as sensitive as any API key; rotating one requires updating both sides simultaneously (a stale key on either side breaks agent config fetches, tool decryption, or every `/api/public/**` call respectively).
