# Meta comments: Graph API reference for this codebase

One lookup, done 2026-11-11 against Meta's developer docs. Everything in cdn-service
(`src/lib/meta-comments.js`, `src/lib/channel-senders.js`) and the admin's channel save
(`src/app/(app)/agents/[id]/actions.ts`) is built from this file. Where Meta's docs were vague or
contradicted each other, that's said below; check those points on the first live test.

## Version

| Version | Released | Available until |
|---|---|---|
| **v26.0** | 2026-07-29 | TBD (current) |
| v25.0 | 2026-02-18 | 2028-07-29 |
| v19.0 | 2024-01-23 | **2026-05-21 (sunset)** |

Every Graph call goes through one constant, `GRAPH_API_VERSION = "v26.0"`:
cdn-service `src/lib/graph-api.js` and admin `src/lib/graph-api.ts`. The v19.0 pin was already past
its sunset, so Meta was silently upgrading those calls to the oldest available version.

## Webhook payloads

Comments come in on the same per-agent webhook URL and app subscription as DMs. They arrive in
`entry[].changes[]`, while DMs arrive in `entry[].messaging[]`. One POST can contain both.

### Facebook Page, `field: "feed"` (Messenger webhook URL, `object: "page"`)

```json
{
  "object": "page",
  "entry": [{
    "id": "<PAGE_ID>",
    "time": 1762858000,
    "changes": [{
      "field": "feed",
      "value": {
        "item": "comment",
        "verb": "add",
        "comment_id": "<POST_ID>_<COMMENT_ID>",
        "post_id": "<PAGE_ID>_<POST_ID>",
        "parent_id": "<PAGE_ID>_<POST_ID>",
        "from": { "id": "<USER_OR_PAGE_ID>", "name": "Nana K." },
        "message": "რა ღირს 2 ოთახიანი?",
        "created_time": 1762858000,
        "post": { "id": "<PAGE_ID>_<POST_ID>", "permalink_url": "https://www.facebook.com/...", "status_type": "added_photos", "is_published": true }
      }
    }]
  }]
}
```
- `verb`: `add | edited | remove | hide | unhide`. We only handle `add`.
- `item` is also `post`, `reaction`, `status`, `photo`, `video`, `share`, and so on. We only handle `comment`.
- `parent_id == post_id` means a top-level comment. Any other value is the comment this one replies to.
- `from.id == entry.id` (the page) means our own reply or a page admin's comment. **Skip it**,
  or the bot will answer itself in a loop.
- `message` can be **missing**, for example on a sticker or photo-only comment, or for some
  privacy-restricted users. Treat that as empty text: triage sees "(no text)".
- `created_time` is unix **seconds**.
- Ads: comments on dark posts and ads come in the same way. The `post_id` belongs to the ad's
  story. There's no separate field for them.

### Instagram, `field: "comments"` (Instagram webhook URL, `object: "instagram"`)

```json
{
  "object": "instagram",
  "entry": [{
    "id": "<IG_USER_ID>",
    "time": 1762858000,
    "changes": [{
      "field": "comments",
      "value": {
        "id": "<IG_COMMENT_ID>",
        "text": "price?",
        "from": { "id": "<IGSID>", "username": "nana.k" },
        "media": { "id": "<IG_MEDIA_ID>", "media_product_type": "FEED" },
        "parent_id": "<IG_COMMENT_ID>"
      }
    }]
  }]
}
```
- There's no `verb`. Instagram only sends this field for new comments, so every event counts as an add.
- `parent_id` is present only on replies.
- There's no `created_time` on the value. Use `entry.time`; we accept both seconds and ms.
- `media_product_type`: `FEED | REELS | AD | STORY`. Album comments don't carry the album
  id, so the comment's `media` field has to be queried for it. We fall back to `media.id`.
- `from.id == instagramAccountId` means our own reply. **Skip it.**
- Live comments use a separate field, `live_comments`, which we don't subscribe to.

## Endpoints we call (all `https://graph.facebook.com/v26.0`, Page access token)

| Action | Facebook | Instagram |
|---|---|---|
| Public reply | `POST /{comment-id}/comments` `message=` | `POST /{ig-comment-id}/replies` `message=` |
| Private reply (comment → DM) | `POST /me/messages` `{recipient:{comment_id}, message:{text}}` | same (`/me` = the linked Page) |
| Hide | `POST /{comment-id}` `is_hidden=true` | `POST /{ig-comment-id}` `hide=true` |
| Post caption, once per post | `GET /{post-id}?fields=message,permalink_url,full_picture` | `GET /{media-id}?fields=caption,permalink,media_url,thumbnail_url,media_type` |
| Subscribe page to app | `POST /{page-id}/subscribed_apps` `subscribed_fields=messages,feed` | `POST /{page-id}/subscribed_apps` `subscribed_fields=messages` on the **linked Page** (see below) |

