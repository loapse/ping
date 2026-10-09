# Ping implementation plan

## Repository baseline

- Static HTML, CSS, and vanilla JavaScript ES modules; no build step or package
  manifest is present.
- Supabase provides Auth, Postgres with RLS, Realtime, and Storage.
- Existing UI includes servers and channels, persistent chat, DMs, profiles,
  badges, presence, notification preferences, reactions, replies, search, pins,
  image uploads, voice, games, reports, and an admin dashboard.
- Baseline `node --check app.js` and `node --check config.js` both pass.
- There is no configured local database or automated browser test suite in this
  repository. Applying schema changes to a live Supabase project is intentionally
  left to the project owner.

## Priorities

### P0 — reliable core

- [x] Inspect the existing static frontend and Supabase schema.
- [x] Record architecture, security, testing, and feature status.
- [x] Add persistent channel-message edits with an edited timestamp and live
  update handling.
- [x] Keep edits owner-only and blocked for muted users in RLS; validate edited
  content in the database.
- [x] Keep moderator pinning functional behind a role-checked database function
  after narrowing direct message update grants.
- [x] Add built-in Node unit tests for preserving reply/announcement markers and
  validating message-edit text.
- [x] Add shared server channel categories with per-server collapsed UI state.
- [x] Add private saved references to channel messages with jump-to navigation.
- [ ] Apply the v11 SQL migration in the configured Supabase project and verify
  edits and pin permissions with separate member, muted, moderator, and admin
  accounts.
- [ ] Add repeatable integration and browser tests once a safe Supabase test
  project is available.

### P1 — core community experience

- [ ] Extend automated coverage for account setup, channel chat, DMs, and
  permission boundaries.
- [ ] Improve accessibility and responsive behavior through a browser review
  at desktop and mobile sizes.
- [ ] Review message search, notifications, server invites, moderation reports,
  and presence using multiple real accounts.
- [ ] Consider server folders and DM typing indicators.

### P2 — advanced communication

- [ ] Evaluate voice reliability in real browsers and networks; document the
  relay limitations and recovery states.
- [ ] Scope video and screen sharing only after the signaling and consent model
  is designed.
- [ ] Consider polls, events, saved messages, and richer message threads.

### P3 — ecosystem

- [ ] Consider bots, webhooks, integrations, server discovery, and scheduled
  messages only with a trusted backend and clear permission boundaries.

## Design and architecture decisions

- Preserve the no-build vanilla JavaScript and Supabase architecture; a rewrite
  would add deployment friction without improving the current core.
- Keep edits within the existing hover actions and message presentation so the
  feature feels native to Ping.
- Use an owner-scoped `UPDATE` policy and a database trigger for edit timestamps
  and length validation. Preserve moderator pinning through a narrow RPC because
  the previous broad pin update policy would otherwise also allow moderators to
  change message content.
- Do not run the new SQL against production from this session. Re-run the full
  guarded schema in the intended Supabase project and verify with test accounts.

## Next engineering step

Run the v11 schema on a non-production Supabase project, then verify that a
member can edit only their own messages, a muted member cannot edit, moderators
can still pin but cannot edit other people's content, and all connected clients
receive the edited text and marker.
