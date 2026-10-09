/* ChatterBox — static frontend + Supabase backend (auth, realtime chat, admin). */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ---------------- helpers ---------------- */
const $ = (id) => document.getElementById(id);
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
const fmtTime = (iso) => new Date(iso).toLocaleString([], {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
});
const AVATAR_COLORS = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#00aff4", "#e67e22", "#9b59b6"];
function avatarColor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function avatarNode(name) {
  const d = el("div", String(name || "?").slice(0, 1).toUpperCase(), "avatar");
  d.style.background = avatarColor(name);
  return d;
}

/* ---------------- toast + modal (no native popups) ---------------- */
function toast(msg, kind = "") {
  const t = el("div", msg, ("toast " + kind).trim());
  $("toasts").appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity .3s";
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 320);
  }, 4000);
}
function showModal({ title, body = "", input = false, placeholder = "", okText = "OK", danger = false }) {
  return new Promise((resolve) => {
    $("modal-title").textContent = title;
    $("modal-body").textContent = body;
    const inp = $("modal-input");
    inp.classList.toggle("hidden", !input);
    inp.value = "";
    inp.placeholder = placeholder;
    $("modal-err").classList.add("hidden");
    const ok = $("modal-ok"), cancel = $("modal-cancel"), overlay = $("modal-overlay");
    ok.textContent = okText;
    ok.classList.toggle("danger", !!danger);
    overlay.classList.remove("hidden");
    if (input) setTimeout(() => inp.focus(), 50);
    const done = (val) => {
      overlay.classList.add("hidden");
      ok.onclick = cancel.onclick = overlay.onclick = null;
      resolve(val);
    };
    cancel.onclick = () => done(null);
    overlay.onclick = (e) => { if (e.target === overlay) done(null); };
    ok.onclick = () => {
      const v = input ? inp.value.trim() : true;
      if (input && !v) {
        const err = $("modal-err");
        err.textContent = "Enter a value.";
        err.classList.remove("hidden");
        return;
      }
      done(v);
    };
  });
}

/* ---------------- message render state (grouping, dividers, scroll) ---------------- */
let lastRenderDay = "", lastRenderUid = "", lastRenderTs = 0;
let stickBottom = true, unreadCount = 0;
const typingUsers = new Map();
let typingTimer = null;

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date(), yest = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}
function renderTyping() {
  const now = Date.now();
  for (const [u, t] of typingUsers) if (now - t > 3500) typingUsers.delete(u);
  const names = [...typingUsers.keys()].filter((u) => !profile || u !== profile.username);
  $("typing-hint").textContent = names.length === 0 ? ""
    : names.length === 1 ? `${names[0]} is typing…`
    : `${names.slice(0, 2).join(" and ")} are typing…`;
  clearTimeout(typingTimer);
  if (names.length) typingTimer = setTimeout(renderTyping, 3600);
}
function bumpPill() {
  unreadCount++;
  $("scroll-count").textContent = unreadCount;
  $("scroll-pill").classList.remove("hidden");
}

/* ---------------- config gate ---------------- */
const ENV = window.ENV || {};
const CONFIGURED = ENV.SUPABASE_URL && !ENV.SUPABASE_URL.includes("YOUR-PROJECT")
  && ENV.SUPABASE_ANON_KEY && !ENV.SUPABASE_ANON_KEY.includes("PASTE-YOUR");
if (!CONFIGURED) {
  $("setup-view").classList.remove("hidden");
} else {
  $("auth-view").classList.remove("hidden");
}
const supabase = CONFIGURED
  ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY)
  : null;

/* ---------------- state ---------------- */
let session = null;
let profile = null;
let servers = [], channels = [], users = [];
let activeServer = null, activeChannel = null;
let msgChannel = null, heartbeat = null;
let myIp = null, authMode = "login";

