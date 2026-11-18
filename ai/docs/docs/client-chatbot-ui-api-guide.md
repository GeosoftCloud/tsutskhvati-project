# Geosoft Headless Chatbot API — Client & AI UI-Builder Specification

> **Purpose of this document:** Hand this file directly to a client's engineering team **or** attach it as context to an AI coding agent (Cursor, Claude, Antigravity, v0, etc.) to build a custom website chatbot UI connected to a Geosoft AI Agent.

---

## 1. Configuration Placeholders

Replace these values with the credentials provided for your agent:

```ts
const AGENT_BASE_URL = "https://<YOUR_AGENT_HOST>/api/v1/agents/<YOUR_AGENT_ID>";

// ONLY for backend/server-side proxies (NEVER put in React/Vue/browser code!):
// const AGENT_SERVER_API_KEY = "gsa_...";
```

---

## 2. Architecture & Security: Frontend vs. Backend Proxy

You can integrate this API in **two ways**:

### Option A — Direct Browser Calls (React / Vue / Angular / Vanilla JS)
- **How it works:** Your frontend calls `AGENT_BASE_URL` directly via `fetch()`.
- **Authentication:** **No API key is used in browser code.** Instead, Geosoft allowlists your website domain (e.g. `yourcompany.com`). Browsers automatically attach `Origin: https://yourcompany.com`, which the server validates via CORS + domain allowlisting.
- **Built-in protections:**
  1. Zero secrets (no LLM keys, prompts, or tool credentials) are ever exposed to the browser.
  2. Other websites cannot embed or call your agent from visitors' browsers (`Origin` header is browser-enforced).
  3. Per-IP burst rate limiting (`30 messages/min` per IP), per-visitor daily limits, and total daily message caps protect against automated spam.
  4. Strict session/visitor isolation prevents reading or deleting other visitors' chats.
- **When to use:** Public website chatbots (customer support, FAQ, product search, lead capture, appointment booking, live human handoff).

### Option B — Backend Proxy (Next.js Route Handler / Nuxt Server Route / Express / Python / PHP)
- **How it works:** Your frontend calls your own backend (`/api/chat`), and your backend calls `AGENT_BASE_URL` with header:
  - `Authorization: Bearer <AGENT_SERVER_API_KEY>` *(or `X-API-Key: <AGENT_SERVER_API_KEY>`)*
- **When to use:**
  1. Your chatbot serves **logged-in users** and you want your backend to bind `visitorId` to the authenticated user's real account ID so it cannot be spoofed in DevTools.
  2. You want strict server-only access (when Geosoft leaves the browser domain allowlist empty, *only* requests carrying your secret `gsa_...` key are accepted, completely blocking non-browser `curl` `Origin` spoofing) or want to attach your own WAF / rate-limiting / bot-protection middleware.

---

## 3. Core Concepts & State Machine (CRITICAL for UI Builders)

To build a complete chatbot UI, maintain these state variables in your client:

1. **`visitorId` (`string`, persisted in `localStorage`)**
   - Generate once per browser using `crypto.randomUUID()` (or use an authenticated user ID via backend proxy) and save in `localStorage`.
   - Must match `^[A-Za-z0-9_-]{1,128}$` (no colons `:` or slashes `/`).
   - Allows the agent to remember returning visitors across sessions, groups past conversations, and tracks per-visitor daily limits.

2. **`sessionId` (`string | undefined`, persisted in `sessionStorage` or state)**
   - Represents **one conversation thread**.
   - Omit on the first message (or pass `crypto.randomUUID()`), then save the returned `sessionId` and include it on every subsequent message in that conversation.
   - To implement **"New Chat / Reset"**, clear `sessionId` (or generate a fresh `crypto.randomUUID()`) and clear the UI message list — **keep `visitorId` unchanged**.

3. **`status` (`"ai" | "jumpin" | "solved"`) — Human Handoff Lifecycle**
   - `"ai"`: Normal mode. Visitor messages are answered immediately by the AI agent.
   - `"jumpin"`: **Human Handoff mode.** Either the AI transferred the visitor to a human support agent, or a support teammate took over the chat from the support dashboard.
     - **UI behavior in `"jumpin"`:**
       1. Start polling `GET ${AGENT_BASE_URL}/conversations/${sessionId}` every **3,000 ms** (pause polling when tab/chat is hidden to save bandwidth; resume when visible).
       2. Replace your local `messages` array with `response.messages` from the poll so human support replies (`role: "human"`) appear live.
       3. When `assigned === false` and no `role: "human"` message exists yet, show a *"Waiting for a support agent…"* indicator and optionally a *"Continue with AI"* button (`POST .../cancel-handoff`). Hide that button once `assigned === true` or a `"human"` message arrives.
       4. When the visitor sends a message during `"jumpin"`, either call `POST /chat` or `POST /conversations/:sessionId/messages` — both append the message for the human agent without running the AI (`reply` will be `null`), then trigger an immediate poll.
   - `"solved"`: A human support agent finished and closed the handoff.
     - **UI behavior in `"solved"`:** Stop the 3-second polling timer. If the visitor sends a new message to `POST /chat`, the AI seamlessly resumes answering!