Notes:
- **IG replies only attach to top-level comments.** A reply to a reply is added to the top-level
  thread, so we always reply to the comment id we received. You can't reply to a hidden comment,
  so we hide *after* replying, never before.
- **Private replies:** one message per comment, within **7 days** of the comment. For live
  comments, only during the broadcast. The private reply **does not open the 24-hour window**. We
  can only keep messaging after the person answers, and their answer arrives as an ordinary DM
  webhook on the existing messenger/instagram pipeline. The response is
  `{recipient_id, message_id}`. We store `recipient_id` (the PSID/IGSID) so the later DM can be
  linked back to the comment.
- **Facebook hide:** the Comment reference documents `is_hidden` on `POST /{comment_id}` ("only
  applicable to Page comments"). Some third-party guides say it doesn't work; check it on the
  first live run.
- A page or IG account owner's own comments are always shown, even with `hide=true`.

## Subscriptions

- **Facebook:** `POST /{page-id}/subscribed_apps?subscribed_fields=messages,feed` with the Page
  token. This needs `pages_manage_metadata`, and the token must belong to someone with the
  `MODERATE`, `CREATE_CONTENT` or `MANAGE` task on the page. The admin calls this on channel save
  (`subscribeMetaPage` in admin `src/lib/graph-api.ts`).
- **Instagram (API with Facebook Login):** the IG account's webhooks run through the linked
  Page, so the admin also calls `subscribed_apps` on the page with `subscribed_fields=messages`.
  It needs the Page id, so the Instagram card asks for one. The Instagram webhook **fields**
  (`comments`, `messages`) are app-level settings in App Dashboard → Webhooks → Instagram, and
  Facebook Login has no API to tick them per account. That's a one-time manual step per Meta app,
  and the card says so.
- The webhook URLs and verify token per object (Page / Instagram) are still set once in the App
  Dashboard, the same as today.

## Permissions (shown in the admin's Comments card)

| Permission | Why |
|---|---|
| `pages_show_list` | list and confirm the page |
| `pages_manage_metadata` | `subscribed_apps` and receiving `feed` webhooks |
| `pages_read_engagement` | read posts and comments (captions) |
| `pages_read_user_content` | read user comments on the page |
| `pages_manage_engagement` | reply to and hide page comments |
| `pages_messaging` | DMs and private replies (Facebook **and** Instagram) |
| `instagram_basic` | read IG media and captions |
| `instagram_manage_comments` | IG comment webhooks, reply, hide, IG private replies |
| `instagram_manage_messages` | IG DMs (already needed today) |

Meta's IG private-reply page lists `instagram_manage_comments` + `pages_messaging` (no
`instagram_manage_messages`), plus the **Human Agent** feature. The newer "Instagram API with
Instagram Login" flow uses different names (`instagram_business_manage_comments`, …). We use the
Facebook Login flow, the same as the DMs, so we use the names above.

## Needs App Review / Advanced Access / Business Verification

Apps with **Standard Access** only get webhooks and API access for people who have a role on the
app. For real customers' comments, each of these needs **Advanced Access**, which goes through App
Review:
- `pages_read_user_content`, `pages_manage_engagement`, `pages_manage_metadata`,
  `pages_read_engagement`, `pages_messaging`, `pages_show_list`
- `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`
- Meta: "Your app must have successfully completed App Review (advanced access) to receive
  webhook notifications for `comments` and `live_comments` fields."
- IG private replies also list the **Human Agent** feature and Advanced Access.
- Advanced Access requires **Business Verification** of the business that owns the app.
- `Page Public Content Access` is **not** needed: we only read the customer's own page.

## Rate limits and policy we enforce ourselves

- Meta retries deliveries that don't get a fast 200. We acknowledge first, then dedupe on
  `processed-comments/{commentId}`, created with `create()` and carrying an `expireAt` TTL field.
- Our own per-commenter-per-post and per-agent hourly caps (see `CommentSettings`) keep us far
  below Graph's page-level limits, and away from looking like spam.
- Replies are delayed by a random 20–90 s by default. That runs as an in-process timer after the
  200 has gone out, the same pattern as DM handling. A restart loses a pending reply, which is
  acceptable for comments.
