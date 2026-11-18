# The embeddable widget

## How it's built and served

`src/widget-client.js` defines `widgetMain(AGENT_ID, API_BASE)` as an ordinary function, deliberately written with **no external references** — only its own parameters and browser globals — so it can be shipped with zero build/bundle step. `buildWidgetScript(agentId, apiBase)` serializes it with `.toString()` and wraps it as an immediately-invoked call:

```js
(${widgetMain.toString()})(${JSON.stringify(agentId)}, ${JSON.stringify(apiBase)});
```

`GET /widget/:agentId.js` (`src/routes/widget.js`) returns that string as `application/javascript`, cached 5 minutes (`Cache-Control: public, max-age=300`). A customer embeds it with a plain `<script src=".../widget/AGENT_ID.js"></script>` tag on their site. `AGENT_ID` is validated (`^[A-Za-z0-9_-]{1,128}$`) before it's ever interpolated into the response.

A `window["__geosoftChatbox_" + AGENT_ID]` flag guards against double-initialization if the script tag is somehow included twice.

## Visual design

Markup/CSS/icon paths are hand-ported to match the admin platform's own chatbox preview component (`test-chat-panel.tsx`) as closely as plain CSS/DOM allows — same `.geosoft-chatbox*` class names (so an admin's custom CSS behaves identically in both places), same Lucide icon path data, same Tailwind-derived colors/spacing. All styles are injected as one `<style>` block into `document.head`; there is no external stylesheet.

- Light/dark: a `MutationObserver` on `document.documentElement` watches for its `class` attribute changing, and mirrors a `dark` class onto the widget's own root — so the widget reacts live to the host page's theme toggle, not just at load.
- Locale: the same observer watches the `lang` attribute; starter messages/quick-replies are looked up by `document.documentElement.lang` (falling back to `en`, then any available locale) and re-rendered on change.

## State

All state is plain module-scope variables (no framework):

| Variable | Meaning |
| --- | --- |
| `visitorId` | Persisted in `localStorage` (`__geosoftChatbox_visitorId`) — survives refreshes, ties multiple conversations back to one browser |
| `sessionId` | Fresh `crypto.randomUUID()` per page load / "new chat" click — one Firestore `conversations` doc per session |
| `messages` | In-memory `{role, text, allowHtml}[]` for the active session |
| `conversationStatus` | `null` (AI-handled) \| `"jumpin"` \| `"solved"` |
| `view` | `"chat"` \| `"history"` |
| `historyItems` | Cached result of the visitor's conversation list |

## Lifecycle

1. On load, fetches `GET /api/agents/:id/config`. On any failure (domain not authorized, agent not found, network error) it fails **silently** — no widget is rendered at all, no console error shown to the site visitor.
2. On success: sets the header name/placeholder/disclaimer text, swaps in a custom icon/styles/scripts if the admin configured them, renders the empty-state (starter message + quick replies, if configured for the current locale), and appends the widget root to `document.body`.
3. Custom CSS handling: because the default header/toggle background is a CSS gradient (`background-image`), a plain `background-color` override can't show through it — so when `chatbox.styles` is present, a reset rule (`background-image:none; background-color:<accent>`) is injected first, then the admin's custom CSS, so a simple color override actually works.
4. `chatbox.scripts`, if configured, is injected as a literal `<script>` tag after the widget is mounted.

## Sending a message

`send(text)`:

- If the conversation is `jumpin`, posts to `POST /api/agents/:id/message` and immediately re-polls (`pollConversation`) rather than expecting a synchronous AI reply.
- Otherwise, posts to `POST /api/agents/:id/chat` with the current `messages` as history, reads the response body as an ndjson stream (`ReadableStream` + `TextDecoder`, split on `\n`), and applies the terminal `final`/`error` event once the stream ends. If the returned status is `"jumpin"`, switches into polling mode.
- Any thrown error is appended to the transcript as a `⚠️ <message>` model bubble rather than surfacing a native alert.

Input is a `<textarea>` that auto-grows (`resizeInput`, capped by `max-height` in CSS) and submits on Enter (Shift+Enter for a newline).

## JumpIn polling

A team member can also take an AI-handled conversation from the customer panel, which flips it to `jumpin` with no `/chat` response to tell the widget. The history-badge refresh (every 10 s while the panel is open) notices that the current session's status is `jumpin` and switches the widget into polling mode. If the widget is closed, the visitor's next message goes to `/chat`, which returns `status: "jumpin"` the usual way.

Once `conversationStatus === "jumpin"`, `startPolling()` calls `GET /api/agents/:id/conversation/:sessionId` every 3 seconds (`POLL_INTERVAL_MS`) and re-renders on each response; polling stops automatically once the status is no longer `jumpin` (i.e. a support agent marks it `solved`). Polling is intentionally paused whenever the visitor switches to the history view, so merely opening the list doesn't mark the actively-open conversation "seen" server-side — switching back to chat resumes polling and immediately fetches once.

## History view

`historyBtn` toggles `view` between `"chat"` and `"history"`. Opening it calls `GET /api/agents/:id/conversations?visitorId=...` and renders each item with a status dot, last-updated timestamp, unseen-count badge, a text preview, and a delete button (confirms via `window.confirm`, then `DELETE /api/agents/:id/conversation/:id?visitorId=...`). Clicking a row loads that conversation's full state and switches back to the chat view (resuming polling automatically if it's still `jumpin`).

## Rendering messages

Each message renders with a role-appropriate avatar (`ICON_USER` for `user`/`human`, `ICON_BOT` otherwise) and a bubble. If `m.allowHtml` is true, the bubble's `innerHTML` is set directly from `m.text` — this only happens for `model` messages, and only when the bound agent node has `allowHtmlOutput` enabled by an admin, so the trust boundary is "the admin who configured this agent," not visitor input. All other text is set via `textContent`, which is escape-safe by construction.

A synthetic "Waiting for the support agent..." bubble (with a "Continue with AI" button) is shown while `status === "jumpin"`, no `human`-role message has arrived yet and no team member has taken the conversation (`assigned` from the poll); a "conversation has been completed" notice replaces the input area once `status === "solved"` (input and send button are also disabled in that state).