/* ---------------- IP (consented moderation logging) ---------------- */
async function captureIp() {
  if (myIp !== null) return myIp;
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    myIp = (await r.json()).ip || "unknown";
  } catch { myIp = "unknown"; }
  return myIp;
}

async function logActivity(action, detail = "") {
  if (!supabase || !session) return;
  try {
    await supabase.from("activity_log").insert({
      user_id: session.user.id,
      username: profile ? profile.username : "?",
      action, detail, ip: await captureIp()
    });
  } catch { /* logging must never break chat */ }
}

/* ---------------- auth UI ---------------- */
if (CONFIGURED) {
  $("tab-login").onclick = () => setAuthMode("login");
  $("tab-register").onclick = () => setAuthMode("register");
  $("auth-form").onsubmit = (e) => { e.preventDefault(); doAuth(); };
}
function setAuthMode(mode) {
  authMode = mode;
  $("tab-login").classList.toggle("active", mode === "login");
  $("tab-register").classList.toggle("active", mode === "register");
  $("email-row").classList.toggle("hidden", mode === "login");
  $("auth-submit").textContent = mode === "login" ? "Log In" : "Sign Up";
  $("auth-error").classList.add("hidden");
}
function authFail(msg) {
  const e = $("auth-error");
  e.textContent = msg;
  e.classList.remove("hidden");
}

async function doAuth() {
  const username = $("auth-username").value.trim();
  const password = $("auth-password").value;
  const email = $("auth-email").value.trim().toLowerCase();
  if (!username || !password) return authFail("Fill in every field.");
  $("auth-submit").disabled = true;
  try {
    if (authMode === "register") {
      if (!email || !email.includes("@")) throw new Error("A valid email is required to sign up.");
      const taken = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (taken.data) throw new Error("That username is taken.");
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        throw new Error("Account created — confirm your email, then log in. (Or disable confirmations: Supabase → Authentication → Sign In/Up.)");
      }
      session = data.session;
      const { error: pErr } = await supabase.from("profiles").insert({
        id: session.user.id, username, role: "member"
      });
      if (pErr) throw new Error("Signup ok but profile failed: " + pErr.message);
      await afterLogin(true);
    } else {
      if (!email || !email.includes("@")) throw new Error("Log in with your email + password.");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      session = data.session;
      await afterLogin(false);
    }
  } catch (err) {
    authFail(err.message || "Something went wrong.");
  } finally {
    $("auth-submit").disabled = false;
  }
}

async function afterLogin(isNew) {
  const { data: prof, error } = await supabase.from("profiles")
    .select("*").eq("id", session.user.id).single();
  if (error || !prof) {
    await supabase.auth.signOut();
    session = null;
    throw new Error("No profile for this account. Sign up first.");
  }
  if (prof.is_banned) {
    await supabase.auth.signOut();
    session = null;
    throw new Error("This account is banned.");
  }
  profile = prof;
  await supabase.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", profile.id);
  try {
    await supabase.from("user_ips").insert({
      user_id: profile.id, ip: await captureIp(),
      user_agent: navigator.userAgent.slice(0, 200)
    });
  } catch { /* non-fatal */ }
  await logActivity(isNew ? "signup" : "login", isNew ? "new account: " + profile.username : "");
  enterApp();
}

