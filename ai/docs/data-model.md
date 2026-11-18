# Data model

`cdn-service` writes to **two separate Firestore databases**, both in the same GCP project by default but configurable independently:

| Database | Env vars | Client | Purpose |
| --- | --- | --- | --- |
| Default/platform-shared | `FIRESTORE_PROJECT_ID`, `FIRESTORE_DATABASE_ID` (default `(default)`) | `src/lib/firestore/client.js` → `getFirestore()` | Custom tool definitions, daily usage counters, module-install audit log |
| Chat history | `CHAT_HISTORY_PROJECT_ID`, `CHAT_HISTORY_DATABASE_ID` (default `chat-history`) | `src/lib/firestore/chat-history-client.js` → `getChatHistoryFirestore()` | Conversations and leads — kept separate so per-customer transcripts never mix with shared platform data |

Both clients are lazily-initialized singletons using the same service account key (`GOOGLE_APPLICATION_CREDENTIALS`).

## `customTools` (default DB)

Read-only from this service (`src/lib/firestore/custom-tools.js#getCustomTool`) — full CRUD lives on the admin platform.

| Field | Type | Notes |
| --- | --- | --- |
| `name`, `description` | string | |
| `icon` | string | defaults `"Wrench"` |
| `functionality` | string | |
| `model` | string | defaults `"gemini-3.8-flash"` |
| `code` | string | the sandboxed JS body |
| `fields` | array | admin-configured config field definitions |
| `args` | array | `{ key, type, description, required }` — becomes the Gemini function's parameters |
| `saved` | boolean | |
| `createdBy`, `createdAt`, `updatedAt` | | |

## `agentUsage` (default DB)

Written by `src/lib/firestore/agent-usage.js`. One document per agent per day for the shared cap, and one per agent+visitor+day for the per-visitor cap.

- Doc id `` `${agentId}_${date}` `` → `{ agentId, date, count }` — `consumeDailyMessage(agentId, limit)`.
- Doc id `` `${agentId}_visitor_${visitorId}_${date}` `` → `{ agentId, visitorId, date, count }` — `consumeVisitorDailyMessage(agentId, visitorId, limit)`.

Both are incremented transactionally and return `false` without incrementing once `count >= limit`. `date` is `YYYY-MM-DD` (UTC, `toISOString().slice(0,10)`).

## `moduleInstalls` (default DB)

Written by `src/lib/firestore/module-installs.js#recordModuleInstalls`, one document per installed npm package, purely for audit/visibility:

```
{ module: string, toolId: string, toolName: string, scopeId: string, installedAt: ISO string }
```

## `conversations` (chat-history DB)

Written/read by `src/lib/firestore/chat-history.js`. Document id = the widget's `sessionId` (regenerated every page load / "new chat", so a refresh always starts a new document rather than overwriting history).

```
{
  agentId: string,
  visitorId: string,        // persists across refreshes via localStorage
  visitorNumber?: number,    // "Visitor 14": allocated when this doc is created, see visitor-numbers below
  domain: string,            // hostname the widget was embedded on, set once at creation
  startedAt: ISO string,
  updatedAt: ISO string,
  status?: "jumpin" | "solved",
  unseenByVisitor?: number,
  messages: [
    { role: "user" | "model" | "human", text: string, allowHtml?: boolean, at: ISO string, messageId?, replyTo?,
      authorId?, authorName? /* "human" messages, written by customer-panel */ }
  ],
  // Denormalized for customer-panel's inbox list, which reads with select() and never loads `messages`.
  // Every append here writes them, and so does customer-panel's sendHumanMessage.
  lastMessageText?: string,   // plain-text excerpt (HTML/markdown stripped), 160 chars
  lastMessageRole?: "user" | "model" | "human",
  lastMessageAt?: ISO string,
  visitorMessageCount?: number, // +1 per visitor message; the panel's unread count is a difference of this
  waitingSince?: ISO string,    // first visitor message no human has answered yet; set on the handoff turn
                                // and on a jumpin visitor message while unset, cleared by a human reply
  // Written by notifyHandoff (lib/notify-handoff.js) after every handoff email attempt. On the doc, not
  // in `messages`, because the widget renders every message. Also the 10-minute throttle's clock.
  handoffNotification?: { status: "sent" | "skipped" | "failed", reason?: string, recipients?: number, at: ISO string },
  // customer-panel team notes live in a `notes` subcollection and never pass through this service. Their
  // counters (noteCount, lastNoteAt, notesChangedAt, notesReadAt, unreadMentions) are on the doc but are
  // never returned to the widget (getConversationState picks its fields explicitly).
  // Owned by customer-panel's team inbox (see its docs/data-model.md): assignee, assignedAt, assignedBy,
  // solvedBy, solvedAt, activity, lastReadAt, readVisitorCount. cdn-service reads only `assignee`.
}
```

