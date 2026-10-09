# ChatterBox — real-time community chat (static frontend + Supabase backend)

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
   This creates `profiles`, `servers`, `channels`, `messages`, `activity_log`,
   `user_ips` plus Row Level Security rules (muted users are rejected by the
   database itself, IPs are admin-eyes-only).
> Already ran v1? Just re-run the file — every statement is guarded
> (`if not exists` / `drop policy if exists`), so it's safe to run again for
> the message-delete policies.

### 2. Connect the site
1. In Supabase: **Project Settings → API** — copy the **Project URL** and the
   **anon public key** (never the `service_role` key).
2. Paste both into **`config.js`**.

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

- **Dashboard (👑):** user table (role, joined, last active, message count, **login IP**),
  login/signup activity feed, moderation log, live stats.
- **Mute** blocks sending (enforced in UI *and* database). **Ban** blocks login.
  Every action is written to the moderation log.
- **IPs** are captured at login via the signup/login consent notice shown on the
  site. Use them only for moderation (e.g. ban evasion). Your community's rules
  should say the same.

## Honest limits

- Anyone with the anon key + project URL can read public tables by design
  (that's how the chat works). Never store secrets in chat or profiles.
- If someone bypasses the UI with raw API calls, RLS still blocks: sending as
  muted, reading IPs/activity without admin, editing others' profiles.
- `messages` query caps: dashboard counts use the latest 5,000 messages and the
  chat loads the latest 100 per channel — plenty for a community server.
- Banned-user blocking happens at login in the app (Supabase Auth itself has no
  per-user ban; a banned user can't do anything but sign in and get rejected).
