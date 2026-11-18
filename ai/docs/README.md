# cdn-service documentation

Technical documentation for `cdn-service` (`geosoft-chatbox-cdn`), the per-customer Cloud Run service that serves the embeddable Geosoft chatbox widget and runs its conversation graph. For setup/env vars/run instructions, see the [project README](../README.md).

- [Architecture](architecture.md) — components, request lifecycle, caching
- [API reference](api-reference.md) — every route, request/response shape, status codes
- [Agent execution](agent-execution.md) — how a conversation graph runs: tools, Gemini function calling, human handoff, lead capture, custom tool sandboxing
- [Data model](data-model.md) — the two Firestore databases and their collections
- [Widget](widget.md) — the embeddable browser script: how it's built and served, its UI states and behavior
- [Security](security.md) — domain allowlist, CORS, shared-secret auth, config encryption, custom tool sandbox

## Source map

| Area | Files |
| --- | --- |
| Entry point | `src/server.js` |
| Config loading & caching | `src/agent-config-loader.js`, `src/agent-cache.js`, `src/platform-client.js` |
| Routes | `src/routes/widget.js`, `src/routes/config.js`, `src/routes/chat.js`, `src/routes/conversation.js` |
| Widget source | `src/widget-client.js` |
| Graph execution | `src/lib/agent-runner.js`, `src/lib/agent-tool-cache.js` |
| Custom tools | `src/lib/custom-tool-runner.js`, `src/lib/firestore/custom-tools.js`, `src/lib/firestore/module-installs.js` |
| Google integrations | `src/lib/google-workspace.js`, `src/lib/google-auth.js`, `src/lib/vertex-ai.js` |
| Security | `src/lib/domain-allowlist.js`, `src/lib/secrets.js` |
| Persistence | `src/lib/firestore/client.js`, `src/lib/firestore/chat-history-client.js`, `src/lib/firestore/chat-history.js`, `src/lib/firestore/agent-usage.js` |
