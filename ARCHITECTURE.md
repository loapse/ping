# Ping architecture

## Runtime

Ping is a static single-page application. `index.html` provides the application
shell and stable element IDs, `styles.css` contains the responsive dark theme,
`app.js` implements the UI and data flows as a browser ES module, and `config.js`
provides `window.ENV`. There is no bundler, framework, or server-side application
code.

The browser loads Supabase JS v2 from jsDelivr. Supabase Auth identifies users;
Postgres stores profiles, servers, categorized channels, messages, private saved
message references, DMs, reactions, reports, activity, and game data; RLS
controls access; Realtime broadcasts changes; and Storage hosts uploaded images.

## Main flows

- On sign-in, the client restores or creates the user's profile, loads public
  servers, and subscribes to the active channel.
- Channel messages are persisted in `messages` and received through scoped
  Realtime subscriptions. The UI loads the latest 100 messages per channel.
- Server owners organize channels into shared categories. Collapsed category
  state is a local UI preference saved per server in local storage.
- Saved messages reference public channel messages only. The `saved_messages`
  table is owner-readable and owner-writable under RLS; it never includes DMs.
- Direct messages use the separate `dms` table. Its select policy only exposes
  rows to their sender and recipient; no admin view reads that table.
- Profile data is public for display. Owner-editable profile columns are kept
  separate from admin-controlled role and moderation columns by SQL grants.
- Virtual coins are reconstructed from `activity_log` entries. Preserve the
  established ledger action/detail strings.
- Voice uses browser WebRTC mesh, Supabase Realtime signaling, STUN, and a free
  TURN relay. The roster is the fallback when media cannot connect.

## Message edits and pins

The v11 SQL block adds nullable `messages.updated_at`. Authors update only the
`content` column under an RLS policy that requires message ownership and an
unmuted profile. A trigger validates non-empty content up to 500 characters and
sets the timestamp. The client listens for message UPDATE events, rerenders the
edited content safely, updates reply snippets, and marks the timestamp.

Pinning remains limited to admins and moderators. Direct UPDATE privileges are
narrowed to message content, while `set_message_pin` checks the caller's current
role before changing the pin flag. Its `SECURITY DEFINER` search path is fixed,
and execute is granted only to authenticated users.

The v13/v14 blocks add channel categories and per-user saved message references.
Saved entries cascade away when a public channel message is deleted, and RLS
limits each account to its own saved list.

## Persistence and deployment

The frontend is served from any static HTTP host (including GitHub Pages). The
complete `supabase-schema.sql` file is the versioned database upgrade source;
new upgrades append guarded blocks. Realtime publication and Storage bucket
configuration are managed in Supabase. There is no local database emulator or
build output.

## Constraints

- `index.html` IDs are consumed by `app.js`; treat them as an API.
- DOM for user data must be created with `el()` and `textContent`, never unsafe
  HTML insertion.
- Realtime channels must be removed when a view changes.
- Never move service-role credentials into the static client.
- Push delivery, secret-bearing integrations, and secure invite enforcement need
  a trusted backend and cannot be completed by static frontend changes alone.
