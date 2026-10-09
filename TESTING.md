# Testing and verification

## Automated checks available in this repository

There is no `package.json`, lockfile, build system, linter, local Supabase
environment, or browser automation dependency. The project uses Node's built-in
test runner for isolated command-parsing and message-edit utility tests. Checks
run in this session:

```powershell
node --check app.js
node --check config.js
node --check admin-commands.mjs
node --test tests/admin-commands.test.mjs tests/message-utils.test.mjs
```

The syntax checks and nine unit tests passed after the changes. The tests cover
slash-command suggestions and parsing plus message-edit marker preservation,
normal message text, and client-side length/empty checks. They do not verify
database policies, browser behavior, or Realtime delivery.

The localhost preview server was not responding during the final served-page
check, so no fresh browser interaction test was completed.

## Manual message-edit smoke test

After applying the v11 SQL block in a non-production Supabase project:

1. Sign in as a normal member, open a text channel, and send a short message.
2. Use the pencil action, change the message, and save. Confirm the new text and
   `(edited)` marker appear without a page reload.
3. Open the same channel in a second account/browser and confirm the edit arrives
   over Realtime.
4. Refresh and confirm edited text and the marker persist.
5. Try editing another member's message through the Supabase client; RLS must
   reject it.
6. Mute an author and confirm their edit attempt is rejected by both the UI and
   RLS.
7. As a moderator, pin/unpin a message successfully, then confirm a moderator
   cannot update another user's content.
8. Confirm message report snapshots remain as reported and no dashboard path
   reads the private `dms` table.

Do not run this against production data without the project owner's regular
backup and migration process.

## Existing application smoke checks

With a test Supabase project and separate accounts, check signup/login, server
creation, channel switching, messages, private DMs, reactions, profile editing,
moderation, reports, uploads, invites, presence, notifications, and voice. Verify
RLS directly for every privileged action; visual control visibility alone is not
proof of authorization.

For admin commands, type `/` in a server text channel as an admin, select a
suggestion with the keyboard or mouse, and execute commands such as `/mute
username` or `/coins username 250`. Confirm they are hidden for members, operate
in different channels, ask before destructive or grant actions, and still obey
Supabase authorization if called through the client API directly.

For channel organization and saved messages, create a category as the server
owner, move channels between groups, collapse/reopen a group, save a channel
message, open it from the header bookmark, remove it, and verify a second account
cannot view the first account's saved list. Confirm the saved feature never
surfaces private DMs.

## Future automation

Add repeatable browser tests and database-policy integration tests when a safe
test Supabase project and runner are available. Keep them isolated from real
accounts and production data. Candidate coverage is listed in
`IMPLEMENTATION_PLAN.md`.
