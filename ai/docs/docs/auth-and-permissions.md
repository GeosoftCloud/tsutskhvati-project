# Auth & permissions

## Provider and session strategy

Google OAuth only, Auth.js/NextAuth v5, JWT sessions (`src/auth.ts` + `src/auth.config.ts`). `auth.config.ts` is the edge-safe half (no Firestore access) used by `src/proxy.ts`'s middleware; `auth.ts` adds the Firestore-backed `signIn`/`jwt`/`session` callbacks. Custom sign-in/error page: `/login`.

## The team whitelist

Gated by a central Firestore `teamMembers` collection (`src/lib/firestore/team.ts`) — no open sign-up, and (unlike `customer-panel`) **no bootstrap-admin path**: the first team member has to be seeded directly, e.g. via `scripts/seed-admin.mjs`, before anyone can sign in at all.

`signIn` callback: allows sign-in only if a `teamMembers` doc exists for that email with `status === "active"`. `jwt` callback re-checks the whitelist on every token refresh (not just at sign-in) and, if the member is gone or `disabled`, zeroes `permission`/`isAdmin`/`memberId` and sets `status: "disabled"` on the token — this is what `src/proxy.ts` acts on to actually redirect and clear cookies (see [architecture.md](architecture.md)).

## Two independent axes: `permission` and `isAdmin`

Unlike `customer-panel` (which only has `isAdmin`), this platform's `TeamMember` has **both**:

```ts
type Permission = "read" | "write";
type TeamMember = { id, email, name, permission: Permission, isAdmin: boolean, status: "active" | "disabled", invitedBy, createdAt };
```

- **`permission`** (`read` | `write`) — gates every content mutation: creating/editing/deleting customers, agents, custom tools, and tickets. Checked via `canWrite(permission)` (`src/lib/permissions.ts`) at the top of essentially every Server Action and API route that writes data. A `read` member can browse everything but can't change anything.
- **`isAdmin`** — gates the **Team** page and its Server Actions only (invite/edit/remove team members). It does *not* imply write access to content — an admin with `permission: "read"` can manage the team roster but still can't edit an agent.

## Managing other team members

`team/actions.ts` layers an extra `canManageOthers()` check on top of `requireAdmin()` for `updateTeamMemberAction`/`removeTeamMemberAction`:

```ts
function canManageOthers(user) {
  return user.isAdmin === true && user.permission === "write" && user.status === "active";
}
```

So changing or removing *another* member requires all three: admin, write permission, and active status — an admin with only read access can view the Team page but can't act on it. As in `customer-panel`, a member can never modify or remove **their own** row (`session.user.memberId === id` short-circuits both actions) — self-lockout protection.

## Where `canWrite()` is enforced

Every one of these throws/403s for a `read`-only member:

- `agents/actions.ts` — create/save graph/rename/save generation meta/save chatbox/generate chatbox/publish
- `agents/[id]/actions.ts`, `api/agents/[id]/generate-schema/route.ts`
- `tools/actions.ts`, `tools/[id]/actions.ts` — create/delete/save/generate/fix/test-run
- `customers/actions.ts`, `api/customers/register/route.ts`, `api/customers/[id]/retry/route.ts` — delete/update/grant-panel-access/register/retry
- `tickets/actions.ts` — start-working/complete/send-message (reading tickets and their messages only requires a signed-in session, not write)

`POST /api/agents/[id]/run` (the admin test chatbox) intentionally requires **only** a signed-in session, not write permission — running a test chat doesn't mutate the agent itself.