4. **Rendering Message Content (`allowHtml`)**
   - Every assistant message includes `allowHtml: boolean`.
   - If `allowHtml === false`: Render `text` safely as **plain text or Markdown** (escape raw HTML tags — never inject unsanitized `innerHTML`). Auto-link URLs and render `**bold**` / `[label](url)` links nicely.
   - If `allowHtml === true`: The agent or a custom tool intentionally returned rich HTML markup (e.g. product cards/tables); render `text` in an HTML container.
   - Visually distinguish `role: "user"` (visitor), `role: "model"` (AI assistant), and `role: "human"` (human support teammate — e.g. headset icon + `"Support Agent"` label).

---

## 4. TypeScript Types

```ts
export type MessageRole = "user" | "model" | "human";
export type ConversationStatus = "ai" | "jumpin" | "solved";
export type FeedbackRating = "up" | "down";

export interface ReplyQuote {
  id: string;
  role: MessageRole;
  text: string; // Excerpt of the message being replied to (max 300 chars)
}

export interface MessageFeedback {
  rating: FeedbackRating;
  comment: string | null;
  at: string;
  messageId: string;
}

export interface ChatMessage {
  role: MessageRole;
  text: string;
  allowHtml?: boolean;
  at?: string;
  messageId?: string;
  replyTo?: ReplyQuote;
  feedback?: MessageFeedback;
}

export interface StarterLocaleConfig {
  message: string;
  quickReplies: string[];
}

// GET /api/v1/agents/:agentId
export interface AgentInfoResponse {
  agentId: string;
  name: string;
  starters: Record<string, StarterLocaleConfig>; // e.g. { en: { message, quickReplies }, ka: { ... } }
}

// POST /api/v1/agents/:agentId/chat — Request
export interface ChatRequest {
  message?: string;       // Recommended: just pass the new user message string
  history?: ChatMessage[]; // Optional alternative: full history ending with a user message
  sessionId?: string;     // Omit on turn 1 to auto-generate; reuse on subsequent turns
  visitorId?: string;     // Persistent visitor ID (^[A-Za-z0-9_-]{1,128}$)
  replyTo?: ReplyQuote;   // Optional quoted message reference
  pageUrl?: string;       // Optional current page URL (e.g. window.location.href)
}

// POST /api/v1/agents/:agentId/chat — Response (200 OK)
export interface ChatResponse {
  reply: string | null;   // null when status === "jumpin" (message was queued for human support)
  allowHtml: boolean;
  status: ConversationStatus;
  handoff: boolean;       // true when status === "jumpin"
  assigned: boolean;      // true when a human teammate claimed the conversation
  sessionId: string;
  visitorId: string;
  userMessageId: string | null;
  messageId: string | null; // Assistant reply ID (use for feedback & replyTo)
}

// GET /api/v1/agents/:agentId/conversations/:sessionId — Response (200 OK)
export interface ConversationStateResponse {
  sessionId: string;
  status: ConversationStatus | null; // null if session doesn't exist yet
  name: string | null;
  assigned: boolean;
  messages: ChatMessage[];
}

// GET /api/v1/agents/:agentId/conversations?visitorId=... — Response (200 OK)
export interface ConversationSummary {
  id: string;
  status: ConversationStatus | null;
  startedAt: string;
  updatedAt: string;
  unseenByVisitor: number;
  lastMessagePreview: string;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
}

export interface ApiErrorResponse {
  error: string;
  code?: "visitor_daily_limit_exceeded" | "agent_daily_limit_exceeded" | "ip_rate_limit_exceeded";
}
```

---

## 5. Complete Endpoint Reference

All requests and responses use `Content-Type: application/json`.

### 5.1 Fetch Agent Info & Localized Starters
`GET ${AGENT_BASE_URL}`

Use on initial mount to display the agent's name, greeting message, and clickable quick-reply chips matching `<html lang="...">` (fallback to `"en"`, then first available locale).

**Response `200`:**
```json
{
  "agentId": "8fK29sLmP1xQ",
  "name": "Acme Assistant",
  "starters": {
    "en": {
      "message": "Hi there! How can we help you today?",
      "quickReplies": ["View pricing", "Book a call", "Speak to support"]
    }
  }
}
```

---

### 5.2 Send a Chat Message
`POST ${AGENT_BASE_URL}/chat`

