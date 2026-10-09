# AGENTS.md — working on Ping (read this first)

Static Discord-clone frontend (GitHub Pages) + Supabase backend (Postgres, Auth,
Realtime, Storage). **No build step, no framework** — vanilla JS ES modules.
Verify with `node --check app.js config.js`.

## File map

- `index.html` — shell: auth, server rail, channels, chat, members, dashboard,
  shop/quests/voice views, modal + toast roots. IDs are the API: JS grabs them
  with `$()`. Don't rename IDs without updating `app.js`.
- `styles.css` — Discord-dark theme via CSS vars (`--accent` is user-overridable).
- `app.js` — everything. Sections in order: helpers → toast/modal → auth →
  shell → messages → channels → DMs → shop/quests/wallet → voice → dashboard.
  `el(tag, text, cls)` builds DOM safely.
- `config.js` — `window.ENV`: Supabase URL + anon key, optional Tenor key.
- `supabase-schema.sql` — the whole backend. Versioned as appended migration
  blocks (currently v1…v15); **always append an idempotent new block, never edit
  old ones** (users re-run the file to upgrade).
- `message-utils.mjs` — pure message-edit formatting helpers, covered by the
  dependency-free Node test in `tests/message-utils.test.mjs`.
- `admin-commands.mjs` — admin slash-command list, picker filtering, and parsing;
  pure helper tests live in `tests/admin-commands.test.mjs`.

## Hard invariants (do not break)

1. **No `innerHTML` with user data, ever.** Build DOM with `el()`/`textContent`.
   The markdown renderer (`richText`) is deliberately HTML-free. XSS here is a
   stored-XSS-in-everyone's-browser bug.
2. **DMs are private.** Nothing — no dashboard query, no admin tool, no stat —
   may read the `dms` table except the two participants (RLS enforces this too).
3. **Wallet is a ledger**, not a column: `quest_claim` / `shop_buy` / `coin_grant`
   rows in `activity_log`, parsed by `myWallet()`. Keep the `action:detail:+amt`
   string formats exactly.
4. **`profiles.equipped` is cosmetic and owner-writable.** Shop *gating* is what
   matters (buy checks balance + Nitro); don't trust equipped for anything else.
5. **Keys:** anon key in `config.js` is fine (public by design + RLS). Never add
   `service_role` anywhere client-side.
6. Realtime subscriptions must be torn down on view switch (`removeChannel`),
   or handlers fire twice. See `selectChannel`/`openDM`/`leaveVoice`.
7. Muted/banned enforcement lives in **both** UI and RLS — keep them in sync.

## Conventions

- Toasts for errors (`toast(msg, "err")`), never `alert()`/`prompt()` — use
  `showModal()` (supports `input`, `initial`, `extra` buttons).
- Dates: UTC ISO in DB; display via `fmtTime` (respects 12/24h setting).
- CSS: new views get `#x-view` + nav wiring in `showView()`.
- Keep functions small; comment only the non-obvious (signaling protocol,
  ledger formats, RLS rationale).
- Run `node --test tests/admin-commands.test.mjs tests/message-utils.test.mjs`
  for isolated UI helper tests when changing commands or message editing.

## Known limits (by design, don't "fix" naively)

- No read receipts anywhere (privacy choice).
- Voice is WebRTC mesh + free TURN (OpenRelay) with STUN fallback; strict NATs
  may still fail — presence roster is the guaranteed part.
- Nitro/coins are virtual; real payments need a real backend (out of scope).
- Dashboard message counts cap at 5,000 rows; chat loads last 100/channel.

## Good next tasks (pick one, keep diffs focused)

- Server folders.
- Typing indicator already exists for channels — extend to DMs.
- Push notifications via Service Worker (needs VAPID backend — flag scope first).
