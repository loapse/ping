# Ping feature status

This checklist describes the current source tree. A feature is not considered
live-verified just because its UI and code exist; live backend behavior depends on
the configured Supabase project and its applied schema.

## Verified in this session

- `node --check app.js` passes.
- `node --check config.js` passes.
- `node --check admin-commands.mjs` passes.
- `node --test tests/admin-commands.test.mjs tests/message-utils.test.mjs` passes
  all nine utility tests.
- An in-app browser tab displayed Ping's sign-in view, but a later HTTP request
  to localhost:8080 failed. A fresh served-page check and message workflow were
  not completed.

## Implemented in source but not fully tested

- Owner-only channel-message editing and moderator pinning via the new v11 SQL
  and frontend code. The migration must be applied before these changes work.
  Image messages are not editable through the message action.

## Implemented but not fully tested

- Supabase authentication and profile setup.
- Persistent public servers, channels, channel messages, and private one-to-one
  DMs with RLS policies.
- Realtime channel messages, reactions, typing, voice signaling, and presence.
- Server creation and direct-link invites; servers are public in this version.
- Profile editing, profile cards, status choices, notification preferences,
  badges, and cosmetic inventory.
- Reports and moderator/admin review tools, including mute/ban, coin grants,
  and badge awards.
- Admin-only slash command picker for moderation, coin/item/badge grants, and
  member/mod role changes in server text channels. The picker is source-tested;
  live authorization still depends on Supabase policies and was not exercised.
- Shared server channel categories with per-device collapse state, plus private
  saved-message references and jump-to-message navigation. These require the
  appended v13/v14 schema blocks and have not been live-tested.
- Search, message replies, reactions, pin lists, image uploads, GIF lookup,
  virtual shop/quests, and first-party Ping Arcade games.

## Partially implemented

- Voice is WebRTC mesh with a free TURN relay and STUN fallback; strict NATs can
  prevent media even when the member roster works.
- Games are first-party Ping Arcade activities. Third-party app OAuth and
  general-purpose integrations are not implemented.
- Invite links navigate to public servers; they do not enforce membership or
  act as secret access tokens.
- Admin dashboards provide operational tools but are not a complete server
  permission editor or audit product.

## Blocked by external requirements

- Live Supabase authorization, migration, Realtime, Storage, and account-flow
  verification requires the owner's configured Supabase project and test
  accounts. No production migration was performed.
- Push notifications need a trusted VAPID-capable backend; this static frontend
  alone cannot securely send them.
- Video and screen sharing need additional signaling, UI, consent, and browser
  testing before they can be represented as working features.

## Not implemented

- Integration and end-to-end test suites; there is no package manifest, local
  Supabase stack, or browser test dependency in the repository.
- Friend requests, group DMs, forum channels, events, polls,
  scheduled messages, bots, webhooks, and server discovery.
- Video calls and screen sharing.
- Third-party OAuth app authorization; the existing app authorization is
  limited to Ping Arcade.

## Important limits

- DMs remain private and must never be included in admin reporting or stats.
- No read receipts by design.
- Wallet balances come from the activity ledger; grants are virtual and are not
  purchases or real currency.
- Chat history loads the latest 100 messages per channel, and dashboard message
  counts inspect at most 5,000 recent public messages.