**Request Body:**
```json
{
  "message": "What are your opening hours?",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "visitorId": "vis_9f81c3a0",
  "pageUrl": "https://yourcompany.com/contact"
}
```

**Response `200`:**
```json
{
  "reply": "We are open Monday through Friday, 9:00 AM – 6:00 PM.",
  "allowHtml": false,
  "status": "ai",
  "handoff": false,
  "assigned": false,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "visitorId": "vis_9f81c3a0",
  "userMessageId": "a71b98f0-12a4-4f0b-9f11-88c9910293ab",
  "messageId": "c09d14e2-67b1-42c8-8a32-44d8819201ef"
}
```

**Rate-Limited Response `429`:**
```json
{
  "error": "You've reached today's message limit for this chat. Please try again tomorrow.",
  "code": "visitor_daily_limit_exceeded",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "visitorId": "vis_9f81c3a0"
}
```

---

### 5.3 Get / Poll Conversation State (Human Handoff & Session Restore)
`GET ${AGENT_BASE_URL}/conversations/${sessionId}`

- Call on page reload if `sessionStorage` has an active `sessionId` to restore messages.
- Poll every `3000ms` while `status === "jumpin"`.
- Side effect: Marks unread human messages as seen (`unseenByVisitor = 0`).

**Response `200`:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "jumpin",
  "name": "Nino",
  "assigned": true,
  "messages": [
    {
      "role": "user",
      "text": "I need help from a human agent",
      "at": "2026-11-16T12:00:01.000Z",
      "messageId": "a71b98f0-..."
    },
    {
      "role": "model",
      "text": "I'm connecting you with a support specialist now.",
      "allowHtml": false,
      "at": "2026-11-16T12:00:02.000Z",
      "messageId": "c09d14e2-..."
    },
    {
      "role": "human",
      "text": "Hi! I'm Giorgi from support. How can I help?",
      "at": "2026-11-16T12:00:20.000Z",
      "messageId": "f91a03b1-..."
    }
  ]
}
```

---

### 5.4 Send Visitor Message During Human Handoff *(Optional Shortcut)*
`POST ${AGENT_BASE_URL}/conversations/${sessionId}/messages`

*(Note: `POST /chat` also handles `jumpin` sessions automatically; you may use either.)*

**Request Body:** `{ "text": "My order ID is #1042", "replyTo": { "id": "...", "role": "human", "text": "..." } }`  
**Response `200`:** `{ "ok": true, "messageId": "d82e..." }`

---

### 5.5 Cancel Human Handoff ("Continue with AI")
`POST ${AGENT_BASE_URL}/conversations/${sessionId}/cancel-handoff`

Allows the visitor to stop waiting for a human and return to the AI **before** a support teammate claims or replies to the conversation.

**Request Body:** `{ "visitorId": "vis_9f81c3a0" }`  
**Response `200`:** `{ "cancelled": true }`  
**Response `409`:** `{ "error": "A support agent has already joined this conversation." }` *(Re-poll conversation state and hide the cancel button.)*

---

### 5.6 List Visitor's Past Conversations *(Optional History Drawer)*
`GET ${AGENT_BASE_URL}/conversations?visitorId=${encodeURIComponent(visitorId)}`

**Response `200`:**
```json
{
  "conversations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "solved",
      "startedAt": "2026-11-16T12:00:01.000Z",
      "updatedAt": "2026-11-16T12:05:40.000Z",
      "unseenByVisitor": 0,
      "lastMessagePreview": "Glad I could help!"
    }
  ]
}
```

---

### 5.7 Delete a Conversation
`DELETE ${AGENT_BASE_URL}/conversations/${sessionId}?visitorId=${encodeURIComponent(visitorId)}`

**Response `200`:** `{ "ok": true }`

---

### 5.8 Submit Message Feedback (Thumbs Up / Down + Optional Comment)
`POST ${AGENT_BASE_URL}/feedback`

Only attach feedback controls to `role: "model"` messages that have a `messageId`. Calling again with the same `messageId` updates the rating/comment.

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "messageId": "c09d14e2-67b1-42c8-8a32-44d8819201ef",
  "rating": "up",
  "comment": "Super helpful!"
}
```
**Response `200`:** `{ "ok": true }`

---

## 6. Reference React Hook (`useGeosoftAgent`)

Below is a complete, drop-in React hook handling messaging, session restoration, JumpIn human-handoff polling, cancellation, reset, and feedback:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";

