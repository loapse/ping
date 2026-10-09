# Ping — real-time community chat (static frontend + Supabase backend)

A Discord-style chatroom that **actually works** across visitors: real accounts,
real shared messages, servers/channels, and an admin dashboard with activity
and login IPs. Hosted free on GitHub Pages, data free on Supabase.

## How it works

- **Frontend** (`index.html`, `styles.css`, `app.js`) — pure static, hosted on GitHub Pages.
- **Backend** — Supabase (free tier): Postgres + Auth + Realtime. No server code to run.

## Setup (one time, ~10 minutes)

### 1. Create the database
1. Go to **supabase.com** → sign up → **New project** (free).
2. Open **SQL Editor** → paste the entire contents of **`supabase-schema.sql`** → **Run**.
> Re-run the whole file after every update — all statements are guarded, so it's
> always safe. Needed for reactions, DMs, delete, avatars, shop/quests, voice,
> and mod roles.

### 2. Connect the site (+ optional GIFs)
1. In Supabase: **Project Settings → API** — copy the **Project URL** and the
   **anon public key** (never the `service_role` key) into **`config.js`**.
2. GIF search (optional): free key at **developers.google.com/tenor** (Tenor API v2)
   → paste as `TENOR_API_KEY` in `config.js`. No key = no GIF button, everything
   else works.

### 3. Allow open signup (pick one)
- **Option A (recommended):** Authentication → Sign In/Up → **disable "Confirm email"**.
  Users can register + log in immediately.
- **Option B:** leave confirmations on — users click the email link, then log in.

### 4. Make yourself admin
Supabase → **Table Editor → profiles** → find your row → set `role` to `admin`.
(Or SQL Editor: `update profiles set role = 'admin' where username = 'YOURNAME';`)
The 👑 dashboard button then appears in your user panel.

## Publish to github.io

1. Create a GitHub repo (e.g. `yourname.github.io`, or any name + Pages).
2. Upload all files (`index.html`, `styles.css`, `app.js`, `config.js`) to the repo root.
   Do **not** upload `README.md`/`supabase-schema.sql` if you want — they're harmless, just unused.
3. Repo **Settings → Pages** → Deploy from branch → `main` / root → Save.
4. Open `https://YOURNAME.github.io` (or `https://YOURNAME.github.io/REPO/`).

## Admin guide

- **Dashboard (👑, admins + mods):** user table (role, joined, last active,
  message count, **login IP**), per-user detail (activity, all IPs, grant coins
  or shop items),
  login/signup feed, moderation log, live stats. Click any username for detail.
- **Roles:** `update profiles set role = 'mod' where username = 'X';` — mods can
  mute, delete messages, and see IPs/activity, but can't ban or change roles.
- **Mute** blocks sending (UI *and* database). **Ban** (admin only) blocks login.
  Every action lands in the moderation log. 📢 posts banner announcements.
- **DMs are private:** never on the dashboard, unreadable even by admins.
- **Admin slash commands:** In any server text channel, type `/` to open the
  command picker. Use `/mute username`, `/ban username`, `/coins username 250`,
  `/item username item-id`, `/badge username badge-id`, or
  `/role username member|mod`; unmute and unban are available too. Suggestions
  are admin-only, and commands that change access or grant items ask for
  confirmation. Item and badge IDs are listed in the Shop and admin badge manager.
- **Nitro/shop/coins are 100% virtual** (no payments exist on static hosting):
  coins come from daily quests, the shop sells avatar frames, name colors, and
  30-day Nitro (animated glow + rainbow frame).
- **Ping Arcade:** authorize the first-party app on your account to play Tic-Tac-Toe
  and Quickdraw, with scores saved to your Ping profile. Third-party OAuth apps
  are not connected by this static frontend.
