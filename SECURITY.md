# Ping security notes

## Security boundaries

- `config.js` may contain only the Supabase URL and anon public key (and the
  optional Tenor key). These values are visible in a static site. Never put a
  Supabase service-role key or other server secret in the browser.
- Postgres RLS is the authorization boundary for profiles, messages, DMs,
  activity, reports, badges, and app data. Hiding a UI control is not security.
- DMs are private to the two participants. Do not query `dms` from the dashboard,
  moderation views, or analytics.
- Saved messages reference rows in `messages` only. Keep their RLS owner-scoped;
  never save or expose `dms` through this feature.
- User-generated chat, profile, and report text must be inserted with DOM APIs
  and `textContent`. Keep markdown rendering HTML-free.
- The wallet is a ledger in `activity_log`; preserve its validated action/detail
  formats and admin-only grant restrictions.
- Realtime subscriptions must be removed on view changes to avoid stale
  handlers and accidental cross-view updates.
- Muted/banned enforcement must remain consistent between UI checks and database
  policies.

## Message changes

The v11 migration removes direct update grants on `messages`, then grants update
only on `content`. The owner policy checks `auth.uid() = user_id` and rejects
muted profiles. A trigger enforces the 1–500 character edit limit and sets
`updated_at`, preventing the client from forging the edit time. Pin changes use
`set_message_pin`, a security-definer function with a fixed search path and an
explicit admin/moderator role check. The migration has not been applied to a
live project in this session.

The v12 admin-command functions use security-definer RPCs for mute/ban and role
changes because authenticated clients do not have direct grants on those
profile columns. The RPCs validate the caller's database role, restrict allowed
fields and role values, and limit ban and role changes to admins. The command
picker is a convenience; these database checks are the authorization boundary.
Apply the complete SQL file before using these commands.

The v14 `saved_messages` table contains only a member's own references to public
channel messages. It has no DM foreign key or dashboard query. Channel category
updates remain protected by the existing server-owner/admin channel policy.

## Existing privacy tradeoffs

- Public messages and display profiles are readable by authenticated visitors
  so public chat can work from a static frontend.
- Uploaded images are placed in a public Storage bucket. Do not upload private
  or sensitive images there.
- Login IP capture is disclosed by the application and restricted to moderation
  roles by RLS. Avoid logging IPs or private message content in other features.
- A static app cannot enforce a server-side ban at authentication time; the
  current client rejects banned profiles after sign-in and RLS protects its
  data operations.

## Review before deployment

Apply the complete SQL file to a test project first. Verify owner, muted user,
moderator, admin, and anonymous behavior through the Supabase API, including that
moderators can pin but cannot edit another person's content and cannot access
DMs. Review Supabase policies after every schema upgrade. No production SQL,
deployment, or secret handling was performed here.