- `recordConversationTurn` — transactionally creates the doc (first turn) or appends a `[user, model]` pair via `FieldValue.arrayUnion`, updating `status` if provided, plus the summary fields above (`waitingSince` only on a `jumpin` turn). Used by both `routes/chat.js` and `lib/channel-pipeline.js`.
- `appendVisitorMessage` — appends a single `user` message with no paired reply, used once a conversation is `jumpin` (by `POST /message`, by `/chat` when it races a status change, and by the channel pipeline). Now a transaction, so it can set `waitingSince` only if unset; still fails on a missing doc.
- `getConversationState` — returns `{ status, name, assigned, messages }` for the widget's poll loop and history view. `assigned` is true once a customer-panel team member has taken the conversation.
- `cancelJumpin(id, visitorId, agentId)` — the visitor backing out of a handoff. Refuses with `code: "already-active"` (409) once a human has replied **or** an active team member is the `assignee`: taking a conversation is the same "a human has picked this up" signal as the first reply, so the existing rule covers it. An assignee who has been disabled or removed doesn't count; the panel treats those as unassigned, and cancelling also clears the stale assignee.
- `markConversationSeenByVisitor` — clears `unseenByVisitor` to `0` without touching `updatedAt` (so reading your own conversation doesn't bump its sort position elsewhere).
- `listConversationsForVisitor(agentId, visitorId)` — filters by `visitorId` + `agentId` equality only (no `orderBy`, to avoid needing a composite Firestore index per customer database); sorts by `updatedAt` descending in memory, capped to 30.
- `deleteConversationForVisitor(id, visitorId, agentId)` — hard delete (`recursiveDelete`, so the customer panel's `notes` subcollection goes too; this service never reads it), after verifying the doc's own `visitorId`/`agentId` match the caller's (throws an `Error` with `.code === "forbidden"` otherwise — this endpoint has no auth beyond the domain allowlist).

## `leads` (chat-history DB)

Append-only, written by `recordLead`. One document per capture (a visitor can hand over details more than once across conversations):

```
{
  agentId, conversationId, visitorId, visitorNumber? /* copied from visitor-numbers, if any */, domain,
  name, email, phone, interest,
  status: "pending",
  createdAt: ISO string
}
```

## `counters/visitors` and `visitor-numbers/{visitorKey}` (chat-history DB)

Sequential, stable, per-customer visitor numbers, so the customer panel shows "Visitor 14" instead of a UUID (`src/lib/firestore/visitor-numbers.js`). The number belongs to the visitorId, not the conversation.

```
counters/visitors               { next: number, updatedAt }        // the next number to hand out
visitor-numbers/{visitorKey}    { number, visitorId, firstSeenAt, backfilled? }
```

- `visitorKey(visitorId)` is the id itself when it's a safe doc id, else `h_` + its SHA-256 (the widget's visitorId is client-supplied).
- `recordConversationTurn` allocates in the same transaction that creates the conversation doc: it reads the mapping, and only if it's missing reads the counter, then writes both and stamps `visitorNumber` on the new doc. Two new visitors at once contend on the counter and are serialized by the transaction retry. Every conversation-creating path goes through it (`routes/chat.js`, `lib/channel-pipeline.js`; `routes/conversation.js` only appends). `recordLead` copies the number onto the lead.
- `visitorMemory` can't hold the number: it has one doc per (agent, visitor), not per visitor.
- Visitors from before this are numbered by the admin platform's idempotent `scripts/backfill-visitor-numbers.ts` (also run by both redeploy scripts), in order of their first conversation. It reserves a block on the same counter in a transaction, so it can't collide with live allocations.