- **Voice channels** carry real browser audio over a free TURN relay (port 443,
  which most networks leave open) with automatic retry and per-peer status
  (direct / relayed / connecting). If audio still can't connect on a locked-down
  network, presence (who's in the channel) keeps working, and the UI says why.
- **Extras:** emoji reactions, GIFs (needs free Tenor key), quoted replies,
  markdown (`**bold**` `*italic*` `__underline__` `||spoiler||` `` `code` ``),
  message search with jump-to, pinned messages, clickable profiles, image
  uploads (5 MB, public `chat-uploads` bucket).
- **IPs** are captured at login under the site's consent notice. Moderation use only.

## Login not working? (checklist)

1. **"Email not confirmed"** → either click the link in your inbox (check spam),
   or turn confirmations off: Supabase → Authentication → Sign In/Up → disable
   **"Confirm email"**. A **Resend confirmation email** button appears automatically.
2. **"No profile / pick a username"** → your login worked but signup never finished;
   just choose a username in the popup and you're in.
3. **Nothing happens at all** → open DevTools (F12 → Console): red errors naming
   `supabase` mean `config.js` still has placeholder keys; RLS errors mean the
   schema wasn't run (step 1).
4. **Log in with email, not username.** Usernames are display-only.

## Customization included

- **Everyone:** accent color, chat text size, compact mode, mention sounds,
  12/24h clock, avatar emoji — gear icon in the user panel.
- **Servers:** anyone can create a server. Use the invite arrow in a server
  channel to copy a link that opens that public server; click the server name to
  rename it (creator or admin), and use the channel ⚙ for topic/rename/delete.
  All servers are public in this version; invite links are direct links, not access
  codes.
- **Channel categories:** server owners and admins can create categories, add
  channels from each category header, move channels from settings, and collapse
  groups. Collapse state is saved on that device.
- **Saved messages:** star a public channel message, then use the bookmark button
  in the chat header to browse, remove, or jump back to saved posts. Saved items
  are private to your account; direct messages are not included.
- **DMs:** click any member to message them; ＋ New DM by username.

## Honest limits

- Anyone with the anon key + project URL can read public tables by design
  (that's how the chat works). Never store secrets in chat or profiles.
- If someone bypasses the UI with raw API calls, RLS still blocks: sending as
  muted, reading IPs/activity without admin, editing others' profiles.
- `messages` query caps: dashboard counts use the latest 5,000 messages and the
  chat loads the latest 100 per channel — plenty for a community server.
- Banned-user blocking happens at login in the app (Supabase Auth itself has no
  per-user ban; a banned user can't do anything but sign in and get rejected).

## Development and upgrades

Ping is a static site with no build step. From the project folder, run
`npx.cmd --yes http-server . -p 8080` and open `http://127.0.0.1:8080/`. The
page needs internet access for Supabase and the Supabase JavaScript module loaded
from jsDelivr. Configure the project URL and anon public key in `config.js` first.

Authors can edit their own channel messages; edits are persisted, broadcast over
Realtime, and marked in chat. Moderators pin messages through a restricted
database function. Re-run the entire `supabase-schema.sql` file in the Supabase
SQL Editor to apply the v11 upgrade; it adds an `updated_at` field, owner-only
edit policy, edit validation, and the moderator pin function without deleting
existing messages.

The v12 SQL block also installs role-checked RPCs required by admin slash
commands. Re-run the complete schema file before using commands that mute,
ban, or change a member's role.

The v13/v14 schema blocks add channel categories and private saved messages.
Re-run the complete schema file to install them.

The repository has no package manager or build step. Its JavaScript syntax and
message-edit utility checks use Node's built-in tools:

```powershell
node --check app.js
node --check config.js
node --check admin-commands.mjs
node --test tests/admin-commands.test.mjs tests/message-utils.test.mjs
```

See `IMPLEMENTATION_PLAN.md`, `FEATURE_STATUS.md`, `ARCHITECTURE.md`,
`SECURITY.md`, and `TESTING.md` for implementation notes and verification
limits. Authentication, Realtime, storage, and RLS behavior still need a live
check against the configured Supabase project after its schema is upgraded.