/* ---------------- app shell ---------------- */
async function enterApp() {
  $("auth-view").classList.add("hidden");
  $("setup-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
  $("user-avatar").textContent = profile.username.slice(0, 1).toUpperCase();
  $("user-avatar").style.background = avatarColor(profile.username);
  $("user-name").textContent = profile.username;
  $("user-role").textContent = profile.role + (profile.is_muted ? " · muted" : "");
  if (profile.role === "admin") $("dashboard-btn").classList.remove("hidden");
  await loadServers();
  heartbeat = setInterval(() => {
    supabase.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", profile.id);
  }, 60000);
}

async function loadServers() {
  const { data } = await supabase.from("servers").select("*").order("id");
  servers = data || [];
  if (servers.length === 0) {
    // First run: seed a home server (any member may do this once).
    const { data: srv } = await supabase.from("servers")
      .insert({ name: "ChatterBox HQ", created_by: profile.id }).select().single();
    if (srv) {
      servers = [srv];
      await supabase.from("channels").insert([
        { server_id: srv.id, name: "general", topic: "Say hi 👋" },
        { server_id: srv.id, name: "rules", topic: "Be kind. Mods log activity." }
      ]);
      await logActivity("server_create", "seeded ChatterBox HQ");
    }
  }
  renderServerRail();
  if (!activeServer || !servers.find((s) => s.id === activeServer.id)) {
    activeServer = servers[0] || null;
  }
  await loadChannels();
}

function renderServerRail() {
  const box = $("server-icons");
  box.innerHTML = "";
  for (const s of servers) {
    const b = el("button", s.name.slice(0, 1).toUpperCase(), "server-icon");
    b.title = s.name;
    if (activeServer && s.id === activeServer.id) b.classList.add("active");
    b.onclick = () => { activeServer = s; renderServerRail(); loadChannels(); };
    box.appendChild(b);
  }
}

async function loadChannels() {
  if (!activeServer) return;
  $("server-header").textContent = activeServer.name;
  const { data } = await supabase.from("channels")
    .select("*").eq("server_id", activeServer.id).order("id");
  channels = data || [];
  const list = $("channel-list");
  list.innerHTML = "";
  list.appendChild(el("div", "TEXT CHANNELS", "chan-group"));
  for (const ch of channels) {
    const b = el("button", null, "chan" + (activeChannel && ch.id === activeChannel.id ? " active" : ""));
    b.appendChild(el("span", "# " + ch.name));
    b.onclick = () => selectChannel(ch.id);
    list.appendChild(b);
  }
  const add = el("button", "+ New channel", "chan chan-add");
  add.onclick = createChannel;
  list.appendChild(add);
  if (!activeChannel || !channels.find((c) => c.id === activeChannel.id)) {
    activeChannel = channels[0] || null;
  }
  await selectChannel(activeChannel ? activeChannel.id : null);
}

async function selectChannel(id) {
  activeChannel = channels.find((c) => c.id === id) || null;
  document.querySelectorAll(".chan").forEach((b) => b.classList.remove("active"));
  if (msgChannel) { await supabase.removeChannel(msgChannel); msgChannel = null; }
  if (!activeChannel) return;
  $("channel-name").textContent = activeChannel.name;
  $("channel-topic").textContent = activeChannel.topic || "";
  $("message-input").placeholder = "Message #" + activeChannel.name;
  loadChannels._paint = true;
  document.querySelectorAll("#channel-list .chan").forEach((b) => {
    if (b.textContent === "# " + activeChannel.name) b.classList.add("active");
  });
  await loadMessages();
  typingUsers.clear();
  renderTyping();
  msgChannel = supabase.channel("chan-" + activeChannel.id)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${activeChannel.id}` },
      (payload) => appendMessage(payload.new, true))
    .on("postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      (payload) => {
        const node = document.querySelector(`.msg[data-mid="${payload.old.id}"]`);
        if (node) node.remove();
      })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (!payload || !payload.user) return;
      typingUsers.set(payload.user, Date.now());
      renderTyping();
    })
    .subscribe();
  await refreshUsers();
}

async function loadMessages() {
  const box = $("messages");
  box.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  lastRenderDay = ""; lastRenderUid = ""; lastRenderTs = 0;
  const { data } = await supabase.from("messages").select("*")
    .eq("channel_id", activeChannel.id).order("id", { ascending: false }).limit(100);
  box.innerHTML = "";
  const rows = (data || []).reverse();
  for (const m of rows) appendMessage(m, false);
  if (!rows.length) box.appendChild(el("div", "No messages yet — say hi! 👋", "empty-note"));
  box.scrollTop = box.scrollHeight;
  stickBottom = true;
  unreadCount = 0;
  $("scroll-pill").classList.add("hidden");
}

function userName(id) {
  const u = users.find((x) => x.id === id);
  return u ? u.username : "unknown";
}
function userRole(id) {
  const u = users.find((x) => x.id === id);
  return u ? u.role : "member";
}

async function appendMessage(m, live) {
  if (!users.find((x) => x.id === m.user_id)) await refreshUsers(true);
  const box = $("messages");
  const day = new Date(m.created_at).toDateString();
  if (day !== lastRenderDay) {
    const dv = el("div", dayLabel(m.created_at), "day-divider");
    box.appendChild(dv);
    lastRenderDay = day;
    lastRenderUid = "";
  }
  const ts = new Date(m.created_at).getTime();
  const grouped = m.user_id === lastRenderUid && ts - lastRenderTs < 5 * 60 * 1000;
  const row = el("div", null, "msg" + (grouped ? " grouped" : ""));
  row.dataset.mid = m.id;
  row.appendChild(avatarNode(userName(m.user_id)));
  const main = el("div");
  if (!grouped) {
    const head = el("div", null, "msg-head");
    const who = el("span", userName(m.user_id), "msg-user" + (userRole(m.user_id) === "admin" ? " admin" : ""));
    head.appendChild(who);
    head.appendChild(el("span", fmtTime(m.created_at), "msg-time"));
    main.appendChild(head);
  } else {
    main.appendChild(el("span", new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), "msg-time-full"));
  }
  main.appendChild(el("div", m.content, "msg-body"));
  row.appendChild(main);
  if (session && (m.user_id === session.user.id || (profile && profile.role === "admin"))) {
    const del = el("button", "🗑", "msg-del");
    del.title = "Delete message";
    del.onclick = async () => {
      const { error } = await supabase.from("messages").delete().eq("id", m.id);
      if (error) toast("Delete failed: " + error.message, "err");
    };
    row.appendChild(del);
  }
  box.appendChild(row);
  lastRenderUid = m.user_id;
  lastRenderTs = ts;
  if (live) {
    if (stickBottom) box.scrollTop = box.scrollHeight;
    else bumpPill();
  }
}

async function refreshUsers(quiet) {
  const { data } = await supabase.from("profiles").select("*").order("username");
  users = data || [];
  const list = $("members-list");
  list.innerHTML = "";
  const now = Date.now();
  let online = 0;
  const admins = users.filter((u) => u.role === "admin");
  const members = users.filter((u) => u.role !== "admin");
  for (const group of [["ADMIN", admins], ["MEMBERS", members]]) {
    if (!group[1].length) continue;
    list.appendChild(el("div", group[0] + " — " + group[1].length, "members-title"));
    for (const u of group[1]) {
      const isOnline = now - new Date(u.last_active).getTime() < 5 * 60 * 1000;
      if (isOnline) online++;
      const row = el("div", null, "member" + (isOnline ? "" : " off"));
      row.appendChild(el("span", null, "dot " + (isOnline ? "on" : "off")));
      row.appendChild(avatarNode(u.username));
      row.appendChild(el("span", u.username + (u.is_muted ? " (muted)" : "") + (u.is_banned ? " (banned)" : "")));
      if (u.role === "admin") row.appendChild(el("span", "ADMIN", "role-tag admin"));
      list.appendChild(row);
    }
  }
  $("members-online").textContent = online;
  $("member-count").textContent = users.length + " members";
  if (!quiet) return;
}

if (CONFIGURED) {
  // scroll stickiness + unread pill
  $("messages").addEventListener("scroll", () => {
    const b = $("messages");
    stickBottom = b.scrollHeight - b.scrollTop - b.clientHeight < 100;
    if (stickBottom) {
      unreadCount = 0;
      $("scroll-pill").classList.add("hidden");
    }
  });
  $("scroll-pill").onclick = () => {
    const b = $("messages");
    b.scrollTop = b.scrollHeight;
    stickBottom = true;
    unreadCount = 0;
    $("scroll-pill").classList.add("hidden");
  };

  // typing broadcast (throttled)
  let lastTypeSent = 0;
  $("message-input").addEventListener("input", () => {
    if (!msgChannel || !profile) return;
    const now = Date.now();
    if (now - lastTypeSent < 2000) return;
    lastTypeSent = now;
    msgChannel.send({ type: "broadcast", event: "typing", payload: { user: profile.username } });
  });

  // emoji picker
  const EMOJIS = ["😀","😂","😍","🤔","👍","👎","🎉","❤️","🔥","😎","😭","🙏","👏","💀","🤝","✨","🎮","⚽","🍕","🚀","🌙","☀️","🐱","🐶","💯","✅","❌","❓","❗","🤖","👑","💬","🎵","📸","🌈","⭐","💡","🎯","🏆","😴"];
  const pk = $("emoji-picker");
  for (const e of EMOJIS) {
    const s = el("span", e, "em");
    s.onclick = () => {
      const inp = $("message-input");
      inp.value += e;
      inp.focus();
    };
    pk.appendChild(s);
  }
  $("emoji-btn").onclick = (ev) => { ev.stopPropagation(); pk.classList.toggle("hidden"); };
  document.addEventListener("click", (e) => {
    if (!pk.classList.contains("hidden") && !pk.contains(e.target) && e.target.id !== "emoji-btn")
      pk.classList.add("hidden");
  });

  // show/hide password
  $("pw-toggle").onclick = () => {
    const p = $("auth-password");
    p.type = p.type === "password" ? "text" : "password";
  };

  $("message-form").onsubmit = async (e) => {
    e.preventDefault();
    const input = $("message-input");
    const text = input.value.trim();
    if (!text || !activeChannel) return;
    if (profile.is_muted) {
      input.value = "";
      input.placeholder = "You are muted.";
      return;
    }
    input.value = "";
    $("emoji-picker").classList.add("hidden");
    const { error } = await supabase.from("messages").insert({
      channel_id: activeChannel.id, user_id: session.user.id, content: text.slice(0, 500)
    });
    if (error) toast("Couldn't send: " + error.message, "err");
  };

  $("add-server-btn").onclick = async () => {
    const name = await showModal({ title: "Create server", input: true, placeholder: "Server name", okText: "Create" });
    if (!name) return;
    const { data, error } = await supabase.from("servers")
      .insert({ name: name.slice(0, 40), created_by: profile.id }).select().single();
    if (error) { toast("Couldn't create server: " + error.message, "err"); return; }
    await supabase.from("channels").insert({ server_id: data.id, name: "general", topic: "" });
    await logActivity("server_create", name.trim().slice(0, 40));
    activeServer = data;
    renderServerRail();
    loadChannels();
  };

  $("logout-btn").onclick = async () => {
    await logActivity("logout", "");
    clearInterval(heartbeat);
    if (msgChannel) await supabase.removeChannel(msgChannel);
    await supabase.auth.signOut();
    location.reload();
  };

  $("dashboard-btn").onclick = () => {
    $("chat-view").classList.add("hidden");
    $("dashboard-view").classList.remove("hidden");
    loadDashboard();
  };
  $("dash-close").onclick = () => {
    $("dashboard-view").classList.add("hidden");
    $("chat-view").classList.remove("hidden");
  };
}

async function createChannel() {
  const raw = await showModal({ title: "New channel", input: true, placeholder: "channel-name", okText: "Create" });
  if (!raw) return;
  const clean = raw.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
  const { error } = await supabase.from("channels")
    .insert({ server_id: activeServer.id, name: clean, topic: "" });
  if (error) { toast("Couldn't create channel: " + error.message, "err"); return; }
  loadChannels();
}

/* ---------------- admin dashboard ---------------- */
async function loadDashboard() {
  const [{ data: allUsers }, { data: msgs }, { data: acts }, { data: ips }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("messages").select("user_id").limit(5000),
    supabase.from("activity_log").select("*").order("id", { ascending: false }).limit(60),
    supabase.from("user_ips").select("*").order("seen_at", { ascending: false }).limit(500)
  ]);
  users = allUsers || [];
  const msgCount = {};
  for (const m of msgs || []) msgCount[m.user_id] = (msgCount[m.user_id] || 0) + 1;
  const latestIp = {};
  for (const r of ips || []) if (!(r.user_id in latestIp)) latestIp[r.user_id] = r.ip;

  $("stat-users").textContent = users.length;
  $("stat-messages").textContent = (msgs || []).length + (msgs && msgs.length === 5000 ? "+" : "");
  const weekAgo = Date.now() - 7 * 864e5;
  $("stat-logins").textContent = (acts || []).filter(
    (a) => a.action === "login" && new Date(a.created_at).getTime() > weekAgo).length;
  $("stat-muted").textContent = users.filter((u) => u.is_muted || u.is_banned).length;

  const tb = document.querySelector("#users-table tbody");
  tb.innerHTML = "";
  for (const u of users) {
    const tr = document.createElement("tr");
    const cells = [u.username, u.role, fmtTime(u.created_at), fmtTime(u.last_active),
      msgCount[u.id] || 0, latestIp[u.id] || "n/a"];
    for (const c of cells) tr.appendChild(el("td", String(c)));
    const act = el("td");
    if (u.id !== profile.id) {
      const mute = el("button", u.is_muted ? "Unmute" : "Mute", "mini-btn");
      mute.onclick = () => modUser(u, "is_muted", !u.is_muted);
      const ban = el("button", u.is_banned ? "Unban" : "Ban",
        "mini-btn " + (u.is_banned ? "good" : "danger"));
      ban.onclick = () => modUser(u, "is_banned", !u.is_banned);
      act.appendChild(mute);
      act.appendChild(ban);
    } else {
      act.appendChild(el("span", "(you)", "muted"));
    }
    tr.appendChild(act);
    tb.appendChild(tr);
  }

  const feed = $("activity-feed");
  feed.innerHTML = "";
  for (const a of (acts || []).filter((x) => !x.action.startsWith("mod_")).slice(0, 30)) {
    const d = el("div", null, "feed-item");
    d.appendChild(el("b", `${a.username} — ${a.action}${a.detail ? ": " + a.detail : ""}`));
    d.appendChild(el("span", fmtTime(a.created_at) + (a.ip ? " · " + a.ip : ""), "t"));
    feed.appendChild(d);
  }
  if (!feed.children.length) feed.appendChild(el("p", "No activity yet.", "muted"));

  const mod = $("mod-log");
  mod.innerHTML = "";
  for (const a of (acts || []).filter((x) => x.action.startsWith("mod_")).slice(0, 30)) {
    const d = el("div", null, "mod-item");
    d.appendChild(el("b", `${a.username} — ${a.action}: ${a.detail}`));
    d.appendChild(el("span", fmtTime(a.created_at), "t"));
    mod.appendChild(d);
  }
  if (!mod.children.length) mod.appendChild(el("p", "No moderation actions yet.", "muted"));
}

async function modUser(u, field, value) {
  const action = field === "is_muted" ? (value ? "mod_mute" : "mod_unmute") : (value ? "mod_ban" : "mod_unban");
  const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", u.id);
  if (error) { toast("Action failed: " + error.message, "err"); return; }
  await logActivity(action, `${u.username} → ${value}`);
  loadDashboard();
  refreshUsers();
}

/* ---------------- restore session ---------------- */
if (CONFIGURED) {
  supabase.auth.getSession().then(async ({ data }) => {
    if (!data.session) return;
    session = data.session;
    try {
      await afterLogin(false);
    } catch (err) {
      authFail(err.message);
      $("auth-view").classList.remove("hidden");
    }
  });
}