const VISITOR_STORAGE_KEY = "geosoft_visitor_id";
const SESSION_STORAGE_KEY = "geosoft_session_id";
const POLL_INTERVAL_MS = 3000;

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VISITOR_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export function useGeosoftAgent(agentBaseUrl: string) {
  const [agentName, setAgentName] = useState("Assistant");
  const [starters, setStarters] = useState<Record<string, { message: string; quickReplies: string[] }>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConversationStatus>("ai");
  const [assigned, setAssigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visitorIdRef = useRef<string>("");
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return sessionStorage.getItem(SESSION_STORAGE_KEY) ?? undefined;
  });

  // Load agent metadata on mount
  useEffect(() => {
    visitorIdRef.current = getOrCreateVisitorId();
    fetch(agentBaseUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AgentInfoResponse | null) => {
        if (!data) return;
        if (data.name) setAgentName(data.name);
        if (data.starters) setStarters(data.starters);
      })
      .catch(() => {});
  }, [agentBaseUrl]);

  const syncConversation = useCallback(
    async (targetSessionId: string) => {
      const res = await fetch(`${agentBaseUrl}/conversations/${targetSessionId}`);
      if (!res.ok) return;
      const data: ConversationStateResponse = await res.json();
      if (data.messages.length > 0) setMessages(data.messages);
      setStatus(data.status ?? "ai");
      setAssigned(!!data.assigned);
    },
    [agentBaseUrl]
  );

  // Restore existing session on mount
  useEffect(() => {
    if (sessionId) {
      syncConversation(sessionId).catch(() => {});
    }
  }, [sessionId, syncConversation]);

  // Poll every 3s while in JumpIn human handoff
  useEffect(() => {
    if (status !== "jumpin" || !sessionId) return;
    const timer = setInterval(() => {
      syncConversation(sessionId).catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status, sessionId, syncConversation]);

  const sendMessage = useCallback(
    async (text: string, replyTo?: ReplyQuote) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setError(null);
      setLoading(true);
      const optimisticUserMsg: ChatMessage = {
        role: "user",
        text: trimmed,
        at: new Date().toISOString(),
        ...(replyTo ? { replyTo } : {}),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      try {
        const res = await fetch(`${agentBaseUrl}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            sessionId,
            visitorId: visitorIdRef.current,
            replyTo,
            pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error((data as ApiErrorResponse).error || "Failed to send message");
        }

        const chatData = data as ChatResponse;
        setSessionId(chatData.sessionId);
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, chatData.sessionId);
        } catch {}

        setStatus(chatData.status);
        setAssigned(chatData.assigned);

        if (chatData.reply !== null) {
          setMessages((prev) => [
            ...prev,
            {
              role: "model",
              text: chatData.reply!,
              allowHtml: chatData.allowHtml,
              messageId: chatData.messageId ?? undefined,
              at: new Date().toISOString(),
            },
          ]);
        } else if (chatData.status === "jumpin") {
          await syncConversation(chatData.sessionId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [agentBaseUrl, loading, sessionId, syncConversation]
  );

  const cancelHandoff = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`${agentBaseUrl}/conversations/${sessionId}/cancel-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: visitorIdRef.current }),
    });
    if (res.status === 409) {
      await syncConversation(sessionId);
      return;
    }
    if (res.ok) {
      setStatus("ai");
    }
  }, [agentBaseUrl, sessionId, syncConversation]);

  const sendFeedback = useCallback(
    async (messageId: string, rating: FeedbackRating, comment?: string) => {
      if (!sessionId) return;
      await fetch(`${agentBaseUrl}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messageId, rating, comment }),
      });
    },
    [agentBaseUrl, sessionId]
  );

  const startNewChat = useCallback(() => {
    setSessionId(undefined);
    setMessages([]);
    setStatus("ai");
    setAssigned(false);
    setError(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }, []);

  return {
    agentName,
    starters,
    messages,
    status,
    assigned,
    loading,
    error,
    sessionId,
    sendMessage,
    cancelHandoff,
    sendFeedback,
    startNewChat,
  };
}
```

---

## 7. HTTP Error Status Summary

| HTTP Status | Cause | Recommended UI Handling |
| --- | --- | --- |
| `400` | Missing/empty `message`, invalid `sessionId`/`visitorId` format | Log developer warning; fix payload |
| `401` | Invalid `gsa_...` API key on backend proxy | Check backend env var `AGENT_SERVER_API_KEY` |
| `403` | Domain not allowlisted, agent not in API mode, or session ownership mismatch | Check domain allowlist in Geosoft Admin Builder |
| `404` | Agent ID not found or agent not **Published** yet | Publish the agent in Geosoft Admin Builder |
| `409` | Cannot cancel handoff — human support agent already joined | Hide "Continue with AI" button and sync messages |
| `429` | Visitor daily cap, total daily cap, or per-IP burst cap reached | Show `data.error` politely to the visitor |
| `500` | Unexpected upstream execution error | Show retryable error state in chat |
