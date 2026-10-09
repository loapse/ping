/* Ping — static frontend + Supabase backend (auth, realtime chat, admin). */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { composeEditedMessage, getMessageEditDraft } from "./message-utils.mjs";
import { ADMIN_COMMANDS, getAdminCommandMatches, parseAdminCommand } from "./admin-commands.mjs";

/* ---------------- helpers ---------------- */
const $ = (id) => document.getElementById(id);
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
let activeBadgeTooltip = null;
function hideBadgeTooltip() {
  if (!activeBadgeTooltip) return;
  activeBadgeTooltip.anchor.removeAttribute("aria-describedby");
  activeBadgeTooltip.tooltip.remove();
  activeBadgeTooltip = null;
}
function showBadgeTooltip(anchor, heading, detail = "") {
  hideBadgeTooltip();
  const tooltip = el("div", null, "ping-badge-tooltip");
  tooltip.id = "ping-badge-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.appendChild(el("strong", heading));
  if (detail) tooltip.appendChild(el("span", detail));
  document.body.appendChild(tooltip);
  const rect = anchor.getBoundingClientRect();
  const halfWidth = Math.min(130, Math.max(80, window.innerWidth / 2 - 12));
  tooltip.style.left = Math.max(halfWidth, Math.min(window.innerWidth - halfWidth, rect.left + rect.width / 2)) + "px";
  const below = rect.top < 84;
  tooltip.style.top = (below ? rect.bottom + 9 : rect.top - 9) + "px";
  tooltip.classList.toggle("below", below);
  anchor.setAttribute("aria-describedby", tooltip.id);
  activeBadgeTooltip = { anchor, tooltip };
}
function attachBadgeTooltip(node, heading, detail = "") {
  node.setAttribute("aria-label", detail ? `${heading}: ${detail}` : heading);
  node.tabIndex = node.closest("button") ? -1 : 0;
  node.addEventListener("mouseenter", () => showBadgeTooltip(node, heading, detail));
  node.addEventListener("mouseleave", () => { if (!node.matches(":focus")) hideBadgeTooltip(); });
  node.addEventListener("focus", () => showBadgeTooltip(node, heading, detail));
  node.addEventListener("blur", () => { if (!node.matches(":hover")) hideBadgeTooltip(); });
  return node;
}
function roleBadge(role) {
  if (role !== "admin" && role !== "mod") return null;
  const label = role === "admin" ? "Administrator" : "Moderator";
  const badge = el("span", null, "role-badge " + role);
  badge.setAttribute("role", "img");
  attachBadgeTooltip(badge, label, role === "admin"
    ? "Can manage Ping and moderate the community."
    : "Can help moderate this community.");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const shield = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shield.setAttribute("d", "M8 1.1 13.2 3v4.1c0 3.2-2.1 5.9-5.2 7.7-3.1-1.8-5.2-4.5-5.2-7.7V3L8 1.1Z");
  shield.setAttribute("fill", "currentColor");
  const check = document.createElementNS("http://www.w3.org/2000/svg", "path");
  check.setAttribute("d", "m5.2 7.7 1.8 1.8 3.8-4");
  check.setAttribute("fill", "none");
  check.setAttribute("stroke", "var(--bg-1)");
  check.setAttribute("stroke-width", "1.5");
  check.setAttribute("stroke-linecap", "round");
  check.setAttribute("stroke-linejoin", "round");
  svg.append(shield, check);
  badge.appendChild(svg);
  return badge;
}
const SPECIAL_BADGES = [
  { id: "founder", label: "Founding Member", icon: "🌟" },
  { id: "early_supporter", label: "Early Supporter", icon: "💜" },
  { id: "event_winner", label: "Event Champion", icon: "🏆" },
  { id: "helper", label: "Helpful Member", icon: "💡" },
  { id: "builder", label: "Community Builder", icon: "🛠️" },
  { id: "artist", label: "Artist", icon: "🎨" },
  { id: "bug_hunter", label: "Bug Hunter", icon: "🐛" },
  { id: "veteran", label: "Ping Veteran", icon: "⚔️" },
  { id: "vip", label: "VIP", icon: "💎" },
  { id: "community_voice", label: "Community Voice", icon: "📣" }
];
const SPECIAL_BADGE_DETAILS = {
  founder: "One of Ping's first community members.",
  early_supporter: "Supported Ping during its early days.",
  event_winner: "Won a Ping community event.",
  helper: "Recognized for helping other members.",
  builder: "Helped grow or improve the community.",
  artist: "Shared creative work with the community.",
  bug_hunter: "Helped find and report Ping bugs.",
  veteran: "A long-time member of the Ping community.",
  vip: "A special guest of the community.",
  community_voice: "Helped shape the direction of the community."
};
function specialBadgeNode(id, labeled = false) {
  const badge = SPECIAL_BADGES.find((item) => item.id === id);
  if (!badge) return null;
  const node = el("span", null, "special-badge badge-" + badge.id);
  node.setAttribute("role", "img");
  attachBadgeTooltip(node, badge.label, SPECIAL_BADGE_DETAILS[badge.id]);
  node.appendChild(el("span", badge.icon, "special-badge-icon"));
  if (labeled) node.appendChild(el("span", badge.label, "special-badge-label"));
  return node;
}
function appendSpecialBadgeStrip(parent, uid, { labels = false, limit = 3 } = {}) {
  const ids = userBadges.get(uid) || [];
  if (!ids.length) return;
  const strip = el("span", null, "special-badge-strip" + (labels ? " labeled" : ""));
  for (const id of ids.slice(0, limit)) {
    const badge = specialBadgeNode(id, labels);
    if (badge) strip.appendChild(badge);
  }
  if (!labels && ids.length > limit) {
    const overflow = el("span", "+" + (ids.length - limit), "special-badge-overflow");
    const more = ids.slice(limit).map((id) => SPECIAL_BADGES.find((badge) => badge.id === id)?.label).filter(Boolean).join(", ");
    attachBadgeTooltip(overflow, "More badges", more);
    strip.appendChild(overflow);
  }
  parent.appendChild(strip);
}
const fmtTime = (iso) => new Date(iso).toLocaleString([], {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  hour12: !uiSettings.clock24
});
const AVATAR_COLORS = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#00aff4", "#e67e22", "#9b59b6"];
function avatarColor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function avatarNode(name, emoji, equip) {
  const d = el("div", null, "avatar");
  if (emoji) {
    d.textContent = emoji;
  } else {
    d.textContent = String(name || "?").slice(0, 1).toUpperCase();
    d.style.background = avatarColor(name);
  }
  equip = equip || {};
  if (equip.frame) d.classList.add("fr-" + String(equip.frame).replace("frame-", ""));
  if (equip.nitro) d.classList.add("nitro-on");
  return d;
}
function userEmoji(id) {
  const u = users.find((x) => x.id === id);
  return u ? u.avatar_emoji : null;
}
function userEquip(id) {
  const u = users.find((x) => x.id === id);
  return (u && u.equipped) || {};
}
function profileTrigger(node, uid, label = "View profile") {
  node.classList.add("profile-trigger");
  node.setAttribute("role", "button");
  node.setAttribute("tabindex", "0");
  node.setAttribute("aria-label", label);
  node.title = label;
  node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openProfile(uid);
  });
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    openProfile(uid);
  });
  return node;
}
const isAdmin = () => profile && profile.role === "admin";
const canMod = () => profile && (profile.role === "admin" || profile.role === "mod");
function setMobileNav(open) {
  const isOpen = !!open;
  document.body.classList.toggle("mobile-nav-open", isOpen);
  $("mobile-nav-backdrop").classList.toggle("hidden", !isOpen);
  $("mobile-nav-btn").setAttribute("aria-expanded", String(isOpen));
}
/* message cache for reply quotes (cleared per thread load) */
const msgCache = new Map();
let replyTo = null;

/* ---------------- per-user UI settings (this browser) ---------------- */
const DEFAULT_UI = {
  accent: "#5865f2", fontSize: 14, compact: false, sounds: true, clock24: false,
  channelNotifications: "mentions", dmNotifications: true, inAppNotifications: true, desktopNotifications: false
};
let uiSettings = { ...DEFAULT_UI };
try { Object.assign(uiSettings, JSON.parse(localStorage.getItem("ping-settings") || "{}")); } catch { /* fresh */ }
if (!["all", "mentions", "none"].includes(uiSettings.channelNotifications)) uiSettings.channelNotifications = DEFAULT_UI.channelNotifications;
function saveUiSettings() {
  localStorage.setItem("ping-settings", JSON.stringify(uiSettings));
  applyUiSettings();
}
function applyUiSettings() {
  document.documentElement.style.setProperty("--accent", uiSettings.accent);
  document.documentElement.style.setProperty("--accent-h", uiSettings.accent);
  document.body.style.fontSize = uiSettings.fontSize + "px";
  document.body.classList.toggle("compact", !!uiSettings.compact);
}
applyUiSettings();
function playBlip() {
  if (!uiSettings.sounds) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.connect(gn); gn.connect(ctx.destination);
    o.frequency.value = 880; gn.gain.value = 0.06;
    o.start(); o.stop(ctx.currentTime + 0.12);
  } catch { /* no audio */ }
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
function showModal({ title, body = "", input = false, initial = "", placeholder = "", maxLength = 60, okText = "OK", danger = false, extra = [] }) {
  return new Promise((resolve) => {
    $("modal-title").textContent = title;
    $("modal-body").textContent = body;
    const inp = $("modal-input");
    inp.classList.toggle("hidden", !input);
    inp.value = initial || "";
    inp.placeholder = placeholder;
    inp.maxLength = maxLength;
    $("modal-err").classList.add("hidden");
    const ok = $("modal-ok"), cancel = $("modal-cancel"), overlay = $("modal-overlay");
    ok.textContent = okText;
    ok.classList.toggle("danger", !!danger);
    overlay.querySelectorAll(".modal-extra-btn").forEach((b) => b.remove());
    for (const x of extra) {
      const b = el("button", x.label, "btn-secondary modal-extra-btn");
      if (x.cls === "danger") b.style.background = "var(--red)", b.style.color = "#fff";
      b.type = "button";
      b.onclick = () => done(x.value);
      ok.parentElement.insertBefore(b, ok);
    }
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

function hideAdminCommandPicker() {
  const picker = $("command-picker");
  if (!picker) return;
  picker.classList.add("hidden");
  picker.replaceChildren();
  $("message-input").setAttribute("aria-expanded", "false");
  $("message-input").removeAttribute("aria-activedescendant");
}

function selectAdminCommand(name) {
  const command = ADMIN_COMMANDS.find((item) => item.name === name);
  if (!command) return;
  const input = $("message-input");
  input.value = "/" + command.name + " ";
  hideAdminCommandPicker();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function renderAdminCommandPicker() {
  const input = $("message-input");
  const picker = $("command-picker");
  if (!isAdmin() || view.type !== "channel" || !input.value.startsWith("/")) {
    hideAdminCommandPicker();
    return;
  }
  const matches = getAdminCommandMatches(input.value);
  if (!matches.length && /\s/.test(input.value.slice(1))) {
    hideAdminCommandPicker();
    return;
  }
  picker.replaceChildren();
  picker.appendChild(el("div", "ADMIN COMMANDS", "command-picker-title"));
  if (!matches.length) {
    picker.appendChild(el("div", "No matching command. Type / to see available commands.", "command-picker-empty"));
  } else {
    for (const command of matches) {
      const option = el("button", null, "command-option");
      option.type = "button";
      option.id = "admin-command-" + command.name;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      const name = el("span", "/" + command.name, "command-option-name");
      const usage = el("span", command.usage, "command-option-usage");
      const detail = el("span", command.description, "command-option-detail");
      option.append(name, usage, detail);
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.onclick = () => selectAdminCommand(command.name);
      picker.appendChild(option);
    }
    picker.appendChild(el("div", "Use ↑/↓ to move · Enter to select · Esc to close", "command-picker-hint"));
  }
  picker.classList.remove("hidden");
  input.setAttribute("aria-expanded", "true");
  const first = picker.querySelector('[role="option"]');
  if (first) input.setAttribute("aria-activedescendant", first.id);
  else input.removeAttribute("aria-activedescendant");
}

function moveAdminCommandSelection(direction) {
  const options = [...$("command-picker").querySelectorAll('[role="option"]')];
  if (!options.length) return;
  let index = options.findIndex((option) => option.getAttribute("aria-selected") === "true");
  index = index < 0
    ? (direction > 0 ? 0 : options.length - 1)
    : (index + direction + options.length) % options.length;
  options.forEach((option, at) => option.setAttribute("aria-selected", String(at === index)));
  $("message-input").setAttribute("aria-activedescendant", options[index].id);
  options[index].scrollIntoView({ block: "nearest" });
}

/* ---------------- message render state (grouping, dividers, scroll) ---------------- */
let lastRenderDay = "", lastRenderUid = "", lastRenderTs = 0;
let stickBottom = true, unreadCount = 0;
const typingUsers = new Map();
let typingTimer = null;
const savedMessageIds = new Set();
let savedMessageOwner = null;
let savedMessagesLoaded = false;

async function refreshSavedMessageIds() {
  if (!profile || !supabase) return false;
  if (savedMessageOwner !== profile.id) {
    savedMessageIds.clear();
    savedMessageOwner = profile.id;
    savedMessagesLoaded = false;
  }
  if (savedMessagesLoaded) return true;
  const { data, error } = await supabase.from("saved_messages").select("message_id").eq("user_id", profile.id);
  if (error) return false;
  savedMessageIds.clear();
  for (const row of data || []) savedMessageIds.add(row.message_id);
  savedMessagesLoaded = true;
  return true;
}

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
let serverPermissionCache = new Map();
let serverRoleRows = [];
let serverRoleAssignments = [];
let userBadges = new Map();
let activeServer = null, activeChannel = null;
let msgChannel = null, dmChannel = null, heartbeat = null;
let presenceChannel = null, presenceReady = false, presenceByUser = new Map();
let presenceMode = "online", lastPresenceActivity = Date.now(), lastTrackedPresence = null;
let presenceRefreshTimer = null, presenceActivityInstalled = false, presenceMenu = null;
let myIp = null, authMode = "login";
let lastEmail = "";
/* view: { type: "channel" } for servers, { type: "dm", uid } or { type:"dm", uid:null } for home */
let view = { type: "channel" };
const dmUnread = new Map();
let dmThreadCache = null;
let peopleDirectoryOpen = false;

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
  if (!supabase || !session) return { error: new Error("Not signed in") };
  try {
    return await supabase.from("activity_log").insert({
      user_id: session.user.id,
      username: profile ? profile.username : "?",
      action, detail, ip: await captureIp()
    });
  } catch (error) { return { error }; }
}

const PRESENCE_OPTIONS = [
  { id: "online", label: "Online", detail: "Ready to chat", icon: "●" },
  { id: "idle", label: "Idle", detail: "Away for a bit", icon: "◐" },
  { id: "dnd", label: "Do Not Disturb", detail: "Pause Ping alerts", icon: "⊖" },
  { id: "invisible", label: "Invisible", detail: "Appear offline", icon: "○" }
];
const PRESENCE_IDLE_MS = 5 * 60 * 1000;
function ownPresenceStatus() {
  if (presenceMode === "online" && Date.now() - lastPresenceActivity >= PRESENCE_IDLE_MS) return "idle";
  return presenceMode;
}
function presenceStatusForUser(user) {
  if (!user) return "offline";
  if (presenceReady) {
    const states = presenceByUser.get(String(user.id)) || [];
    if (!states.length) return "offline";
    const modes = states.map((state) => state.status);
    if (modes.includes("dnd")) return "dnd";
    if (modes.includes("online")) return "online";
    return "idle";
  }
  return Date.now() - new Date(user.last_active).getTime() < PRESENCE_IDLE_MS ? "online" : "offline";
}
function presenceLabel(status) {
  if (status === "invisible") return "Invisible";
  if (status === "offline") return "Offline";
  return (PRESENCE_OPTIONS.find((option) => option.id === status) || PRESENCE_OPTIONS[0]).label;
}
function renderOwnPresence() {
  const control = $("user-role");
  if (!control || !profile) return;
  const status = ownPresenceStatus();
  control.textContent = profile.is_muted ? "Muted" : presenceLabel(status);
  control.classList.remove("presence-online", "presence-idle", "presence-dnd", "presence-invisible", "is-muted");
  control.classList.add(profile.is_muted ? "is-muted" : "presence-" + status);
  control.title = "Presence: " + presenceLabel(status) + ". Click to change.";
  control.setAttribute("aria-label", "Set presence. Current status: " + presenceLabel(status));
  control.setAttribute("aria-expanded", String(!!presenceMenu));
}
function closePresenceMenu() {
  if (!presenceMenu) return;
  document.removeEventListener("pointerdown", presenceMenu.onOutside, true);
  window.removeEventListener("resize", closePresenceMenu);
  presenceMenu.node.remove();
  presenceMenu = null;
  renderOwnPresence();
}
function openPresenceMenu() {
  closePresenceMenu();
  const anchor = $("user-role");
  if (!anchor || !profile) return;
  const menu = el("div", null, "presence-menu");
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Choose your presence");
  menu.appendChild(el("div", "SET YOUR STATUS", "presence-menu-title"));
  for (const option of PRESENCE_OPTIONS) {
    const item = el("button", null, "presence-option");
    item.type = "button";
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(ownPresenceStatus() === option.id));
    const dot = el("span", option.icon, "presence-option-icon " + option.id);
    const copy = el("span", null, "presence-option-copy");
    copy.append(el("strong", option.label), el("small", option.detail));
    item.append(dot, copy);
    item.onclick = () => { setPresenceMode(option.id); closePresenceMenu(); };
    menu.appendChild(item);
  }
  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(window.innerWidth - 224, rect.left)) + "px";
  menu.style.top = Math.max(8, rect.top - menu.offsetHeight - 8) + "px";
  const onOutside = (event) => {
    if (!menu.contains(event.target) && event.target !== anchor) closePresenceMenu();
  };
  presenceMenu = { node: menu, onOutside };
  anchor.setAttribute("aria-expanded", "true");
  document.addEventListener("pointerdown", onOutside, true);
  window.addEventListener("resize", closePresenceMenu, { once: true });
  menu.querySelector("button")?.focus();
}
function savePresenceMode() {
  if (!profile) return;
  try { localStorage.setItem("ping-presence", JSON.stringify({ userId: profile.id, status: presenceMode })); } catch { /* storage may be unavailable */ }
}
function schedulePresenceRefresh() {
  clearTimeout(presenceRefreshTimer);
  presenceRefreshTimer = setTimeout(async () => {
    renderOwnPresence();
    if (!profile || $("app-view").classList.contains("hidden")) return;
    await refreshUsers(true);
    if (view.type === "dm") renderDmList(false);
  }, 140);
}
async function syncPresence() {
  if (!presenceChannel || !presenceReady || !profile) return;
  const status = ownPresenceStatus();
  try {
    if (status === "invisible") {
      if (lastTrackedPresence !== "invisible") await presenceChannel.untrack();
      lastTrackedPresence = "invisible";
    } else if (lastTrackedPresence !== status) {
      await presenceChannel.track({ username: profile.username, status });
      lastTrackedPresence = status;
    }
  } catch { /* the database activity timestamp remains a fallback */ }
  renderOwnPresence();
}
async function setPresenceMode(status) {
  if (!PRESENCE_OPTIONS.some((option) => option.id === status)) return;
  presenceMode = status;
  lastPresenceActivity = Date.now();
  savePresenceMode();
  renderOwnPresence();
  await syncPresence();
}
function startPresence() {
  if (!supabase || !session || presenceChannel) return;
  try {
    const channel = supabase.channel("ping-presence", { config: { presence: { key: String(session.user.id) } } });
    presenceChannel = channel;
    channel.on("presence", { event: "sync" }, () => {
      presenceByUser = new Map(Object.entries(channel.presenceState()));
      presenceReady = true;
      schedulePresenceRefresh();
      syncPresence();
    }).subscribe((status) => {
      if (status === "SUBSCRIBED") {
        presenceReady = true;
        schedulePresenceRefresh();
        syncPresence();
      }
    });
  } catch { presenceReady = false; }
}
function notePresenceActivity() {
  const now = Date.now();
  const before = ownPresenceStatus();
  lastPresenceActivity = now;
  if (presenceMode === "idle") {
    presenceMode = "online";
    savePresenceMode();
  }
  if (before !== ownPresenceStatus()) syncPresence();
  renderOwnPresence();
}
function restorePresenceMode() {
  presenceMode = "online";
  try {
    const saved = JSON.parse(localStorage.getItem("ping-presence") || "null");
    if (saved && saved.userId === profile.id && PRESENCE_OPTIONS.some((option) => option.id === saved.status)) {
      presenceMode = saved.status;
    }
  } catch { /* default to online */ }
  lastPresenceActivity = Date.now();
  renderOwnPresence();
}
function installPresenceActivityTracking() {
  if (presenceActivityInstalled) return;
  presenceActivityInstalled = true;
  document.addEventListener("pointermove", notePresenceActivity, { passive: true });
  document.addEventListener("pointerdown", notePresenceActivity, { passive: true });
  document.addEventListener("keydown", notePresenceActivity);
  document.addEventListener("touchstart", notePresenceActivity, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) notePresenceActivity(); });
}
function showMessageNotification(title, body, tag, { toastWhenVisible = false } = {}) {
  if (ownPresenceStatus() === "dnd") return;
  if (document.hidden && uiSettings.desktopNotifications && "Notification" in window && Notification.permission === "granted") {
    try {
      const notice = new Notification(title, { body: String(body).slice(0, 180), tag });
      notice.onclick = () => { window.focus(); notice.close(); };
      return;
    } catch { /* fall back to in-app notice when visible */ }
  }
  if (!document.hidden && toastWhenVisible && uiSettings.inAppNotifications) toast(title + (body ? ": " + body : ""));
}

/* ---------------- auth UI ---------------- */
const TOS_VERSION = "2026-10-09";

function openTermsOfService({ returnToSettings = false, draft = null } = {}) {
  hideBadgeTooltip();
  const card = $("modal-card");
  const overlay = $("modal-overlay");
  const title = $("modal-title");
  const body = $("modal-body");
  const ok = $("modal-ok"), cancel = $("modal-cancel");
  card.classList.remove("profile-card-modal", "profile-editor-modal", "profile-settings-modal");
  card.classList.add("tos-modal");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "modal-title");
  title.classList.remove("hidden");
  title.textContent = "Terms of Service";
  body.replaceChildren();
  body.scrollTop = 0;
  body.className = "tos-content";
  $("modal-input").classList.add("hidden");
  $("modal-err").classList.add("hidden");
  overlay.querySelectorAll(".modal-extra-btn").forEach((button) => button.remove());
  ok.textContent = "Done";
  ok.classList.remove("danger");
  cancel.textContent = "Close";

  body.appendChild(el("p", `Last updated ${TOS_VERSION}. By using Ping, you agree to these community rules.` , "tos-updated"));
  const sections = [
    ["1. Be respectful", "Do not use Ping to threaten, harass, bully, impersonate, or target people with hateful conduct. Do not share another person's private information without permission."],
    ["2. Keep content appropriate and lawful", "Do not post illegal content, sexual exploitation, graphic abuse, malware, scams, spam, or content that infringes someone else's rights. Follow the law where you live."],
    ["3. Use messages and reports responsibly", "Public channel messages can be seen by members of that server and its moderators. Direct messages are for their participants. Use the Report action on a public message when you believe it breaks these terms; do not submit knowingly false or abusive reports."],
    ["4. Moderation and account access", "Ping moderators may review reported public messages and take action such as removing content, muting, or banning an account. Keep your sign-in details secure. You are responsible for activity on your account."],
    ["5. Your content and virtual items", "You keep the rights you already have in content you post. You allow Ping to store and display it as needed to run the service and show it to the intended audience. Ping coins, badges, and game items are virtual features with no cash value and may be changed or removed."],
    ["6. Information used to run Ping", "Ping uses account details, profile information, messages, and activity to provide chat and moderation. For security and moderation, the service may record sign-in activity and an IP address. Public message reports are available to moderators; direct messages are excluded from admin reporting."],
    ["7. Availability and changes", "Ping is provided as-is and may change or be unavailable. These terms may be updated; the current version will be shown here. Continued use after an update means you accept the updated terms."],
    ["8. Contact", "For help with these terms or a moderation decision, contact the Ping server owner or administrator through the community."]
  ];
  for (const [heading, copy] of sections) {
    const section = el("section", null, "tos-section");
    section.appendChild(el("h4", heading));
    section.appendChild(el("p", copy));
    body.appendChild(section);
  }
  body.appendChild(el("p", "This is a plain-language community terms draft. The site owner should review it for their service and publish a separate privacy policy before inviting the public.", "tos-note"));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.add("hidden");
    ok.onclick = cancel.onclick = overlay.onclick = null;
    cancel.textContent = "Cancel";
    card.classList.remove("tos-modal");
    card.removeAttribute("role");
    card.removeAttribute("aria-modal");
    card.removeAttribute("aria-labelledby");
    body.className = "muted small";
    if (returnToSettings) openSettings(draft);
  };
  ok.onclick = close;
  cancel.onclick = close;
  overlay.onclick = (event) => { if (event.target === overlay) close(); };
  body.scrollTop = 0;
  overlay.classList.remove("hidden");
  cancel.focus({ preventScroll: true });
}

if (CONFIGURED) {
  $("tab-login").onclick = () => setAuthMode("login");
  $("tab-register").onclick = () => setAuthMode("register");
  $("tos-open-signup").onclick = () => openTermsOfService();
  $("tos-open-footer").onclick = () => openTermsOfService();
  $("auth-form").onsubmit = (e) => { e.preventDefault(); doAuth(); };
  $("resend-btn").onclick = async () => {
    const email = $("auth-email").value.trim().toLowerCase() || lastEmail;
    if (!email) return;
    const { error } = await supabase.auth.resend({ type: "signup", email });
    toast(error ? "Resend failed: " + error.message : "Confirmation sent — check inbox + spam.", error ? "err" : "ok");
  };
  setAuthMode("login");
}
function setAuthMode(mode) {
  authMode = mode;
  $("tab-login").classList.toggle("active", mode === "login");
  $("tab-register").classList.toggle("active", mode === "register");
  const registering = mode === "register";
  $("tos-consent").classList.toggle("hidden", !registering);
  $("tos-accept").required = registering;
  if (registering) $("tos-accept").checked = false;
  $("email-row").classList.remove("hidden");
  $("username-row").classList.toggle("hidden", !registering);
  $("auth-email").required = true;
  $("auth-username").required = registering;
  $("auth-email").autocomplete = "email";
  $("auth-username").autocomplete = registering ? "username" : "off";
  $("auth-password").autocomplete = registering ? "new-password" : "current-password";
  $("auth-submit").textContent = mode === "login" ? "Log In" : "Sign Up";
  $("auth-error").classList.add("hidden");
  $("resend-btn").classList.add("hidden");
  $("auth-hint").textContent = mode === "login"
    ? "Use the email address you registered with."
    : "Email is only for logging in — everyone else sees your username.";
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
  lastEmail = email;
  if (!password) return authFail("Enter your password.");
  if (!email || !email.includes("@")) return authFail("Enter a valid email address.");
  if (authMode === "register" && !username) return authFail("Choose a username.");
  if (authMode === "register" && !$("tos-accept").checked) return authFail("Please agree to Ping's Terms of Service before signing up.");
  $("auth-submit").disabled = true;
  try {
    if (authMode === "register") {
      if (!email || !email.includes("@")) throw new Error("A valid email is required to sign up.");
      const taken = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      if (taken.data) throw new Error("That username is taken.");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { ping_tos_version: TOS_VERSION, ping_tos_accepted_at: new Date().toISOString() } }
      });
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
    const msg = err.message || "Something went wrong.";
    authFail(msg);
    // Unconfirmed email is the #1 login failure — offer the fix inline.
    if (/confirm/i.test(msg)) $("resend-btn").classList.remove("hidden");
    else $("resend-btn").classList.add("hidden");
  } finally {
    $("auth-submit").disabled = false;
  }
}

async function afterLogin(isNew) {
  let { data: prof } = await supabase.from("profiles")
    .select("*").eq("id", session.user.id).single();
  if (!prof) {
    // Half-finished signup (or old account): recover by creating the profile now.
    const name = await showModal({
      title: "Pick a username",
      body: "Your login works but has no chat profile yet. Choose a display name to finish setup.",
      input: true, placeholder: "username", okText: "Continue"
    });
    if (!name) {
      await supabase.auth.signOut();
      session = null;
      throw new Error("Setup cancelled — log in again when ready.");
    }
    const taken = await supabase.from("profiles").select("id").eq("username", name).maybeSingle();
    if (taken.data) throw new Error("That username is taken — log in again with a different one.");
    const { error: insErr } = await supabase.from("profiles").insert({ id: session.user.id, username: name });
    if (insErr) throw new Error("Couldn't create profile: " + insErr.message);
    const re = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    prof = re.data;
    if (!prof) throw new Error("Profile still missing — try logging in again.");
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
  const av = $("user-avatar");
  if (profile.avatar_emoji) {
    av.textContent = profile.avatar_emoji;
    av.style.background = "var(--bg-3)";
  } else {
    av.textContent = profile.username.slice(0, 1).toUpperCase();
    av.style.background = avatarColor(profile.username);
  }
  const panelName = $("user-name");
  panelName.textContent = profile.username;
  const panelBadge = roleBadge(profile.role);
  if (panelBadge) panelName.appendChild(panelBadge);
  appendSpecialBadgeStrip(panelName, profile.id, { limit: 2 });
  profileTrigger(av, profile.id, "View your profile");
  profileTrigger(panelName, profile.id, "View your profile");
  restorePresenceMode();
  $("user-role").onclick = openPresenceMenu;
  installPresenceActivityTracking();
  startPresence();
  if (profile.role === "admin" || profile.role === "mod") $("dashboard-btn").classList.remove("hidden");
  if (ENV.TENOR_API_KEY) $("gif-btn").classList.remove("hidden");
  ensureDmSub();
  updateCoinPill();
  await loadServers();
  heartbeat = setInterval(() => {
    supabase.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", profile.id);
    syncPresence();
  }, 60000);
}

async function loadServers() {
  const { data } = await supabase.from("servers").select("*").order("id");
  servers = data || [];
  if (servers.length === 0) {
    // First run: seed the public home server.
    const { data: srv } = await supabase.from("servers")
      .insert({ name: "Ping Public Chat", created_by: profile.id }).select().single();
    if (srv) {
      servers = [srv];
      await supabase.from("channels").insert([
        { server_id: srv.id, name: "general", topic: "Say hi 👋" },
        { server_id: srv.id, name: "rules", topic: "Be kind. Mods log activity." }
      ]);
      await logActivity("server_create", "seeded Ping Public Chat");
    }
  }
  const requestedServer = new URLSearchParams(window.location.search).get("server");
  const invitedServer = requestedServer && servers.find((s) => String(s.id) === requestedServer);
  if (invitedServer) activeServer = invitedServer;
  else if (!activeServer || !servers.find((s) => s.id === activeServer.id))
    activeServer = servers.find((s) => s.name === "Ping Public Chat") || servers[0] || null;
  renderServerRail();
  await loadChannels();
  if (invitedServer) toast("Opened " + invitedServer.name + " from your invite link.", "ok");
  else if (requestedServer) toast("That server invite could not be found.", "err");
}

function paintDmUnread() {
  const home = document.querySelector("#server-rail .home");
  if (!home) return;
  let badge = $("home-unread");
  if (!badge) {
    badge = el("span", null, "unread-badge");
    badge.id = "home-unread";
    badge.setAttribute("aria-live", "polite");
    home.appendChild(badge);
  }
  const total = Array.from(dmUnread.values()).reduce((sum, count) => sum + count, 0);
  badge.textContent = total > 99 ? "99+" : String(total);
  badge.classList.toggle("hidden", total === 0);
  const label = total ? "Home, " + total + " unread direct messages" : "Home";
  home.setAttribute("aria-label", label);
  home.title = total ? total + " unread direct message" + (total === 1 ? "" : "s") : "Home";
}

function renderServerRail() {
  const box = $("server-icons");
  box.innerHTML = "";
  for (const s of servers) {
    const b = el("button", s.name.slice(0, 1).toUpperCase(), "server-icon");
    b.title = s.name;
    if (activeServer && s.id === activeServer.id) b.classList.add("active");
    b.onclick = () => {
      view = { type: "channel" };
      activeServer = s;
      renderServerRail();
      loadChannels();
    };
    box.appendChild(b);
  }
  const home = document.querySelector("#server-rail .home");
  if (home) home.classList.toggle("active", view.type !== "channel");
  paintDmUnread();
}

async function loadChannels() {
  if (!activeServer) return;
  document.body.classList.remove("dm-home");
  $("dm-search-wrap").classList.add("hidden");
  $("extra-nav").classList.add("hidden");
  $("dm-search").value = "";
  peopleDirectoryOpen = false;
  view = { type: "channel" };
  paintAnnounceBtn();
  $("server-header").textContent = activeServer.name;
  $("server-header").style.cursor = "pointer";
  $("server-header").title = "Server settings";
  const { data } = await supabase.from("channels")
    .select("*").eq("server_id", activeServer.id).order("id");
  channels = data || [];
  const list = $("channel-list");
  list.innerHTML = "";
  list.appendChild(el("div", "TEXT CHANNELS", "chan-group"));
  await refreshServerPermissions(activeServer);
  const canManage = canManageChannels(activeServer);
  for (const ch of channels) {
    const isVoice = (ch.kind || "text") === "voice";
    const b = el("button", null, "chan" + (activeChannel && ch.id === activeChannel.id ? " active" : ""));
    b.dataset.channelId = String(ch.id);
    b.appendChild(el("span", (isVoice ? "🔊 " : "# ") + ch.name));
    if (canManage) {
      const gear = el("span", "⚙", "chan-gear");
      gear.title = "Channel settings";
      gear.onclick = (ev) => { ev.stopPropagation(); channelMenu(ch); };
      b.appendChild(gear);
    }
    b.onclick = () => { if (isVoice) { if (voiceId === ch.id) showVoiceView(); else joinVoice(ch); } else selectChannel(ch.id); };
    list.appendChild(b);
    if (isVoice) {
      const rdiv = el("div", null, "roster");
      rdiv.id = "roster-" + ch.id;
      list.appendChild(rdiv);
    }
  }
  const oldChannelButtons = [...list.children].filter((node) => node.classList.contains("chan") && !node.classList.contains("chan-add"));
  const oldRosters = new Map([...list.children].filter((node) => node.classList.contains("roster")).map((node) => [node.id, node]));
  const collapsedKey = `ping-collapsed-categories-${activeServer.id}`;
  let collapsed = new Set();
  try { collapsed = new Set(JSON.parse(localStorage.getItem(collapsedKey) || "[]")); } catch { /* reset malformed local state */ }
  const grouped = new Map();
  for (const ch of channels) {
    const category = String(ch.category || "").trim();
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(ch);
  }
  const categoryNames = [...grouped.keys()].sort((a, b) => {
    if (a === b) return 0;
    return !a ? -1 : !b ? 1 : a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  list.replaceChildren();
  for (const category of categoryNames) {
    const section = el("section", null, "channel-category");
    const header = el("div", null, "category-header");
    const toggle = el("button", null, "chan-group category-toggle");
    toggle.type = "button";
    const key = category || "__uncategorized";
    const items = el("div", null, "channel-category-items");
    items.hidden = collapsed.has(key);
    const paintToggle = () => {
      toggle.replaceChildren(el("span", items.hidden ? "›" : "⌄", "category-chevron"),
        el("span", category || "CHANNELS", "category-title"),
        el("span", String(grouped.get(category).length), "category-count"));
      toggle.setAttribute("aria-expanded", String(!items.hidden));
    };
    paintToggle();
    toggle.onclick = () => {
      items.hidden = !items.hidden;
      if (items.hidden) collapsed.add(key); else collapsed.delete(key);
      try { localStorage.setItem(collapsedKey, JSON.stringify([...collapsed])); } catch { /* storage is optional */ }
      paintToggle();
    };
    header.appendChild(toggle);
    if (canManage) {
      const add = el("button", "+", "category-add");
      add.type = "button";
      add.title = category ? `Add a channel to ${category}` : "Add an ungrouped channel";
      add.setAttribute("aria-label", add.title);
      add.onclick = () => createChannel("text", category);
      header.appendChild(add);
    }
    section.appendChild(header);
    for (const ch of grouped.get(category)) {
      const button = oldChannelButtons[channels.indexOf(ch)];
      if (button) items.appendChild(button);
      const roster = oldRosters.get("roster-" + ch.id);
      if (roster) items.appendChild(roster);
    }
    section.appendChild(items);
    list.appendChild(section);
  }
  if (canManage) {
    const addT = el("button", "+ Text channel", "chan chan-add");
    addT.onclick = () => createChannel("text");
    list.appendChild(addT);
    const addV = el("button", "+ Voice channel", "chan chan-add");
    addV.onclick = () => createChannel("voice");
    list.appendChild(addV);
    const addCategory = el("button", "+ Category", "chan chan-add category-create");
    addCategory.onclick = createCategory;
    list.appendChild(addCategory);
  }
  if (!activeChannel || !channels.find((c) => c.id === activeChannel.id)) {
    activeChannel = channels.find((c) => (c.kind || "text") === "text") || null;
  }
  await selectChannel(activeChannel ? activeChannel.id : null);
  watchVoiceRosters();
}

async function selectChannel(id, focusMessageId = null) {
  setMobileNav(false);
  view = { type: "channel" };
  renderServerRail();
  activeChannel = channels.find((c) => c.id === id) || null;
  $("dm-header-avatar").classList.add("hidden");
  $("channel-name").classList.remove("profile-trigger");
  $("channel-name").removeAttribute("role");
  $("channel-name").removeAttribute("tabindex");
  $("channel-name").removeAttribute("aria-label");
  $("channel-name").onclick = null;
  $("channel-name").onkeydown = null;
  $("channel-hash").textContent = "#";
  document.querySelectorAll(".chan").forEach((b) => b.classList.remove("active"));
  if (msgChannel) { await supabase.removeChannel(msgChannel); msgChannel = null; }
  if (!activeChannel) return;
  $("channel-name").textContent = activeChannel.name;
  $("channel-topic").textContent = activeChannel.topic || "";
  $("message-input").placeholder = "Message #" + activeChannel.name;
  paintAnnounceBtn();
  document.querySelectorAll("#channel-list .chan").forEach((b) => {
    if (b.dataset.channelId === String(activeChannel.id)) b.classList.add("active");
  });
  await loadMessages(focusMessageId);
  typingUsers.clear();
  renderTyping();
  msgChannel = supabase.channel("chan-" + activeChannel.id)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${activeChannel.id}` },
      (payload) => appendMessage(payload.new, true))
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${activeChannel.id}` },
      (payload) => { if (payload.new && typeof payload.new.content === "string") applyMessageUpdate(payload.new); })
    .on("postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      (payload) => {
        msgCache.delete(payload.old.id);
        const node = document.querySelector(`.msg[data-mid="${payload.old.id}"]`);
        if (node) node.remove();
      })
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "message_reactions" },
      (payload) => {
        const r = payload.new;
        if (!reactionMap.has(r.message_id)) reactionMap.set(r.message_id, new Map());
        const em = reactionMap.get(r.message_id);
        if (!em.has(r.emoji)) em.set(r.emoji, new Set());
        em.get(r.emoji).add(r.user_id);
        repaintReaction(r.message_id);
      })
    .on("postgres_changes",
      { event: "DELETE", schema: "public", table: "message_reactions" },
      (payload) => {
        const o = payload.old;
        const em = reactionMap.get(o.message_id);
        if (em && em.get(o.emoji)) {
          em.get(o.emoji).delete(o.user_id);
          if (!em.get(o.emoji).size) em.delete(o.emoji);
          repaintReaction(o.message_id);
        }
      })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (!payload || !payload.user) return;
      typingUsers.set(payload.user, Date.now());
      renderTyping();
    })
    .subscribe();
  await refreshUsers();
}

async function loadMessages(focusMessageId = null) {
  const box = $("messages");
  box.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  lastRenderDay = ""; lastRenderUid = ""; lastRenderTs = 0;
  msgCache.clear();
  reactionMap.clear();
  await refreshSavedMessageIds();
  const { data } = await supabase.from("messages").select("*")
    .eq("channel_id", activeChannel.id).order("id", { ascending: false }).limit(100);
  const rows = (data || []).reverse();
  if (focusMessageId && !rows.some((message) => String(message.id) === String(focusMessageId))) {
    const { data: focused } = await supabase.from("messages").select("*")
      .eq("channel_id", activeChannel.id).eq("id", focusMessageId).maybeSingle();
    if (focused) rows.push(focused);
    rows.sort((a, b) => Number(a.id) - Number(b.id));
  }
  if (rows.length) await loadReactions(rows.map((m) => m.id));
  box.innerHTML = "";
  for (const m of rows) appendMessage(m, false);
  if (!rows.length) box.appendChild(el("div", "No messages yet — say hi! 👋", "empty-note"));
  if (focusMessageId) {
    const target = box.querySelector(`.msg[data-mid="${focusMessageId}"]`);
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.classList.add("saved-jump");
      setTimeout(() => target.classList.remove("saved-jump"), 1800);
      stickBottom = false;
    } else {
      box.scrollTop = box.scrollHeight;
      stickBottom = true;
    }
  } else {
    box.scrollTop = box.scrollHeight;
    stickBottom = true;
  }
  unreadCount = 0;
  $("scroll-pill").classList.add("hidden");
}

async function toggleSavedMessage(message, button = null) {
  if (!await refreshSavedMessageIds()) {
    toast("Saved messages need the v14 Supabase upgrade. Run supabase-schema.sql and refresh.", "err");
    return false;
  }
  const removing = savedMessageIds.has(message.id);
  const result = removing
    ? await supabase.from("saved_messages").delete().eq("user_id", profile.id).eq("message_id", message.id)
    : await supabase.from("saved_messages").insert({ user_id: profile.id, message_id: message.id });
  if (result.error) {
    toast("Couldn't update saved messages: " + result.error.message, "err");
    return false;
  }
  if (removing) savedMessageIds.delete(message.id); else savedMessageIds.add(message.id);
  if (button) {
    const isSaved = !removing;
    button.textContent = String.fromCharCode(isSaved ? 0x2605 : 0x2606);
    button.classList.toggle("saved", isSaved);
    button.title = isSaved ? "Remove from saved messages" : "Save message";
    button.setAttribute("aria-label", button.title);
  }
  toast(removing ? "Removed from saved messages." : "Message saved to your library.", "ok");
  return true;
}

async function openSavedMessages() {
  showView("saved-view");
  const list = $("saved-message-list");
  list.replaceChildren(el("p", "Loading saved messages…", "muted"));
  const { data: saved, error } = await supabase.from("saved_messages")
    .select("message_id,saved_at").eq("user_id", profile.id).order("saved_at", { ascending: false }).limit(200);
  if (error) {
    list.replaceChildren(el("p", "Saved messages need the v14 Supabase upgrade. Run supabase-schema.sql, then refresh.", "empty-note"));
    return;
  }
  if (!saved || !saved.length) {
    savedMessageIds.clear();
    savedMessageOwner = profile.id;
    savedMessagesLoaded = true;
    list.replaceChildren(el("p", "No saved messages yet. Use the star on a channel message to keep it here.", "empty-note"));
    return;
  }
  const ids = saved.map((row) => row.message_id);
  const { data: messages, error: messageError } = await supabase.from("messages").select("*").in("id", ids);
  if (messageError) {
    list.replaceChildren(el("p", "Couldn't load your saved messages. Please try again.", "empty-note"));
    return;
  }
  const messageById = new Map((messages || []).map((message) => [message.id, message]));
  const channelIds = [...new Set((messages || []).map((message) => message.channel_id))];
  const { data: channelRows } = channelIds.length
    ? await supabase.from("channels").select("id,name,server_id").in("id", channelIds)
    : { data: [] };
  const channelById = new Map((channelRows || []).map((channel) => [channel.id, channel]));
  if (!users.length) await refreshUsers(true);
  list.replaceChildren();
  savedMessageIds.clear();
  savedMessageOwner = profile.id;
  savedMessagesLoaded = true;
  for (const savedRow of saved) {
    const message = messageById.get(savedRow.message_id);
    if (!message) continue;
    savedMessageIds.add(message.id);
    const channel = channelById.get(message.channel_id);
    const server = channel && servers.find((item) => item.id === channel.server_id);
    const card = el("article", null, "saved-message-card");
    const meta = el("div", null, "saved-message-meta");
    meta.appendChild(el("span", userName(message.user_id), "saved-message-author"));
    meta.appendChild(el("span", "·"));
    meta.appendChild(el("span", `${server ? server.name : "Server"} · #${channel ? channel.name : "channel"}`));
    meta.appendChild(el("span", "·"));
    meta.appendChild(el("time", fmtTime(savedRow.saved_at)));
    card.appendChild(meta);
    let preview = String(message.content || "");
    if (preview.startsWith("[img]")) preview = "Image attachment";
    else if (preview.startsWith("[ANN]")) preview = preview.slice(5);
    else preview = preview.replace(/^\[\u21a9\d+\]\s*/, "");
    card.appendChild(el("div", preview, "saved-message-text"));
    const actions = el("div", null, "saved-message-actions");
    if (channel) {
      const open = el("button", "Go to message", "btn-secondary");
      open.type = "button";
      open.onclick = () => openSavedMessage(message, channel);
      actions.appendChild(open);
    }
    const remove = el("button", "Remove", "btn-secondary");
    remove.type = "button";
    remove.onclick = async () => {
      if (await toggleSavedMessage(message)) await openSavedMessages();
    };
    actions.appendChild(remove);
    card.appendChild(actions);
    list.appendChild(card);
  }
  if (!list.children.length) list.appendChild(el("p", "No saved messages yet. Use the star on a channel message to keep it here.", "empty-note"));
}

async function openSavedMessage(message, channel) {
  const server = servers.find((item) => item.id === channel.server_id);
  if (!server) { toast("That server is no longer available.", "err"); return; }
  activeServer = server;
  showView("chat-view");
  await loadChannels();
  if (channels.some((item) => item.id === channel.id)) await selectChannel(channel.id, message.id);
}

async function loadReactions(ids) {
  if (!ids.length) return;
  const { data } = await supabase.from("message_reactions").select("*").in("message_id", ids).limit(1500);
  for (const r of data || []) {
    if (!reactionMap.has(r.message_id)) reactionMap.set(r.message_id, new Map());
    const em = reactionMap.get(r.message_id);
    if (!em.has(r.emoji)) em.set(r.emoji, new Set());
    em.get(r.emoji).add(r.user_id);
  }
}

function repaintReaction(mid) {
  const row = document.querySelector(`.msg[data-mid="${mid}"] .react-chips`);
  if (row) paintChips(mid, row);
}

function userName(id) {
  const u = users.find((x) => x.id === id);
  return u ? u.username : "unknown";
}
function userRole(id) {
  const u = users.find((x) => x.id === id);
  return u ? u.role : "member";
}

/* message cache for reply quotes (cleared per thread load) + reactions */
const reactionMap = new Map(); // mid -> Map(emoji -> Set(uid))

function isSafeImg(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const tail = u.pathname + u.search;
    return /\.(gif|png|jpe?g|webp)(\?|#|$)/i.test(tail)
      || u.hostname.includes("tenor") || u.hostname.includes("giphy");
  } catch { return false; }
}

function paintChips(mid, container) {
  container.innerHTML = "";
  const set = reactionMap.get(mid);
  if (!set) return;
  for (const [emoji, uids] of set) {
    const mine = session && uids.has(session.user.id);
    const chip = el("button", `${emoji} ${uids.size}`, "react-chip" + (mine ? " mine" : ""));
    chip.type = "button";
    chip.onclick = () => toggleReaction(mid, emoji);
    container.appendChild(chip);
  }
}

async function toggleReaction(mid, emoji) {
  if (!session) return;
  const set = reactionMap.get(mid);
  const mine = set && set.get(emoji) && set.get(emoji).has(session.user.id);
  if (mine) {
    const { error } = await supabase.from("message_reactions")
      .delete().eq("message_id", mid).eq("user_id", session.user.id).eq("emoji", emoji);
    if (error) toast("Couldn't remove reaction: " + error.message, "err");
  } else {
    const { error } = await supabase.from("message_reactions")
      .insert({ message_id: mid, user_id: session.user.id, emoji });
    if (error) toast("Couldn't react: " + error.message, "err");
  }
}

function openMiniReact(mid, anchor) {
  document.querySelectorAll(".mini-react").forEach((n) => n.remove());
  const box = el("div", null, "mini-react");
  for (const e of ["❤️", "😂", "😮", "😢", "👍", "👎", "🔥", "🎉"]) {
    const s = el("span", e, "em");
    s.onclick = (ev) => { ev.stopPropagation(); toggleReaction(mid, e); box.remove(); };
    box.appendChild(s);
  }
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect();
  box.style.left = Math.min(window.innerWidth - 260, r.left - 180) + "px";
  box.style.top = (r.top - 48) + "px";
  setTimeout(() => document.addEventListener("click", function h(ev) {
    if (!box.contains(ev.target)) { box.remove(); document.removeEventListener("click", h); }
  }), 10);
}

function startReply(mid) {
  const q = msgCache.get(mid);
  replyTo = { id: mid };
  $("reply-bar").classList.remove("hidden");
  $("reply-who").textContent = q ? "@" + q.username : "message";
  $("reply-text").textContent = q ? q.content.slice(0, 60) : "";
  $("message-input").focus();
}

async function appendMessage(m, live) {
  if (!users.find((x) => x.id === m.user_id)) await refreshUsers(true);
  msgCache.set(m.id, { username: userName(m.user_id), content: m.content });
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
  const avWrap = profileTrigger(
    avatarNode(userName(m.user_id), userEmoji(m.user_id), userEquip(m.user_id)),
    m.user_id,
    "View " + userName(m.user_id) + "'s profile"
  );
  row.appendChild(avWrap);
  const main = el("div");
  main.style.flex = "1";
  main.style.minWidth = "0";
  if (!grouped) {
    const head = el("div", null, "msg-head");
    const who = el("span", userName(m.user_id), "msg-user" + (userRole(m.user_id) === "admin" ? " admin" : ""));
    profileTrigger(who, m.user_id, "View " + userName(m.user_id) + "'s profile");
    const eqc = userEquip(m.user_id);
    if (eqc.color) who.style.color = eqc.color;
    head.appendChild(who);
    const badge = roleBadge(userRole(m.user_id));
    if (badge) head.appendChild(badge);
    appendSpecialBadgeStrip(head, m.user_id, { limit: 3 });
    head.appendChild(el("span", fmtTime(m.created_at), "msg-time"));
    main.appendChild(head);
  } else {
    main.appendChild(el("span", new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), "msg-time-full"));
  }
  if (m.updated_at) {
    const time = main.querySelector(".msg-time, .msg-time-full");
    if (time) {
      const marker = el("span", "(edited)", "msg-edited");
      marker.title = "Edited " + fmtTime(m.updated_at);
      time.insertAdjacentElement("afterend", marker);
    }
  }
  // reply quote?
  let body = m.content, replyId = null;
  const rm = /^\[↩(\d+)\] /.exec(body);
  if (rm) { replyId = +rm[1]; body = body.slice(rm[0].length); }
  if (replyId !== null) {
    const q = msgCache.get(replyId);
    const quote = el("div", null, "reply-quote");
    quote.dataset.replyId = replyId;
    quote.appendChild(el("span", q ? "↩ @" + q.username + ":  " : "↩ (message unavailable)", "rq-who"));
    if (q) quote.appendChild(el("span", q.content.slice(0, 90), "muted"));
    main.appendChild(quote);
  }
  if (body.startsWith("[ANN]")) {
    main.appendChild(el("div", "📢 " + body.slice(5), "announce-banner"));
  } else if (body.startsWith("[img]") && isSafeImg(body.slice(5).trim())) {
    const img = document.createElement("img");
    img.src = body.slice(5).trim();
    img.loading = "lazy";
    img.className = "chat-img message-content";
    img.alt = "shared image";
    img.onclick = () => window.open(img.src, "_blank");
    main.appendChild(img);
  } else {
    const rbody = el("div", null, "msg-body message-content");
    rbody.appendChild(richText(body));
    main.appendChild(rbody);
  }
  const chips = el("div", null, "react-chips");
  main.appendChild(chips);
  paintChips(m.id, chips);
  row.appendChild(main);
  // hover actions: reply, react (channels only), delete
  const acts = el("div", null, "msg-actions");
  const replyBtn = el("button", "💬", "msg-act");
  replyBtn.title = "Reply";
  replyBtn.type = "button";
  replyBtn.onclick = () => startReply(m.id);
  acts.appendChild(replyBtn);
  if (view.type === "channel") {
    const isSaved = savedMessageIds.has(m.id);
    const saveBtn = el("button", String.fromCharCode(isSaved ? 0x2605 : 0x2606), "msg-act save-message");
    saveBtn.classList.toggle("saved", isSaved);
    saveBtn.title = isSaved ? "Remove from saved messages" : "Save message";
    saveBtn.setAttribute("aria-label", saveBtn.title);
    saveBtn.type = "button";
    saveBtn.onclick = (event) => { event.stopPropagation(); toggleSavedMessage(m, saveBtn); };
    acts.appendChild(saveBtn);
  }
  if (view.type === "channel") {
    const reactBtn = el("button", "😀", "msg-act");
    reactBtn.title = "React";
    reactBtn.type = "button";
    reactBtn.onclick = (ev) => { ev.stopPropagation(); openMiniReact(m.id, reactBtn); };
    acts.appendChild(reactBtn);
    if (canModerateServer()) {
      const pinBtn = el("button", "📌", "msg-act");
      pinBtn.title = "Pin to channel";
      pinBtn.type = "button";
      pinBtn.onclick = async () => {
        const { data } = await supabase.from("messages").select("pinned").eq("id", m.id).single();
        togglePin(m.id, !!(data && data.pinned));
      };
      acts.appendChild(pinBtn);
    }
  }
  const ownMsg = session && m.user_id === session.user.id;
  if (view.type === "channel" && !ownMsg) {
    const report = el("button", "⚑", "msg-act");
    report.textContent = "Report";
    report.classList.add("msg-report-act");
    report.title = "Report a possible Terms of Service violation";
    report.setAttribute("aria-label", "Report this message for a possible Terms of Service violation");
    report.type = "button";
    report.onclick = (ev) => { ev.stopPropagation(); reportMessage(m); };
    acts.appendChild(report);
  }
  if (ownMsg && view.type === "channel" && !profile.is_muted && !m.content.startsWith("[img]")) {
    const edit = el("button", "✎", "msg-act");
    edit.title = "Edit message";
    edit.setAttribute("aria-label", "Edit message");
    edit.type = "button";
    edit.onclick = () => editMessage(m);
    acts.appendChild(edit);
  }
  if (ownMsg || (session && canModerateServer() && view.type === "channel")) {
    const del = el("button", "🗑", "msg-act");
    del.title = "Delete message";
    del.type = "button";
    del.onclick = async () => {
      // DMs stay private: only the sender's own can go (RLS enforces this too).
      const table = view.type === "dm" ? "dms" : "messages";
      const { error } = await supabase.from(table).delete().eq("id", m.id);
      if (error) toast("Delete failed: " + error.message, "err");
    };
    acts.appendChild(del);
  }
  row.appendChild(acts);
  box.appendChild(row);
  lastRenderUid = m.user_id;
  lastRenderTs = ts;
  if (live) {
    // @mention highlight + sound (safe: class only, no HTML parsing)
    const incoming = profile && m.user_id !== session.user.id;
    const isMention = incoming && body.toLowerCase().includes("@" + profile.username.toLowerCase());
    if (isMention) {
      row.classList.add("mentioned");
      const alertsEnabled = view.type === "dm" ? uiSettings.dmNotifications : uiSettings.channelNotifications !== "none";
      if (alertsEnabled && ownPresenceStatus() !== "dnd") playBlip();
    }
    const channelAlert = view.type === "channel" && (uiSettings.channelNotifications === "all"
      || (uiSettings.channelNotifications === "mentions" && isMention));
    if (incoming && channelAlert && (document.hidden || !document.hasFocus())) {
      showMessageNotification("New message in #" + (activeChannel ? activeChannel.name : "server"),
        userName(m.user_id) + ": " + body, "channel-" + (activeChannel ? activeChannel.id : ""),
        { toastWhenVisible: !document.hidden });
    }
    if (stickBottom) box.scrollTop = box.scrollHeight;
    else bumpPill();
  }
}

function applyMessageUpdate(message) {
  msgCache.set(message.id, { username: userName(message.user_id), content: message.content });
  const row = document.querySelector(`.msg[data-mid="${message.id}"]`);
  if (!row) return;
  const main = row.children[1];
  const oldQuote = main.querySelector(".reply-quote");
  const oldContent = main.querySelector(".msg-body, .chat-img, .announce-banner");
  if (!oldContent) return;

  const replyPattern = new RegExp("^\\[" + String.fromCharCode(0x21a9) + "(\\d+)\\] ");
  let body = message.content, replyId = null;
  const replyMatch = replyPattern.exec(body);
  if (replyMatch) { replyId = Number(replyMatch[1]); body = body.slice(replyMatch[0].length); }

  if (oldQuote) oldQuote.remove();
  if (replyId !== null) {
    const quoted = msgCache.get(replyId);
    const quote = el("div", null, "reply-quote");
    quote.dataset.replyId = replyId;
    quote.appendChild(el("span", quoted ? String.fromCharCode(0x21a9) + " @" + quoted.username + ":  " : String.fromCharCode(0x21a9) + " (message unavailable)", "rq-who"));
    if (quoted) quote.appendChild(el("span", quoted.content.slice(0, 90), "muted"));
    main.insertBefore(quote, oldContent);
  }

  let content;
  if (body.startsWith("[ANN]")) {
    content = el("div", String.fromCharCode(0x1f4e2) + " " + body.slice(5), "announce-banner");
  } else if (body.startsWith("[img]") && isSafeImg(body.slice(5).trim())) {
    content = document.createElement("img");
    content.src = body.slice(5).trim();
    content.loading = "lazy";
    content.className = "chat-img";
    content.alt = "shared image";
    content.onclick = () => window.open(content.src, "_blank");
  } else {
    content = el("div", null, "msg-body");
    content.appendChild(richText(body));
  }
  content.classList.add("message-content");
  oldContent.replaceWith(content);

  const time = row.querySelector(".msg-time, .msg-time-full");
  row.querySelector(".msg-edited")?.remove();
  if (message.updated_at && time) {
    const marker = el("span", "(edited)", "msg-edited");
    marker.title = "Edited " + fmtTime(message.updated_at);
    time.insertAdjacentElement("afterend", marker);
  }
  document.querySelectorAll(`.reply-quote[data-reply-id="${message.id}"] .muted`)
    .forEach((quoteText) => { quoteText.textContent = message.content.slice(0, 90); });
}

async function editMessage(message) {
  if (!session || !profile || view.type !== "channel" || profile.is_muted || message.user_id !== session.user.id) return;
  const draft = getMessageEditDraft(message.content);
  const edited = await showModal({
    title: "Edit message",
    body: "Your edit will update for everyone in this channel.",
    input: true,
    initial: draft.text,
    placeholder: "Message",
    maxLength: draft.maxLength,
    okText: "Save"
  });
  if (edited === null) return;
  let content;
  try { content = composeEditedMessage(edited, draft); }
  catch (error) { toast(error.message, "err"); return; }
  if (content === message.content) return;
  const { data, error } = await supabase.from("messages").update({ content })
    .eq("id", message.id).eq("user_id", session.user.id).select("*").single();
  if (error) {
    toast("Couldn't edit message. Run the v11 upgrade block in supabase-schema.sql if needed.", "err");
    return;
  }
  applyMessageUpdate(data);
}

function adminCommandTarget(rawName) {
  const name = String(rawName || "").replace(/^@/, "").trim().toLowerCase();
  return users.find((user) => user.username.toLowerCase() === name) || null;
}

function splitCommandTail(args) {
  const splitAt = args.lastIndexOf(" ");
  if (splitAt < 1) return null;
  return { subject: args.slice(0, splitAt).trim(), value: args.slice(splitAt + 1).trim() };
}

async function executeAdminCommand(raw) {
  if (!isAdmin() || view.type !== "channel") return "not-command";
  const parsed = parseAdminCommand(raw);
  if (!parsed) {
    if (String(raw || "").trim().startsWith("/")) {
      toast("Type / and choose an available command.", "err");
      return "error";
    }
    return "not-command";
  }
  if (!parsed.command) {
    toast(`Unknown command /${parsed.name}. Type / to browse admin commands.`, "err");
    return "error";
  }
  const { name, args } = parsed;
  const target = adminCommandTarget(args);
  const requireTarget = () => {
    if (!args) { toast(`Usage: /${name} ${parsed.command.usage}`, "err"); return null; }
    if (!target) { toast(`Couldn't find Ping member "${args}".`, "err"); return null; }
    return target;
  };

  if (["mute", "unmute", "ban", "unban"].includes(name)) {
    const member = requireTarget();
    if (!member) return "error";
    const field = name === "mute" || name === "unmute" ? "is_muted" : "is_banned";
    const value = name === "mute" || name === "ban";
    if (member.id === profile.id && value) {
      toast("You can't apply this action to your own account.", "err");
      return "error";
    }
    if (value) {
      const confirmed = await showModal({
        title: name === "ban" ? "Ban member" : "Mute member",
        body: `${member.username} will be ${name === "ban" ? "blocked from Ping" : "prevented from sending messages"}.`,
        okText: name === "ban" ? "Ban member" : "Mute member",
        danger: true
      });
      if (confirmed !== true) return "cancelled";
    }
    const changed = await modUser(member, field, value, { refreshDashboard: false });
    if (!changed) return "error";
    toast(`${member.username} ${value ? (name === "ban" ? "banned" : "muted") : (name === "unban" ? "unbanned" : "unmuted")}.`, "ok");
    return "success";
  }

  if (name === "coins") {
    const parts = splitCommandTail(args);
    if (!parts) { toast("Usage: /coins <username> <amount>", "err"); return "error"; }
    const member = adminCommandTarget(parts.subject);
    const amount = Number(parts.value);
    if (!member) { toast(`Couldn't find Ping member "${parts.subject}".`, "err"); return "error"; }
    if (!/^\d+$/.test(parts.value) || !Number.isInteger(amount) || amount < 1 || amount > 100000) {
      toast("Coin grants must be a whole number from 1 to 100,000.", "err"); return "error";
    }
    const confirmed = await showModal({
      title: "Confirm coin grant",
      body: `Give ${amount.toLocaleString()} Ping coins to ${member.username}? This is recorded in the wallet ledger.`,
      okText: "Grant coins"
    });
    if (confirmed !== true) return "cancelled";
    return await grantCoinsToUser(member, amount, { refreshDashboard: false }) ? "success" : "error";
  }

  if (name === "item") {
    const parts = splitCommandTail(args);
    if (!parts) { toast("Usage: /item <username> <item-id>", "err"); return "error"; }
    const member = adminCommandTarget(parts.subject);
    const item = SHOP.find((entry) => entry.id.toLowerCase() === parts.value.toLowerCase());
    if (!member) { toast(`Couldn't find Ping member "${parts.subject}".`, "err"); return "error"; }
    if (!item) { toast("Use a shop item ID. Open the Shop to see available items.", "err"); return "error"; }
    const confirmed = await showModal({
      title: "Confirm item grant",
      body: `Give ${item.name} to ${member.username}? This is recorded in the activity ledger.`,
      okText: "Grant item"
    });
    if (confirmed !== true) return "cancelled";
    return await grantItemToUser(member, item) ? "success" : "error";
  }

  if (name === "badge") {
    const parts = splitCommandTail(args);
    if (!parts) { toast("Usage: /badge <username> <badge-id>", "err"); return "error"; }
    const member = adminCommandTarget(parts.subject);
    const badge = SPECIAL_BADGES.find((entry) => entry.id.toLowerCase() === parts.value.toLowerCase());
    if (!member) { toast(`Couldn't find Ping member "${parts.subject}".`, "err"); return "error"; }
    if (!badge) { toast("Use a badge ID shown in the Admin Dashboard badge manager.", "err"); return "error"; }
    if ((userBadges.get(member.id) || []).includes(badge.id)) {
      toast(`${member.username} already has the ${badge.label} badge.`, "err"); return "error";
    }
    return await setProfileBadge(member.id, badge.id, true, { refreshDashboard: false, openDetail: false })
      ? "success" : "error";
  }

  if (name === "role") {
    const parts = splitCommandTail(args);
    if (!parts) { toast("Usage: /role <username> <member|mod>", "err"); return "error"; }
    const member = adminCommandTarget(parts.subject);
    const role = parts.value.toLowerCase();
    if (!member) { toast(`Couldn't find Ping member "${parts.subject}".`, "err"); return "error"; }
    if (!(["member", "mod"].includes(role))) {
      toast("Role must be member or mod.", "err"); return "error";
    }
    if (member.role === "admin") { toast("Admin roles can't be changed with this command.", "err"); return "error"; }
    if (member.role === role) { toast(`${member.username} already has the ${role} role.`, "err"); return "error"; }
    const confirmed = await showModal({
      title: "Change member role",
      body: `Set ${member.username}'s role to ${role}?`,
      okText: "Update role"
    });
    if (confirmed !== true) return "cancelled";
    const changed = await modRole(member, role, { refreshDashboard: false });
    if (!changed) return "error";
    toast(`${member.username} is now ${role === "mod" ? "a moderator" : "a member"}.`, "ok");
    return "success";
  }

  return "not-command";
}

async function reportMessage(message) {
  if (view.type !== "channel" || !session || message.user_id === session.user.id) return;
  const choice = await showModal({
    title: "Report message",
    body: "Choose the main reason. Reports are visible to Ping moderators.",
    okText: "Spam",
    extra: [
      { label: "Harassment", value: "harassment" },
      { label: "Hate speech", value: "hate" },
      { label: "Sexual content", value: "sexual" },
      { label: "Threats", value: "threats" },
      { label: "Other", value: "other" }
    ]
  });
  if (choice === null) return;
  const reason = choice === true ? "spam" : choice;
  const { error } = await supabase.from("message_reports").insert({
    message_id: message.id,
    message_author_id: message.user_id,
    channel_id: message.channel_id,
    message_content: message.content,
    reporter_id: session.user.id,
    reason
  });
  if (error) {
    toast(error.code === "23505"
      ? "You already reported this message."
      : "Couldn't submit report. Make sure the latest Supabase schema is installed.", "err");
    return;
  }
  toast("Report sent to the Ping moderation team.", "ok");
}

async function refreshUsers(quiet) {
  hideBadgeTooltip();
  const [profileResult, badgeResult] = await Promise.all([
    supabase.from("profiles").select("*").order("username"),
    supabase.from("profile_badges").select("user_id,badge_id").order("created_at")
  ]);
  users = profileResult.data || [];
  userBadges = new Map();
  for (const row of badgeResult.data || []) {
    if (!userBadges.has(row.user_id)) userBadges.set(row.user_id, []);
    userBadges.get(row.user_id).push(row.badge_id);
  }
  const ownName = $("user-name");
  if (ownName && profile) {
    ownName.replaceChildren(el("span", profile.username));
    const ownRole = roleBadge(profile.role);
    if (ownRole) ownName.appendChild(ownRole);
    appendSpecialBadgeStrip(ownName, profile.id, { limit: 2 });
  }
  const ownAvatar = $("user-avatar");
  if (ownAvatar && profile) {
    ownAvatar.textContent = profile.avatar_emoji || profile.username.slice(0, 1).toUpperCase();
    ownAvatar.style.background = profile.avatar_emoji ? "var(--bg-3)" : avatarColor(profile.username);
  }
  const list = $("members-list");
  list.innerHTML = "";
  let online = 0;
  const admins = users.filter((u) => u.role === "admin");
  const members = users.filter((u) => u.role !== "admin");
  for (const group of [["ADMIN", admins], ["MEMBERS", members]]) {
    if (!group[1].length) continue;
    list.appendChild(el("div", group[0] + " — " + group[1].length, "members-title"));
    for (const u of group[1]) {
      const status = presenceStatusForUser(u);
      const isOnline = status !== "offline";
      if (isOnline) online++;
      const row = el("button", null, "member" + (isOnline ? "" : " off"));
      row.type = "button";
      row.setAttribute("aria-label", "View " + u.username + "'s profile");
      row.title = "View profile";
      row.onclick = () => openProfile(u.id);
      const dot = el("span", null, "dot " + status);
      dot.title = presenceLabel(status);
      row.appendChild(dot);
      row.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}));
      row.appendChild(el("span", u.username, "member-name"));
      if (activeServer && u.id === activeServer.created_by) {
        const owner = el("span", "♛", "owner-badge");
        owner.title = "Server owner";
        owner.setAttribute("aria-label", "Server owner");
        row.appendChild(owner);
      }
      const badge = roleBadge(u.role);
      if (badge) row.appendChild(badge);
      for (const assigned of serverRoleAssignments.filter((item) => item.user_id === u.id)) {
        const customRole = serverRoleRows.find((item) => item.id === assigned.role_id);
        if (!customRole) continue;
        const tag = el("span", customRole.name, "server-role-tag");
        tag.style.setProperty("--server-role-color", customRole.color || "#99aab5");
        tag.title = customRole.name;
        row.appendChild(tag);
      }
      appendSpecialBadgeStrip(row, u.id, { limit: 2 });
      if (u.is_muted) row.appendChild(el("span", "Muted", "member-state"));
      if (u.is_banned) row.appendChild(el("span", "Banned", "member-state"));
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
    renderAdminCommandPicker();
    if (!msgChannel || !profile) return;
    const now = Date.now();
    if (now - lastTypeSent < 2000) return;
    lastTypeSent = now;
    msgChannel.send({ type: "broadcast", event: "typing", payload: { user: profile.username } });
  });
  $("message-input").addEventListener("keydown", (event) => {
    const picker = $("command-picker");
    if (picker.classList.contains("hidden")) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveAdminCommandSelection(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      const options = [...picker.querySelectorAll('[role="option"]')];
      const selected = options.find((option) => option.getAttribute("aria-selected") === "true") || options[0];
      if (selected) {
        event.preventDefault();
        selectAdminCommand(selected.id.replace("admin-command-", ""));
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      hideAdminCommandPicker();
    }
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

  // reply bar
  $("reply-cancel").onclick = () => {
    replyTo = null;
    $("reply-bar").classList.add("hidden");
  };

  // GIF picker
  if (ENV.TENOR_API_KEY) $("gif-btn").classList.remove("hidden");
  let gifTimer = null;
  $("gif-btn").onclick = (ev) => {
    ev.stopPropagation();
    const pk = $("gif-picker");
    pk.classList.toggle("hidden");
    if (!pk.classList.contains("hidden") && !$("gif-grid").children.length) {
      tenorSearch("hello").then(renderGifResults).catch(() => toast("GIF search failed.", "err"));
    }
  };
  $("gif-search").addEventListener("input", () => {
    clearTimeout(gifTimer);
    gifTimer = setTimeout(async () => {
      try { renderGifResults(await tenorSearch($("gif-search").value)); }
      catch { toast("GIF search failed.", "err"); }
    }, 400);
  });
  document.addEventListener("click", (e) => {
    const gp = $("gif-picker");
    if (!gp.classList.contains("hidden") && !gp.contains(e.target) && e.target.id !== "gif-btn")
      gp.classList.add("hidden");
  });

  // server invites and announcements
  $("invite-btn").onclick = copyServerInvite;
  $("announce-btn").onclick = async () => {
    if (!activeChannel) return;
    const text = await showModal({
      title: "Post announcement", body: "Shown as a banner to everyone in #" + activeChannel.name + ".",
      input: true, placeholder: "Announcement…", okText: "Post"
    });
    if (!text) return;
    const { error } = await supabase.from("messages").insert({
      channel_id: activeChannel.id, user_id: session.user.id, content: "[ANN]" + text.slice(0, 400)
    });
    if (error) toast("Couldn't post: " + error.message, "err");
    else logActivity("announce", "#" + activeChannel.name);
  };

  $("message-form").onsubmit = async (e) => {
    e.preventDefault();
    const input = $("message-input");
    const text = input.value.trim();
    if (!text) return;
    if (view.type === "channel" && text.startsWith("/")) {
      const commandResult = await executeAdminCommand(text);
      if (commandResult !== "not-command") {
        if (commandResult === "success") input.value = "";
        hideAdminCommandPicker();
        return;
      }
    }
    const content = replyTo ? `[↩${replyTo.id}] ${text}` : text;
    replyTo = null;
    $("reply-bar").classList.add("hidden");
    if (view.type === "dm") {
      if (!view.uid) { toast("Pick a conversation first.", "err"); return; }
      input.value = "";
      const { error } = await supabase.from("dms").insert({
        sender_id: session.user.id, receiver_id: view.uid, content: content.slice(0, 500)
      });
      if (error) toast("Couldn't send: " + error.message, "err");
      return;
    }
    if (!activeChannel) return;
    if (profile.is_muted) {
      input.value = "";
      input.placeholder = "You are muted.";
      return;
    }
    input.value = "";
    $("emoji-picker").classList.add("hidden");
    const { error } = await supabase.from("messages").insert({
      channel_id: activeChannel.id, user_id: session.user.id, content: content.slice(0, 500)
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
    servers.push(data);
    activeServer = data;
    renderServerRail();
    loadChannels();
  };

  // pins, search, uploads
  $("pins-btn").onclick = showPinsRich;
  $("saved-btn").onclick = openSavedMessages;
  $("saved-back").onclick = () => showView("chat-view");
  $("search-btn").onclick = () => {
    const bar = $("search-bar");
    bar.classList.toggle("hidden");
    if (!bar.classList.contains("hidden")) $("search-input").focus();
    else $("search-results").classList.add("hidden");
  };
  $("search-input").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch($("search-input").value.trim()), 400);
  });
  $("upload-btn").onclick = () => $("upload-input").click();
  $("upload-input").addEventListener("change", async () => {
    const f = $("upload-input").files[0];
    $("upload-input").value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast("Only images, please.", "err"); return; }
    if (f.size > 5 * 1024 * 1024) { toast("Max 5 MB.", "err"); return; }
    toast("Uploading…");
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const path = `${session.user.id}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, f);
      if (error) throw error;
      const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      await sendImageMessage(data.publicUrl);
    } catch (err) {
      toast("Upload failed: " + (err.message || err), "err");
    }
  });

  // voice controls
  $("voice-mute").onclick = async () => {
    voiceMuted = !voiceMuted;
    if (localStream) for (const t of localStream.getAudioTracks()) t.enabled = !voiceMuted;
    if (voiceCh) {
      try {
        await voiceCh.track({ username: profile.username, muted: voiceMuted || !localStream, deafened: voiceDeaf, noMic: !localStream });
      } catch { /* presence will sync */ }
    }
    paintVoiceButtons();
  };
  $("voice-deafen").onclick = async () => {
    voiceDeaf = !voiceDeaf;
    for (const [, e] of voicePcs) if (e.audio) e.audio.muted = voiceDeaf;
    if (voiceCh) {
      try {
        await voiceCh.track({ username: profile.username, muted: voiceMuted || !localStream, deafened: voiceDeaf, noMic: !localStream });
      } catch { /* presence will sync */ }
    }
    paintVoiceButtons();
  };
  $("voice-leave").onclick = () => leaveVoice(false);

  $("logout-btn").onclick = async () => {
    await logActivity("logout", "");
    clearInterval(heartbeat);
    if (msgChannel) await supabase.removeChannel(msgChannel);
    if (dmChannel) await supabase.removeChannel(dmChannel);
    if (presenceChannel) await supabase.removeChannel(presenceChannel);
    presenceChannel = null;
    presenceReady = false;
    presenceByUser.clear();
    await leaveVoice(true);
    unwatchVoiceRosters();
    await supabase.auth.signOut();
    location.reload();
  };

  $("mobile-nav-btn").onclick = () =>
    setMobileNav(!document.body.classList.contains("mobile-nav-open"));
  $("mobile-nav-backdrop").onclick = () => setMobileNav(false);
  $("dm-search").addEventListener("input", () => {
    peopleDirectoryOpen = !!$("dm-search").value.trim();
    renderDmList(false);
  });
  $("dm-search").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const query = $("dm-search").value.trim().toLowerCase();
    const match = users.find((u) => u.id !== session.user.id && u.username.toLowerCase() === query);
    if (match) { event.preventDefault(); openDM(match.id); }
  });
  $("members-toggle").onclick = () => {
    const hidden = $("app-view").classList.toggle("members-hidden");
    $("members-toggle").setAttribute("aria-pressed", String(!hidden));
    $("members-toggle").title = hidden ? "Show member list" : "Hide member list";
  };
  $("people-btn").onclick = () => {
    peopleDirectoryOpen = true;
    $("dm-search").value = "";
    renderDmList(false);
  };
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMobileNav(false);
      closePresenceMenu();
      if ($("modal-card").classList.contains("profile-editor-modal")) $("modal-cancel").click();
      else if ($("modal-card").classList.contains("profile-settings-modal")) $("modal-cancel").click();
      else if ($("modal-card").classList.contains("tos-modal")) $("modal-cancel").click();
      else if ($("modal-card").classList.contains("profile-card-modal")) $("modal-ok").click();
    }
    const target = event.target;
    if (event.key === "Escape" && target && target.id === "dm-search" && target.value) {
      target.value = "";
      peopleDirectoryOpen = false;
      renderDmList(false);
    }
    const editingField = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k"
        && !$("app-view").classList.contains("hidden")
        && $("modal-overlay").classList.contains("hidden")) {
      event.preventDefault();
      if (view.type !== "dm") enterHome().then(() => $("dm-search").focus());
      else $("dm-search").focus();
      return;
    }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey
        && !editingField && !$("app-view").classList.contains("hidden")
        && !$("chat-view").classList.contains("hidden")) {
      event.preventDefault();
      $("message-input").focus();
    }
  });
  document.querySelector("#server-rail .home").onclick = () => {
    setMobileNav(false);
    enterHome();
  };
  $("server-header").onclick = () => {
    if (!activeServer || view.type !== "channel") return;
    serverMenu();
  };
  $("settings-btn").onclick = () => openSettings();

  $("dashboard-btn").onclick = () => {
    showView("dashboard-view");
    loadDashboard();
  };
  $("dash-refresh").onclick = loadDashboard;
  $("user-filter").addEventListener("input", renderDashboardUsers);
  $("user-role-filter").addEventListener("change", renderDashboardUsers);
  $("user-state-filter").addEventListener("change", renderDashboardUsers);
  $("activity-filter").addEventListener("change", renderDashboardActivity);
  $("report-state-filter").addEventListener("change", renderReportQueue);
  $("grant-currency-submit").onclick = grantCurrencyFromDashboard;
  $("admin-open-games").onclick = openGames;
  $("dash-open-public").onclick = async () => {
    const publicServer = servers.find((server) => server.name.toLowerCase() === "ping public chat");
    if (!publicServer) { toast("Ping Public Chat isn't available for this account.", "err"); return; }
    activeServer = publicServer;
    showView("chat-view");
    await loadChannels();
  };
  $("dash-close").onclick = () => showView("chat-view");
  $("shop-btn").onclick = openShop;
  $("quests-btn").onclick = openQuests;
  $("games-btn").onclick = openGames;
  document.querySelectorAll(".back-to-chat").forEach((b) => {
    b.onclick = () => showView("chat-view");
  });
}

async function createChannel(kind, category = "") {
  if (!canManageChannels(activeServer)) { toast("You need the Manage Channels permission.", "err"); return; }
  kind = kind === "voice" ? "voice" : "text";
  const raw = await showModal({ title: kind === "voice" ? "New voice channel" : "New channel", input: true, placeholder: "channel-name", okText: "Create" });
  if (!raw) return;
  const clean = raw.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
  const values = { server_id: activeServer.id, name: clean, topic: "", kind };
  if (category) values.category = category;
  const { error } = await supabase.from("channels")
    .insert(values);
  if (error) {
    toast(category ? "Couldn't create the categorized channel. Apply the v13 schema upgrade first." : "Couldn't create channel: " + error.message, "err");
    return;
  }
  loadChannels();
}

async function createCategory() {
  if (!canManageChannels(activeServer)) return;
  const category = await showModal({
    title: "Create a channel category",
    body: "Categories organize this server's text and voice channels.",
    input: true, placeholder: "e.g. Community", maxLength: 40, okText: "Continue"
  });
  if (!category) return;
  const normalized = category.trim();
  if (channels.some((ch) => String(ch.category || "").toLowerCase() === normalized.toLowerCase())) {
    toast("That category already exists. Use its + button to add a channel.", "err");
    return;
  }
  await createChannel("text", normalized);
}

/* ---------------- server + channel management ---------------- */
async function refreshServerPermissions(s) {
  serverPermissionCache = new Map();
  serverRoleRows = [];
  serverRoleAssignments = [];
  if (!s || !session) return;
  const [rolesResult, assignmentsResult] = await Promise.all([
    supabase.from("server_roles").select("id,name,color,permissions,position").eq("server_id", s.id).order("position").order("id"),
    supabase.from("server_member_roles").select("role_id,user_id").eq("server_id", s.id)
  ]);
  serverRoleRows = rolesResult.data || [];
  serverRoleAssignments = assignmentsResult.data || [];
  const mine = serverRoleAssignments.filter((row) => row.user_id === session.user.id).map((row) => row.role_id);
  for (const role of serverRoleRows) {
    if (!mine.includes(role.id)) continue;
    const permissions = role.permissions || {};
    if (permissions.administrator) serverPermissionCache.set("administrator", true);
    for (const [permission, enabled] of Object.entries(permissions)) if (enabled) serverPermissionCache.set(permission, true);
  }
}
function hasServerPermission(permission, s = activeServer) {
  if (!s || !profile) return false;
  if (profile.role === "admin" || s.created_by === session?.user?.id) return true;
  return !!serverPermissionCache.get("administrator") || !!serverPermissionCache.get(permission);
}
function canManageServer(s) { return hasServerPermission("manage_server", s); }
function canManageRoles(s) { return hasServerPermission("manage_roles", s); }
function canManageChannels(s) { return hasServerPermission("manage_channels", s); }
function canModerateServer(s) { return canMod() || hasServerPermission("manage_messages", s); }
async function serverMenu() {
  if (!activeServer || (!canManageServer(activeServer) && !canManageRoles(activeServer) && !canManageChannels(activeServer))) return;
  showView("server-settings-view");
  await renderServerSettings();
}
async function renderServerSettings() {
  const s = activeServer;
  const root = $("server-settings-content");
  root.replaceChildren();
  if (!s) return;
  const head = el("header", null, "server-settings-header");
  const heading = el("div");
  heading.append(el("div", "SERVER SETTINGS", "admin-kicker"), el("h2", s.name));
  head.append(heading);
  const back = el("button", "Back to chat", "btn-secondary");
  back.type = "button"; back.onclick = () => showView("chat-view"); head.append(back);
  root.append(head);
  if (canManageServer(s)) {
    const section = el("section", null, "admin-section server-settings-section");
    section.append(el("h3", "Server profile"), el("p", "Set the name, short description, and icon color members see." , "muted small"));
    const form = el("form", null, "server-profile-form");
    const nameLabel = el("label", "Server name");
    const name = el("input"); name.value = s.name; name.maxLength = 40; name.required = true; nameLabel.append(name);
    const descLabel = el("label", "Description");
    const description = el("textarea"); description.value = s.description || ""; description.maxLength = 240; description.rows = 3; description.placeholder = "What is this server about?"; descLabel.append(description);
    const colorLabel = el("label", "Server icon color");
    const color = el("input"); color.type = "color"; color.value = /^#[\da-f]{6}$/i.test(s.icon_color || "") ? s.icon_color : "#5865f2"; colorLabel.append(color);
    const save = el("button", "Save changes", "btn-primary"); save.type = "submit";
    form.append(nameLabel, descLabel, colorLabel, save);
    form.onsubmit = async (event) => {
      event.preventDefault();
      const nextName = name.value.trim();
      if (!nextName) { toast("Server name cannot be empty.", "err"); return; }
      const { error } = await supabase.from("servers").update({ name: nextName.slice(0, 40), description: description.value.trim().slice(0, 240), icon_color: color.value }).eq("id", s.id);
      if (error) { toast("Couldn't save server settings. Apply the v15 schema upgrade first.", "err"); return; }
      s.name = nextName.slice(0, 40); s.description = description.value.trim().slice(0, 240); s.icon_color = color.value;
      await loadServers(); await renderServerSettings(); toast("Server settings saved.", "ok");
    };
    section.append(form);
    const danger = el("button", "Delete server", "btn-secondary danger"); danger.type = "button"; danger.onclick = deleteActiveServer;
    section.append(danger); root.append(section);
  }
  if (canManageRoles(s)) {
    const rolesSection = el("section", null, "admin-section server-settings-section");
    const roleHead = el("div", null, "admin-section-heading");
    const copy = el("div"); copy.append(el("h3", "Roles"), el("p", "Create colored roles and choose what each role can do."));
    const create = el("button", "Create role", "btn-primary"); create.type = "button";
    create.onclick = async () => {
      const roleName = await showModal({ title: "Create a role", input: true, placeholder: "e.g. Event host", maxLength: 32, okText: "Create role" });
      if (!roleName || !roleName.trim()) return;
      const { error } = await supabase.from("server_roles").insert({ server_id: s.id, name: roleName.trim().slice(0, 32), color: "#99aab5", permissions: {}, position: serverRoleRows.length });
      if (error) { toast("Couldn't create role. Apply the v15 schema upgrade first.", "err"); return; }
      await refreshServerPermissions(s); await renderServerSettings();
    };
    roleHead.append(copy, create); rolesSection.append(roleHead);
    if (!serverRoleRows.length) rolesSection.append(el("p", "No custom roles yet. Create one to get started.", "empty-note"));
    const canGrantAdmin = profile.role === "admin" || s.created_by === session.user.id;
    const permissionOptions = [
      ["manage_server", "Manage server", "Edit name, description, and server settings."],
      ["manage_roles", "Manage roles", "Create roles and assign them to members."],
      ["manage_channels", "Manage channels", "Create, edit, and delete channels."],
      ["manage_messages", "Manage messages", "Pin and delete messages in this server."],
      ["administrator", "Administrator", "All server permissions. Only the owner can grant this."]
    ];
    for (const role of serverRoleRows) {
      const card = el("article", null, "server-role-card");
      const top = el("div", null, "server-role-top");
      const roleName = el("input"); roleName.value = role.name; roleName.maxLength = 32; roleName.setAttribute("aria-label", "Role name");
      const roleColor = el("input"); roleColor.type = "color"; roleColor.value = /^#[\da-f]{6}$/i.test(role.color || "") ? role.color : "#99aab5"; roleColor.setAttribute("aria-label", "Role color");
      top.append(roleName, roleColor); card.append(top);
      const permissionGrid = el("div", null, "server-permission-grid");
      for (const [key, label, detail] of permissionOptions) {
        const line = el("label", null, "server-permission-option");
        const checkbox = el("input"); checkbox.type = "checkbox"; checkbox.checked = !!role.permissions?.[key];
        if (key === "administrator" && !canGrantAdmin) checkbox.disabled = true;
        line.append(checkbox, el("span", null)); line.lastChild.append(el("strong", label), el("small", detail)); permissionGrid.append(line);
        if (!role._checks) role._checks = {}; role._checks[key] = checkbox;
      }
      card.append(permissionGrid);
      const assignments = serverRoleAssignments.filter((a) => a.role_id === role.id);
      const assignmentRow = el("div", null, "server-role-assignment");
      const memberSelect = el("select"); memberSelect.append(el("option", "Assign a member…"));
      for (const user of users) { const option = el("option", user.username); option.value = user.id; memberSelect.append(option); }
      const assign = el("button", "Assign", "btn-secondary"); assign.type = "button";
      assign.onclick = async () => {
        if (!memberSelect.value) return;
        const { error } = await supabase.from("server_member_roles").insert({ server_id: s.id, user_id: memberSelect.value, role_id: role.id });
        if (error) { toast("Couldn't assign role: " + error.message, "err"); return; }
        await refreshServerPermissions(s); await refreshUsers(true); await renderServerSettings();
      };
      assignmentRow.append(memberSelect, assign);
      const assignedNames = el("div", null, "server-role-assigned");
      for (const assignment of assignments) {
        const user = users.find((u) => u.id === assignment.user_id); if (!user) continue;
        const chip = el("span", null, "server-role-member"); chip.append(el("span", user.username));
        const remove = el("button", "×", "server-role-remove"); remove.type = "button"; remove.title = "Remove role from " + user.username;
        remove.onclick = async () => { const { error } = await supabase.from("server_member_roles").delete().eq("server_id", s.id).eq("user_id", user.id).eq("role_id", role.id); if (error) { toast("Couldn't remove role: " + error.message, "err"); return; } await refreshServerPermissions(s); await refreshUsers(true); await renderServerSettings(); };
        chip.append(remove); assignedNames.append(chip);
      }
      assignmentRow.append(assignedNames); card.append(assignmentRow);
      const actions = el("div", null, "server-role-actions");
      const saveRole = el("button", "Save role", "btn-primary"); saveRole.type = "button";
      saveRole.onclick = async () => {
        const permissions = {}; for (const [key, checkbox] of Object.entries(role._checks)) permissions[key] = checkbox.checked;
        const { error } = await supabase.from("server_roles").update({ name: roleName.value.trim().slice(0, 32), color: roleColor.value, permissions }).eq("id", role.id);
        if (error) { toast("Couldn't save role: " + error.message, "err"); return; }
        await refreshServerPermissions(s); await refreshUsers(true); await renderServerSettings(); toast("Role saved.", "ok");
      };
      const deleteRole = el("button", "Delete role", "btn-secondary danger"); deleteRole.type = "button";
      deleteRole.onclick = async () => { const yes = await showModal({ title: "Delete " + role.name + "?", body: "This removes the role from everyone in the server.", okText: "Delete", danger: true }); if (yes !== true) return; const { error } = await supabase.from("server_roles").delete().eq("id", role.id); if (error) { toast("Couldn't delete role: " + error.message, "err"); return; } await refreshServerPermissions(s); await refreshUsers(true); await renderServerSettings(); };
      actions.append(saveRole, deleteRole); card.append(actions); rolesSection.append(card);
    }
    root.append(rolesSection);
  }
}
async function deleteActiveServer() {
  const s = activeServer; if (!s || !canManageServer(s)) return;
  const yes = await showModal({ title: "Delete server?", body: `"${s.name}" and all its channels and messages will be gone for everyone.`, okText: "Delete", danger: true });
  if (yes !== true) return;
  const { error } = await supabase.from("servers").delete().eq("id", s.id);
  if (error) { toast("Delete failed: " + error.message, "err"); return; }
  activeServer = null; activeChannel = null; await loadServers(); if (!activeServer) enterHome();
}

async function copyServerInvite() {
  if (!activeServer) return;
  const invite = new URL(window.location.href);
  invite.search = "";
  invite.hash = "";
  invite.searchParams.set("server", String(activeServer.id));
  const link = invite.toString();
  try {
    await navigator.clipboard.writeText(link);
    toast("Invite link copied. Anyone with it can open this public server.", "ok");
  } catch {
    await showModal({
      title: "Invite to " + activeServer.name,
      body: "Copy this link and send it to your friends.",
      input: true, initial: link, okText: "Done"
    });
  }
}

async function channelMenu(ch) {
  const res = await showModal({
    title: "Edit #" + ch.name, body: "Set the topic, rename, or delete the channel.",
    input: true, initial: ch.topic || "", placeholder: "Topic (empty clears it)", okText: "Save topic",
    extra: [
      { label: "Category", value: "__category" },
      { label: "Remove category", value: "__uncategorize" },
      { label: "Rename", value: "__rename" },
      { label: "Delete", cls: "danger", value: "__delete" }
    ]
  });
  if (res === null) return;
  if (res === "__category") {
    const category = await showModal({
      title: "Move channel to a category",
      body: "Type a category name. New names create a category; existing names join it.",
      input: true, initial: ch.category || "", placeholder: "e.g. Games", maxLength: 40, okText: "Move"
    });
    if (!category) return;
    const { error } = await supabase.from("channels").update({ category: category.trim() }).eq("id", ch.id);
    if (error) { toast("Couldn't set category. Apply the v13 schema upgrade first.", "err"); return; }
    await loadChannels();
    return;
  }
  if (res === "__uncategorize") {
    const { error } = await supabase.from("channels").update({ category: "" }).eq("id", ch.id);
    if (error) { toast("Couldn't remove category. Apply the v13 schema upgrade first.", "err"); return; }
    await loadChannels();
    return;
  }
  if (res === "__delete") {
    const yes = await showModal({
      title: "Delete #" + ch.name + "?", body: "All messages in it will be gone.",
      okText: "Delete", danger: true
    });
    if (yes !== true) return;
    const { error } = await supabase.from("channels").delete().eq("id", ch.id);
    if (error) { toast("Delete failed: " + error.message, "err"); return; }
    if (activeChannel && activeChannel.id === ch.id) activeChannel = null;
    loadChannels();
    return;
  }
  if (res === "__rename") {
    const name = await showModal({ title: "Rename channel", input: true, initial: ch.name, placeholder: "channel-name", okText: "Rename" });
    if (!name) return;
    const clean = name.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    const { error } = await supabase.from("channels").update({ name: clean }).eq("id", ch.id);
    if (error) { toast("Rename failed: " + error.message, "err"); return; }
    loadChannels();
    return;
  }
  const { error } = await supabase.from("channels").update({ topic: String(res).slice(0, 120) }).eq("id", ch.id);
  if (error) { toast("Couldn't save topic: " + error.message, "err"); return; }
  loadChannels();
}

/* ---------------- settings ---------------- */
const AVATAR_EMOJIS = ["😀","😎","🤖","👾","🐱","🐶","🦊","🐼","🦁","🐸","👻","🎃","🤡","👽","🐵","🦄","🐙","🦋","🌚","🔥","⚡","💎"];
function buildProfileEditorFields(container, { intro = true, includeAvatar = true, initial = null } = {}) {
  if (intro) container.appendChild(el("p", "Your username, avatar, status, and About Me are visible to other members.", "profile-editor-intro"));
  const field = (labelText, value, maxLength, placeholder) => {
    const label = el("label", null, "profile-editor-field");
    label.appendChild(el("span", labelText));
    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.maxLength = maxLength;
    input.placeholder = placeholder;
    label.appendChild(input);
    container.appendChild(label);
    return input;
  };
  const username = field("Username", initial ? initial.username : profile.username, 20, "Your username");
  const status = field("Custom status", initial ? initial.status : profile.custom_status, 60, "What are you up to?");
  const statusTools = el("div", null, "profile-status-tools");
  const statusPresets = el("div", null, "profile-status-presets");
  for (const [label, value] of [["Gaming", "Gaming"], ["Listening", "Listening to music"], ["Studying", "Studying"], ["On a break", "On a break"], ["Clear", ""]]) {
    const preset = el("button", label, "profile-status-preset");
    preset.type = "button";
    preset.onclick = () => {
      status.value = value;
      status.dispatchEvent(new Event("input", { bubbles: true }));
    };
    statusPresets.appendChild(preset);
  }
  const statusCount = el("span", status.value.length + "/60", "profile-status-count");
  status.addEventListener("input", () => { statusCount.textContent = status.value.length + "/60"; });
  statusTools.append(statusPresets, statusCount);
  container.appendChild(statusTools);
  const bioLabel = el("label", null, "profile-editor-field");
  bioLabel.appendChild(el("span", "About Me"));
  const bio = document.createElement("textarea");
  bio.value = initial ? (initial.bio || "") : (profile.bio || "");
  bio.maxLength = 240;
  bio.rows = 4;
  bio.placeholder = "A little about you";
  bioLabel.appendChild(bio);
  container.appendChild(bioLabel);

  let selectedAvatar = initial ? (initial.avatar || "") : (profile.avatar_emoji || "");
  let renderAvatarChoices = () => {};
  if (includeAvatar) {
    container.appendChild(el("div", "Choose an avatar", "profile-editor-subtitle"));
    const avatarChoices = el("div", null, "profile-avatar-choices");
    renderAvatarChoices = () => {
      avatarChoices.replaceChildren();
      const choices = [["", "Aa"], ...AVATAR_EMOJIS.map((emoji) => [emoji, emoji])];
      for (const [value, label] of choices) {
        const button = el("button", label, "avatar-choice" + (selectedAvatar === value ? " selected" : ""));
        button.type = "button";
        button.title = value ? "Use " + value : "Use your initial";
        button.setAttribute("aria-pressed", String(selectedAvatar === value));
        button.onclick = () => { selectedAvatar = value; renderAvatarChoices(); };
        avatarChoices.appendChild(button);
      }
    };
    renderAvatarChoices();
    container.appendChild(avatarChoices);
  }
  return {
    username, status, bio,
    getAvatar: () => selectedAvatar,
    setAvatar: (value) => { selectedAvatar = value || ""; renderAvatarChoices(); }
  };
}
async function saveOwnProfileFields(fields) {
  const nextName = fields.username.value.trim();
  if (nextName.length < 2 || nextName.length > 20) {
    return { error: "Usernames must be 2-20 characters.", field: "username" };
  }
  if (nextName.toLowerCase() !== profile.username.toLowerCase()) {
    const { data: names, error: namesError } = await supabase.from("profiles").select("id,username");
    if (namesError) return { error: "Couldn't check whether that username is available." };
    const duplicate = (names || []).some((member) =>
      member.id !== profile.id && member.username.toLowerCase() === nextName.toLowerCase());
    if (duplicate) return { error: "That username is already taken.", field: "username" };
  }
  const updates = {
    username: nextName,
    custom_status: fields.status.value.trim().slice(0, 60),
    bio: fields.bio.value.trim().slice(0, 240),
    avatar_emoji: fields.getAvatar() || null
  };
  try {
    const { data, error } = await supabase.from("profiles").update(updates).eq("id", profile.id).select("*").single();
    if (error) {
      const duplicate = /duplicate/i.test(error.message);
      return { error: duplicate
        ? "That username is already taken."
        : "Couldn't save your profile. Run the latest profile block in supabase-schema.sql and try again.", field: duplicate ? "username" : "" };
    }
    profile = data;
    await refreshUsers(true);
    return { error: "" };
  } catch {
    return { error: "Couldn't save your profile. Check your connection and try again." };
  }
}
function openSettings(draft = null) {
  if (!draft || typeof draft !== "object" || !Object.prototype.hasOwnProperty.call(draft, "username")) draft = null;
  hideBadgeTooltip();
  const card = $("modal-card");
  card.classList.remove("profile-card-modal", "profile-editor-modal");
  card.classList.add("profile-settings-modal");
  $("modal-title").classList.remove("hidden");
  $("modal-title").textContent = "Settings";
  const body = $("modal-body");
  body.replaceChildren();
  body.className = "profile-settings-body";
  const ok = $("modal-ok"), cancel = $("modal-cancel"), overlay = $("modal-overlay");
  let getProfileDraft = null;
  $("modal-input").classList.add("hidden");
  $("modal-err").classList.add("hidden");
  overlay.querySelectorAll(".modal-extra-btn").forEach((b) => b.remove());
  ok.textContent = "Done";
  ok.classList.remove("danger");

  body.appendChild(el("div", "APPEARANCE", "chan-group"));
  const row = el("div");
  row.style.cssText = "display:flex;gap:8px;margin:6px 0 10px";
  for (const cc of ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#00aff4"]) {
    const b = el("button", "", null);
    b.type = "button";
    b.title = cc;
    b.style.cssText = `width:28px;height:28px;border-radius:50%;background:${cc};cursor:pointer;border:${uiSettings.accent === cc ? "2px solid #fff" : "2px solid transparent"}`;
    b.onclick = () => { uiSettings.accent = cc; saveUiSettings(); openSettings(getProfileDraft ? getProfileDraft() : draft); };
    row.appendChild(b);
  }
  body.appendChild(row);

  const frow = el("div");
  frow.style.cssText = "display:flex;align-items:center;gap:10px;margin:4px 0";
  frow.appendChild(el("span", "Chat text size", "muted small"));
  const range = document.createElement("input");
  range.type = "range"; range.min = "12"; range.max = "18"; range.value = uiSettings.fontSize;
  range.style.flex = "1";
  const fval = el("span", uiSettings.fontSize + "px", "muted small");
  range.oninput = () => { uiSettings.fontSize = +range.value; fval.textContent = range.value + "px"; saveUiSettings(); };
  frow.appendChild(range);
  frow.appendChild(fval);
  body.appendChild(frow);

  const checkRow = (label, get, set, { desktopPermission = false } = {}) => {
    const r = el("label");
    r.style.cssText = "display:flex;align-items:center;gap:8px;margin:6px 0;font-size:14px;cursor:pointer";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = get();
    cb.onchange = async () => {
      if (desktopPermission && cb.checked) {
        if (!("Notification" in window)) {
          cb.checked = false;
          toast("Desktop notifications aren't supported by this browser.", "err");
          return;
        }
        let permission = Notification.permission;
        try {
          if (permission === "default") permission = await Notification.requestPermission();
        } catch { permission = "denied"; }
        if (permission !== "granted") {
          cb.checked = false;
          set(false);
          saveUiSettings();
          toast("Allow Ping notifications in your browser settings to turn this on.", "err");
          return;
        }
      }
      set(cb.checked);
      saveUiSettings();
    };
    r.appendChild(cb);
    r.appendChild(el("span", label));
    body.appendChild(r);
  };
  checkRow("Compact messages", () => uiSettings.compact, (v) => uiSettings.compact = v);
  checkRow("Mention sounds", () => uiSettings.sounds, (v) => uiSettings.sounds = v);
  checkRow("24-hour clock", () => uiSettings.clock24, (v) => uiSettings.clock24 = v);

  body.appendChild(el("div", "NOTIFICATIONS", "chan-group settings-section-heading"));
  const channelAlerts = el("label", null, "settings-select-row");
  channelAlerts.appendChild(el("span", "Server messages"));
  const channelAlertSelect = document.createElement("select");
  channelAlertSelect.className = "settings-select";
  for (const [value, label] of [["all", "All messages"], ["mentions", "Mentions only"], ["none", "Nothing"]]) {
    const option = el("option", label);
    option.value = value;
    channelAlertSelect.appendChild(option);
  }
  channelAlertSelect.value = uiSettings.channelNotifications;
  channelAlertSelect.onchange = () => { uiSettings.channelNotifications = channelAlertSelect.value; saveUiSettings(); };
  channelAlerts.appendChild(channelAlertSelect);
  body.appendChild(channelAlerts);
  checkRow("Direct message alerts", () => uiSettings.dmNotifications, (v) => uiSettings.dmNotifications = v);
  checkRow("In-app alerts", () => uiSettings.inAppNotifications, (v) => uiSettings.inAppNotifications = v);
  checkRow("Desktop notifications", () => uiSettings.desktopNotifications, (v) => uiSettings.desktopNotifications = v, { desktopPermission: true });

  body.appendChild(el("div", "PROFILE", "chan-group"));
  const editProfile = el("button", "✎ Edit full profile", "btn-secondary profile-settings-edit");
  editProfile.type = "button";
  editProfile.onclick = () => { done(); openProfileEditor(); };
  body.appendChild(editProfile);

  editProfile.remove();
  const profileFields = buildProfileEditorFields(body, { intro: false, initial: draft });
  getProfileDraft = () => ({
    username: profileFields.username.value,
    status: profileFields.status.value,
    bio: profileFields.bio.value,
    avatar: profileFields.getAvatar()
  });
  const profileFeedback = el("p", "", "profile-settings-feedback hidden");
  profileFeedback.setAttribute("aria-live", "polite");
  body.appendChild(profileFeedback);
  const saveProfile = el("button", "Save profile", "btn-primary profile-settings-save");
  saveProfile.type = "button";
  saveProfile.onclick = async () => {
    profileFeedback.classList.add("hidden");
    saveProfile.disabled = true;
    const result = await saveOwnProfileFields(profileFields);
    if (result.error) {
      profileFeedback.textContent = result.error;
      profileFeedback.classList.remove("hidden");
      saveProfile.disabled = false;
      if (result.field === "username") profileFields.username.focus();
      return;
    }
    toast("Your profile is updated.", "ok");
    openSettings();
  };
  body.appendChild(saveProfile);

  const terms = el("button", "Read Terms of Service", "btn-secondary profile-settings-terms");
  terms.type = "button";
  terms.onclick = () => openTermsOfService({ returnToSettings: true, draft: getProfileDraft() });
  body.appendChild(terms);

  overlay.classList.remove("hidden");
  const done = () => {
    overlay.classList.add("hidden");
    ok.onclick = cancel.onclick = overlay.onclick = null;
    card.classList.remove("profile-settings-modal");
    body.className = "muted small";
  };
  cancel.onclick = done;
  overlay.onclick = (e) => { if (e.target === overlay) done(); };
  ok.onclick = done;
}

/* ---------------- GIFs (Tenor, optional key) + reply bar + announcements ---------------- */
function paintAnnounceBtn() {
  const inChannel = view.type === "channel" && !!activeChannel;
  $("announce-btn").classList.toggle("hidden", !(canModerateServer() && inChannel));
  $("invite-btn").classList.toggle("hidden", view.type !== "channel" || !activeServer);
  $("pins-btn").classList.toggle("hidden", !inChannel);
  $("search-btn").classList.toggle("hidden", !inChannel);
  if (!inChannel) {
    $("search-bar").classList.add("hidden");
    $("search-results").classList.add("hidden");
  }
}

async function tenorSearch(q) {
  const key = ENV.TENOR_API_KEY;
  const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q || "hello")}&key=${key}&limit=12&media_filter=gif`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.results || []).map((x) => x.media_formats.gif.url);
}

function renderGifResults(urls) {
  const grid = $("gif-grid");
  grid.innerHTML = "";
  if (!urls.length) grid.appendChild(el("div", "No GIFs found.", "muted small"));
  for (const u of urls) {
    const img = document.createElement("img");
    img.src = u;
    img.loading = "lazy";
    img.className = "gif-thumb";
    img.onclick = () => sendGif(u);
    grid.appendChild(img);
  }
}

async function sendGif(url) {
  $("gif-picker").classList.add("hidden");
  if (view.type === "dm" && !view.uid) { toast("Pick a conversation first.", "err"); return; }
  if (view.type === "channel" && !activeChannel) return;
  if (profile.is_muted) { toast("You are muted.", "err"); return; }
  const content = `[img]${url}`;
  const payload = view.type === "dm"
    ? { sender_id: session.user.id, receiver_id: view.uid, content }
    : { channel_id: activeChannel.id, user_id: session.user.id, content };
  const table = view.type === "dm" ? "dms" : "messages";
  const { error } = await supabase.from(table).insert(payload);
  if (error) toast("Couldn't send GIF: " + error.message, "err");
}

/* ---------------- coins economy (ledger on activity_log, no server needed) ---------------- */
const SHOP = [
  { id: "frame-violet", kind: "frame", name: "Violet Ring", desc: "Purple avatar ring", cost: 50 },
  { id: "frame-pixel", kind: "frame", name: "Pixel Corners", desc: "Retro corner brackets", cost: 120 },
  { id: "frame-gold", kind: "frame", name: "Gold Ring", desc: "Shiny gold avatar ring", cost: 150 },
  { id: "frame-rainbow", kind: "frame", name: "Rainbow Flow", desc: "Animated rainbow ring · Nitro exclusive", cost: 400, nitro: true },
  { id: "color-gold", kind: "color", name: "Gold Name", desc: "Gold username color", cost: 200, value: "#fee75c" },
  { id: "color-pink", kind: "color", name: "Pink Name", desc: "Pink username color", cost: 200, value: "#eb459e" },
  { id: "color-mint", kind: "color", name: "Mint Name", desc: "Mint username color", cost: 200, value: "#57f287" },
  { id: "nitro", kind: "nitro", name: "Ping Nitro · 30 days", desc: "Animated glow avatar + rainbow frame access", cost: 500 }
];
const QUESTS = [
  { id: "chatter", name: "Chatterbox", desc: "Send 25 messages today", reward: 50,
    progress: async () => {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id).gte("created_at", dayStartISO());
      return { have: Math.min(count || 0, 25), need: 25 };
    } },
  { id: "reactor", name: "Reactor", desc: "Add 5 reactions today", reward: 30,
    progress: async () => {
      const { count } = await supabase.from("message_reactions").select("message_id", { count: "exact", head: true })
        .eq("user_id", session.user.id).gte("created_at", dayStartISO());
      return { have: Math.min(count || 0, 5), need: 5 };
    } },
  { id: "social", name: "Socialite", desc: "Send 3 DMs today", reward: 20,
    progress: async () => {
      const { count } = await supabase.from("dms").select("id", { count: "exact", head: true })
        .eq("sender_id", session.user.id).gte("created_at", dayStartISO());
      return { have: Math.min(count || 0, 3), need: 3 };
    } },
  { id: "decorator", name: "Decorator", desc: "Set an avatar emoji (⚙ Settings)", reward: 10, once: true,
    progress: async () => ({ have: profile.avatar_emoji ? 1 : 0, need: 1 }) },
  { id: "voiced", name: "On Air", desc: "Join a voice channel", reward: 15,
    progress: async () => {
      const { count } = await supabase.from("activity_log").select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id).eq("action", "voice_join").gte("created_at", dayStartISO());
      return { have: Math.min(count || 0, 1), need: 1 };
    } }
];
function dayStartISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

async function myWallet() {
  const [own, grants, itemGrants] = await Promise.all([
    supabase.from("activity_log").select("action,detail,created_at").eq("user_id", session.user.id).limit(2000),
    supabase.from("activity_log").select("action,detail,created_at").eq("action", "coin_grant")
      .like("detail", `grant:${profile.username}:%`).limit(200),
    supabase.from("activity_log").select("action,detail,created_at").eq("action", "item_grant")
      .like("detail", `item:${profile.username}:%`).limit(200)
  ]);
  let balance = 0;
  const owned = new Set(), claimsToday = new Set();
  let nitroUntil = 0;
  const today = todayISO();
  const eat = (action, detail, created) => {
    let m;
    if (action === "quest_claim" && (m = /quest:([^:]+):\+(\d+)/.exec(detail))) {
      balance += +m[2];
      if (String(created).slice(0, 10) === today) claimsToday.add(m[1]);
    } else if (action === "shop_buy" && (m = /buy:([^:]+):-(\d+)/.exec(detail))) {
      balance -= +m[2];
      if (m[1].startsWith("frame-")) owned.add(m[1]);
      if (m[1].startsWith("color-")) owned.add(m[1]);
      if (m[1] === "nitro") nitroUntil = Math.max(nitroUntil, Date.parse(created) + 30 * 864e5);
    } else if (action === "coin_grant" && (m = /grant:[^:]+:\+(\d+)/.exec(detail))) {
      balance += +m[1];
    } else if (action === "item_grant" && (m = /^item:[^:]+:([^:]+)$/.exec(detail))) {
      if (m[1] === "nitro") nitroUntil = Math.max(nitroUntil, Date.parse(created) + 30 * 864e5);
      else owned.add(m[1]);
    }
  };
  for (const r of (own.data || []).filter((r) => r.action !== "coin_grant")) eat(r.action, r.detail, r.created_at);
  for (const r of grants.data || []) eat(r.action, r.detail, r.created_at);
  for (const r of itemGrants.data || []) eat(r.action, r.detail, r.created_at);
  return { balance, owned, claimsToday, nitroUntil, nitroActive: nitroUntil > Date.now() };
}

/* ---------------- first-party apps and games ---------------- */
async function openGames() {
  showView("games-view");
  await renderGames();
}

async function renderGames() {
  const auth = $("games-auth");
  const content = $("games-content");
  auth.replaceChildren();
  content.replaceChildren();
  content.classList.add("hidden");
  const { data, error } = await supabase.from("app_authorizations").select("app_id")
    .eq("user_id", profile.id).eq("app_id", "ping-arcade").maybeSingle();
  if (error) {
    auth.appendChild(el("div", "Run the latest supabase-schema.sql update to enable Ping Arcade.", "empty-note"));
    return;
  }
  if (!data) {
    const card = el("div", null, "game-card");
    card.appendChild(el("h3", "Ping Arcade"));
    card.appendChild(el("p", "Authorize this built-in app to save game scores to your Ping account. You can disconnect it any time. Third-party OAuth apps are not connected here yet.", "muted small"));
    const authorize = el("button", "Authorize Ping Arcade", "btn-primary");
    authorize.type = "button";
    authorize.onclick = async () => {
      const result = await supabase.from("app_authorizations").insert({ user_id: profile.id, app_id: "ping-arcade" });
      if (result.error) { toast("Couldn't authorize Ping Arcade: " + result.error.message, "err"); return; }
      await logActivity("app_authorize", "ping-arcade");
      toast("Ping Arcade is connected to your account.", "ok");
      renderGames();
    };
    card.appendChild(authorize);
    auth.appendChild(card);
    return;
  }

  const connected = el("div", null, "game-card game-app-head");
  connected.appendChild(el("div", "Ping Arcade is connected as " + profile.username, "small"));
  const revoke = el("button", "Disconnect", "mini-btn");
  revoke.type = "button";
  revoke.onclick = async () => {
    const yes = await showModal({ title: "Disconnect Ping Arcade?", body: "Your saved scores will stay on your account, but the games will stop saving new ones.", okText: "Disconnect", danger: true });
    if (yes !== true) return;
    const result = await supabase.from("app_authorizations").delete().eq("user_id", profile.id).eq("app_id", "ping-arcade");
    if (result.error) { toast("Couldn't disconnect Ping Arcade: " + result.error.message, "err"); return; }
    await logActivity("app_revoke", "ping-arcade");
    renderGames();
  };
  connected.appendChild(revoke);
  auth.appendChild(connected);

  const { data: scores, error: scoreError } = await supabase.from("game_scores")
    .select("game_id,score,result,created_at").eq("user_id", profile.id)
    .order("created_at", { ascending: false }).limit(100);
  if (scoreError) {
    auth.appendChild(el("p", "Scores are unavailable. Run the latest schema update and try again.", "muted small"));
    return;
  }
  const rows = scores || [];
  const wins = rows.filter((x) => x.game_id === "tictactoe" && x.result === "win").length;
  const reactions = rows.filter((x) => x.game_id === "quickdraw" && Number(x.score) > 0).map((x) => Number(x.score));
  const best = reactions.length ? Math.min(...reactions) + " ms" : "—";
  const scrambleBest = Math.max(0, ...rows.filter((x) => x.game_id === "scramble").map((x) => Number(x.score)));
  content.classList.remove("hidden");
  content.appendChild(el("div", "Your account stats · " + wins + " Tic-Tac-Toe wins · best reaction " + best + " · best scramble " + scrambleBest, "games-intro muted small"));
  const grid = el("div", null, "games-grid");
  grid.appendChild(makeTicTacToeCard());
  grid.appendChild(makeQuickdrawCard());
  grid.appendChild(makeWordScrambleCard());
  content.appendChild(grid);
  const history = rows.slice(0, 8);
  const historyCard = el("div", null, "game-card game-history");
  historyCard.appendChild(el("h3", "Recent activity"));
  if (!history.length) historyCard.appendChild(el("div", "Your game results will show here.", "muted small"));
  for (const row of history) {
    const label = row.game_id === "quickdraw"
      ? "Quickdraw · " + row.score + " ms"
      : row.game_id === "scramble"
        ? "Word Scramble · " + row.score + " points"
        : "Tic-Tac-Toe · " + row.result;
    historyCard.appendChild(el("div", label + " · " + fmtTime(row.created_at), "muted small"));
  }
  content.appendChild(historyCard);
}

function makeTicTacToeCard() {
  const card = el("section", null, "game-card");
  const head = el("div", null, "game-card-top");
  head.appendChild(el("h3", "Tic-Tac-Toe"));
  head.appendChild(el("span", "SOLO", "game-badge"));
  card.appendChild(head);
  card.appendChild(el("p", "Play X against the Ping bot. Three in a row wins.", "muted small"));
  const status = el("div", "Your turn — you are X.", "game-status");
  const board = el("div", null, "ttt-board");
  const reset = el("button", "New game", "mini-btn");
  reset.type = "button";
  let cells = Array(9).fill("");
  let playing = true;
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = () => lines.map((line) => line.every((i) => cells[i] && cells[i] === cells[line[0]]) ? cells[line[0]] : null).find(Boolean) || null;
  const finish = (result) => {
    playing = false;
    status.textContent = result === "win" ? "You win!" : result === "loss" ? "The Ping bot wins." : "It's a draw.";
    saveGameScore("tictactoe", result === "win" ? 1 : 0, result);
    paint();
  };
  const paint = () => {
    board.replaceChildren();
    cells.forEach((mark, index) => {
      const button = el("button", mark, "ttt-cell");
      button.type = "button";
      button.setAttribute("aria-label", "Cell " + (index + 1) + (mark ? ": " + mark : ": empty"));
      button.disabled = !!mark || !playing;
      button.onclick = () => {
        if (!playing || cells[index]) return;
        cells[index] = "X";
        if (winner() === "X") { finish("win"); return; }
        if (cells.every(Boolean)) { finish("draw"); return; }
        const choose = (markToPlace) => {
          for (const i of cells.map((x, n) => x ? -1 : n).filter((n) => n >= 0)) {
            cells[i] = markToPlace;
            const wins = winner() === markToPlace;
            cells[i] = "";
            if (wins) return i;
          }
          return -1;
        };
        let bot = choose("O");
        if (bot < 0) bot = choose("X");
        if (bot < 0 && !cells[4]) bot = 4;
        if (bot < 0) {
          const open = cells.map((x, n) => x ? -1 : n).filter((n) => n >= 0);
          bot = open[Math.floor(Math.random() * open.length)];
        }
        cells[bot] = "O";
        if (winner() === "O") finish("loss");
        else if (cells.every(Boolean)) finish("draw");
        else { status.textContent = "Your turn — you are X."; paint(); }
      };
      board.appendChild(button);
    });
  };
  reset.onclick = () => { cells = Array(9).fill(""); playing = true; status.textContent = "Your turn — you are X."; paint(); };
  card.append(status, board, reset);
  paint();
  return card;
}

function makeQuickdrawCard() {
  const card = el("section", null, "game-card");
  const head = el("div", null, "game-card-top");
  head.appendChild(el("h3", "Quickdraw"));
  head.appendChild(el("span", "REACTION", "game-badge"));
  card.appendChild(head);
  card.appendChild(el("p", "Wait for green, then click as fast as you can.", "muted small"));
  const status = el("div", "Press start when you're ready.", "game-status");
  const button = el("button", "Start", "quickdraw-button");
  button.type = "button";
  let phase = "idle", timer = null, started = 0;
  button.onclick = async () => {
    if (phase === "waiting") {
      clearTimeout(timer);
      phase = "idle";
      button.className = "quickdraw-button false-start";
      button.textContent = "Too early — try again";
      status.textContent = "False start. Wait for the green signal next time.";
      return;
    }
    if (phase === "ready") {
      const ms = Math.max(1, Math.round(performance.now() - started));
      phase = "result";
      button.className = "quickdraw-button";
      button.textContent = ms + " ms · play again";
      status.textContent = ms < 250 ? "Lightning fast." : "Nice reaction.";
      await saveGameScore("quickdraw", ms, "reaction");
      return;
    }
    phase = "waiting";
    button.className = "quickdraw-button";
    button.textContent = "Wait for green…";
    status.textContent = "Don't click yet.";
    timer = setTimeout(() => {
      phase = "ready";
      started = performance.now();
      button.className = "quickdraw-button ready";
      button.textContent = "CLICK!";
      status.textContent = "Now!";
    }, 1200 + Math.random() * 2300);
  };
  card.append(status, button);
  return card;
}

function makeWordScrambleCard() {
  const words = [
    ["community", "A group of people chatting together"], ["channel", "A place for one topic"],
    ["sticker", "A fun image you can send"], ["arcade", "A place to play games"],
    ["friend", "Someone you enjoy talking with"], ["message", "A note sent in chat"],
    ["profile", "Your Ping identity page"], ["server", "A home for channels and members"],
    ["reaction", "An emoji reply to a message"], ["voice", "Chat using your microphone"]
  ];
  const card = document.createElement("section");
  card.className = "game-card scramble-card";
  const head = el("div", null, "game-card-top");
  head.append(el("h3", "Word Scramble"), el("span", "45 SEC", "game-badge"));
  card.appendChild(head);
  card.appendChild(el("p", "Unscramble as many Ping words as you can. Each correct answer is 10 points.", "muted small"));
  const scoreLine = el("div", "Score 0 · 45 seconds", "scramble-score");
  const letters = el("div", "Press start to play", "scramble-letters");
  const hint = el("div", "", "scramble-hint muted small");
  const status = el("div", "Ready when you are.", "game-status");
  const form = document.createElement("form");
  form.className = "scramble-form";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 24;
  input.autocomplete = "off";
  input.placeholder = "Type your answer";
  input.setAttribute("aria-label", "Word Scramble answer");
  input.disabled = true;
  const submit = el("button", "Submit", "mini-btn");
  submit.type = "submit";
  submit.disabled = true;
  form.append(input, submit);
  const start = el("button", "Start 45-second round", "btn-primary scramble-start");
  start.type = "button";
  let score = 0, seconds = 45, current = null, interval = null, running = false;
  const pickWord = () => {
    let next = words[Math.floor(Math.random() * words.length)];
    if (current && next[0] === current[0]) next = words[(words.indexOf(next) + 1) % words.length];
    current = next;
    const scrambled = current[0].split("");
    for (let i = scrambled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
    }
    if (scrambled.join("") === current[0]) scrambled.push(scrambled.shift());
    letters.textContent = scrambled.join("  ").toUpperCase();
    hint.textContent = "Hint: " + current[1];
    input.value = "";
    input.focus();
  };
  const finish = async () => {
    if (!running) return;
    running = false;
    clearInterval(interval);
    input.disabled = true;
    submit.disabled = true;
    start.textContent = "Play again";
    start.disabled = false;
    status.textContent = `Time's up! You scored ${score} points.`;
    await saveGameScore("scramble", score, score >= 30 ? "win" : "finished");
  };
  start.onclick = () => {
    if (running) return;
    score = 0;
    seconds = 45;
    running = true;
    scoreLine.textContent = `Score ${score} · ${seconds} seconds`;
    status.textContent = "Go!";
    start.textContent = "Round in progress";
    start.disabled = true;
    input.disabled = false;
    submit.disabled = false;
    pickWord();
    clearInterval(interval);
    interval = setInterval(() => {
      seconds--;
      scoreLine.textContent = `Score ${score} · ${seconds} seconds`;
      if (seconds <= 0) finish();
    }, 1000);
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!running || !current) return;
    if (input.value.trim().toLowerCase() === current[0]) {
      score += 10;
      scoreLine.textContent = `Score ${score} · ${seconds} seconds`;
      status.textContent = "Correct! +10 points.";
      pickWord();
    } else {
      status.textContent = "Not quite. Try another answer.";
      input.select();
    }
  };
  card.append(scoreLine, letters, hint, form, status, start);
  return card;
}

async function saveGameScore(gameId, score, result) {
  const { error } = await supabase.from("game_scores").insert({
    user_id: profile.id, game_id: gameId, score, result
  });
  if (error) toast("Score wasn't saved: " + error.message, "err");
}

/* main-column views (chat / dashboard / shop / quests / games / voice) */
function showView(id) {
  setMobileNav(false);
  for (const v of ["chat-view", "dashboard-view", "shop-view", "quests-view", "games-view", "saved-view", "server-settings-view", "voice-view"])
    $(v).classList.add("hidden");
  $(id).classList.remove("hidden");
}

async function openShop() {
  showView("shop-view");
  await renderShop();
}
async function renderShop() {
  const grid = $("shop-grid");
  grid.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  const w = await myWallet();
  $("shop-balance").textContent = `${w.balance} 🪙${w.nitroActive ? " · NITRO until " + new Date(w.nitroUntil).toLocaleDateString() : ""}`;
  $("coin-balance").textContent = `${w.balance} 🪙`;
  grid.innerHTML = "";
  const eq = profile.equipped || {};
  for (const item of SHOP) {
    const card = el("div", null, "shop-card");
    card.appendChild(el("div", item.name, "shop-name"));
    card.appendChild(el("div", item.desc, "muted small"));
    card.appendChild(el("div", `${item.cost} 🪙`, "shop-cost"));
    const btn = el("button", "", "mini-btn");
    btn.type = "button";
    if (item.kind === "nitro") {
      if (w.nitroActive) { btn.textContent = "Active"; btn.disabled = true; }
      else { btn.textContent = `Buy · ${item.cost} 🪙`; btn.onclick = () => buyItem(item); }
    } else if ((item.kind === "frame" && eq.frame === item.id)
      || (item.kind === "color" && eq.color === item.value)) {
      btn.textContent = "Equipped";
      btn.disabled = true;
    } else if (w.owned.has(item.id)) {
      btn.textContent = "Equip";
      btn.onclick = () => equipItem(item);
    } else {
      btn.textContent = `Buy · ${item.cost} 🪙`;
      btn.onclick = () => buyItem(item);
    }
    card.appendChild(btn);
    grid.appendChild(card);
  }
}
async function buyItem(item) {
  const w = await myWallet();
  if (w.balance < item.cost) { toast(`Need ${item.cost} 🪙 — you have ${w.balance}. Do quests!`, "err"); return; }
  if (item.nitro && !w.nitroActive) { toast("Rainbow Flow needs Nitro first.", "err"); return; }
  await logActivity("shop_buy", `buy:${item.id}:-${item.cost}`);
  toast(`Bought ${item.name}!`, "ok");
  if (item.kind === "frame" || item.kind === "color") await equipItem(item);
  else {
    if (item.kind === "nitro") {
      const eq = { ...(profile.equipped || {}), nitro: true };
      await supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id);
      profile.equipped = eq;
    }
    renderShop();
  }
  updateCoinPill();
}
async function equipItem(item) {
  const eq = { ...(profile.equipped || {}) };
  if (item.kind === "frame") eq.frame = item.id;
  if (item.kind === "color") eq.color = item.value;
  const { error } = await supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id);
  if (error) { toast("Couldn't equip: " + error.message, "err"); return; }
  profile.equipped = eq;
  const u = users.find((x) => x.id === profile.id);
  if (u) u.equipped = eq;
  toast(`Equipped ${item.name}.`, "ok");
  refreshUsers(true);
  renderShop();
}
async function updateCoinPill() {
  try {
    const w = await myWallet();
    $("coin-balance").textContent = `${w.balance} 🪙`;
  } catch { /* panel may be hidden */ }
}

async function openQuests() {
  showView("quests-view");
  await renderQuests();
}
async function renderQuests() {
  const list = $("quests-list");
  list.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  const w = await myWallet();
  $("quests-balance").textContent = `${w.balance} 🪙`;
  $("coin-balance").textContent = `${w.balance} 🪙`;
  // once-quests: check ever-claimed
  const ever = new Set();
  if (QUESTS.some((q) => q.once)) {
    const { data } = await supabase.from("activity_log").select("detail")
      .eq("user_id", session.user.id).eq("action", "quest_claim").limit(200);
    for (const r of data || []) {
      const m = /quest:([^:]+):/.exec(r.detail);
      if (m) ever.add(m[1]);
    }
  }
  list.innerHTML = "";
  for (const q of QUESTS) {
    const p = await q.progress();
    const doneToday = w.claimsToday.has(q.id);
    const doneEver = ever.has(q.id);
    const claimed = q.once ? doneEver : doneToday;
    const complete = p.have >= p.need;
    const card = el("div", null, "quest-card");
    const top = el("div", null, "quest-top");
    top.appendChild(el("div", q.name, "quest-name"));
    top.appendChild(el("div", `+${q.reward} 🪙`, "shop-cost"));
    card.appendChild(top);
    card.appendChild(el("div", q.desc, "muted small"));
    const bar = el("div", null, "quest-bar");
    const fill = el("div", null, "quest-fill");
    fill.style.width = Math.min(100, (p.have / Math.max(1, p.need)) * 100) + "%";
    bar.appendChild(fill);
    card.appendChild(bar);
    card.appendChild(el("div", `${Math.min(p.have, p.need)} / ${p.need}`, "muted small"));
    const btn = el("button", claimed ? "Claimed ✓" : complete ? "Claim" : "Locked", "mini-btn" + (claimed || !complete ? "" : " good"));
    btn.type = "button";
    btn.disabled = claimed || !complete;
    if (!claimed && complete) {
      btn.onclick = async () => {
        await logActivity("quest_claim", `quest:${q.id}:+${q.reward}`);
        toast(`+${q.reward} 🪙 ${q.name}!`, "ok");
        renderQuests();
      };
    }
    card.appendChild(btn);
    list.appendChild(card);
  }
}

/* safe markdown-lite: **bold** *italic* __underline__ ||spoiler|| `code` (no HTML parsing) */
function richText(src) {
  const frag = document.createDocumentFragment();
  const parts = String(src).split(/(`[^`]+`)/g);
  for (const part of parts) {
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      frag.appendChild(el("code", part.slice(1, -1), "md-code"));
    } else {
      richInline(part, frag);
    }
  }
  return frag;
}
function richInline(text, parent) {
  const re = /(\*\*.+?\*\*|\*[^*\n]+?\*|__[^_\n]+?__|\|\|.+?\|\|)/g;
  let last = 0, m;
  const push = (t) => { if (t) parent.appendChild(document.createTextNode(t)); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parent.appendChild(el("b", tok.slice(2, -2)));
    else if (tok.startsWith("__")) parent.appendChild(el("u", tok.slice(2, -2)));
    else if (tok.startsWith("||")) {
      const sp = el("span", tok.slice(2, -2), "spoiler");
      sp.onclick = () => sp.classList.add("revealed");
      parent.appendChild(sp);
    } else parent.appendChild(el("i", tok.slice(1, -1)));
    last = m.index + tok.length;
  }
  push(text.slice(last));
}

/* ---------------- pins, search + jump, profiles, uploads ---------------- */
async function togglePin(mid, pinned) {
  const { error } = await supabase.rpc("set_message_pin", { p_message_id: mid, p_pinned: !pinned });
  if (error) toast("Pin failed: " + error.message, "err");
  else toast(pinned ? "Unpinned." : "Pinned to channel.", "ok");
}

/* richer pins list rendered into the modal body */
async function showPinsRich() {
  if (!activeChannel) return;
  const { data } = await supabase.from("messages").select("id,content,created_at,user_id")
    .eq("channel_id", activeChannel.id).eq("pinned", true).order("id", { ascending: false }).limit(20);
  const overlay = $("modal-overlay");
  $("modal-title").textContent = "📌 Pinned in #" + activeChannel.name;
  const body = $("modal-body");
  body.innerHTML = "";
  overlay.querySelectorAll(".modal-extra-btn").forEach((b) => b.remove());
  $("modal-input").classList.add("hidden");
  $("modal-err").classList.add("hidden");
  const ok = $("modal-ok"), cancel = $("modal-cancel");
  ok.textContent = "Close";
  ok.classList.remove("danger");
  if (!(data || []).length) body.appendChild(el("div", "Nothing pinned yet.", "muted"));
  for (const m of data || []) {
    const row = el("button", null, "pin-row");
    row.type = "button";
    row.appendChild(el("div", userName(m.user_id) + " · " + fmtTime(m.created_at), "muted small"));
    row.appendChild(el("div", String(m.content).replace(/^\[ANN\]/, "📢 ").slice(0, 120)));
    row.onclick = () => {
      overlay.classList.add("hidden");
      ok.onclick = cancel.onclick = overlay.onclick = null;
      jumpToMessage(activeChannel.id, m.id);
    };
    body.appendChild(row);
  }
  overlay.classList.remove("hidden");
  const done = () => {
    overlay.classList.add("hidden");
    ok.onclick = cancel.onclick = overlay.onclick = null;
  };
  cancel.onclick = done;
  overlay.onclick = (e) => { if (e.target === overlay) done(); };
  ok.onclick = done;
}

async function jumpToMessage(channelId, mid) {
  if (!activeChannel || activeChannel.id !== channelId) {
    const ch = channels.find((c) => c.id === channelId);
    if (!ch) return;
    await selectChannel(channelId);
  }
  for (let tries = 0; tries < 3; tries++) {
    const node = document.querySelector(`.msg[data-mid="${mid}"]`);
    if (node) {
      node.scrollIntoView({ block: "center" });
      node.classList.add("flash");
      setTimeout(() => node.classList.remove("flash"), 1800);
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  toast("Message isn't in the last 100 — too far to jump.", "err");
}

let searchTimer = null;
async function runSearch(q) {
  const box = $("search-results");
  if (!q || !activeServer) { box.classList.add("hidden"); return; }
  const { data: chs } = await supabase.from("channels").select("id,name").eq("server_id", activeServer.id).limit(50);
  const ids = (chs || []).map((c) => c.id);
  if (!ids.length) return;
  const { data } = await supabase.from("messages").select("id,content,created_at,user_id,channel_id")
    .in("channel_id", ids).ilike("content", `%${q.replace(/[%_]/g, "")}%`)
    .order("id", { ascending: false }).limit(20);
  box.innerHTML = "";
  if (!(data || []).length) box.appendChild(el("div", "No matches.", "muted small"));
  const cmap = new Map((chs || []).map((c) => [c.id, c.name]));
  for (const m of data || []) {
    const row = el("button", null, "search-row");
    row.type = "button";
    row.appendChild(el("div", `#${cmap.get(m.channel_id) || "?"} · ${userName(m.user_id)} · ${fmtTime(m.created_at)}`, "muted small"));
    row.appendChild(el("div", String(m.content).slice(0, 110)));
    row.onclick = () => {
      box.classList.add("hidden");
      $("search-bar").classList.add("hidden");
      jumpToMessage(m.channel_id, m.id);
    };
    box.appendChild(row);
  }
  box.classList.remove("hidden");
}

function openProfile(uid) {
  hideBadgeTooltip();
  const u = users.find((x) => x.id === uid);
  if (!u) return;
  const overlay = $("modal-overlay");
  const card = $("modal-card");
  card.classList.add("profile-card-modal");
  $("modal-title").textContent = "Profile";
  $("modal-title").classList.add("hidden");
  const body = $("modal-body");
  body.replaceChildren();
  body.className = "profile-card-body";
  overlay.querySelectorAll(".modal-extra-btn").forEach((b) => b.remove());
  $("modal-input").classList.add("hidden");
  $("modal-err").classList.add("hidden");
  const ok = $("modal-ok"), cancel = $("modal-cancel");
  ok.textContent = "Close";
  ok.classList.remove("danger");
  const cover = el("div", null, "profile-cover");
  const closeButton = el("button", "×", "profile-close");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close profile");
  closeButton.onclick = () => ok.click();
  cover.appendChild(closeButton);
  body.appendChild(cover);

  const identity = el("div", null, "profile-identity");
  identity.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}));
  const details = el("div", null, "profile-identity-copy");
  const profileName = el("div", null, "profile-name");
  profileName.appendChild(el("span", u.username));
  const badge = roleBadge(u.role);
  if (badge) profileName.appendChild(badge);
  appendSpecialBadgeStrip(profileName, u.id, { limit: 3 });
  if (activeServer && u.id === activeServer.created_by) {
    const owner = el("span", "♛", "owner-badge");
    owner.title = "Server owner";
    owner.setAttribute("aria-label", "Server owner");
    profileName.appendChild(owner);
  }
  details.appendChild(profileName);
  details.appendChild(el("div", u.username, "profile-handle muted small"));
  const presence = presenceStatusForUser(u);
  const isOnline = presence !== "offline";
  const profileStatus = el("div", null, "profile-status muted small");
  const presenceDot = el("span", null, "dot " + presence);
  presenceDot.title = presenceLabel(presence);
  profileStatus.appendChild(presenceDot);
  profileStatus.appendChild(el("span", u.custom_status || (isOnline ? presenceLabel(presence) : "Last seen " + fmtTime(u.last_active))));
  details.appendChild(profileStatus);
  identity.appendChild(details);
  body.appendChild(identity);

  const earnedBadges = userBadges.get(u.id) || [];
  if (earnedBadges.length) {
    const badgeSection = el("section", null, "profile-section profile-awards");
    badgeSection.appendChild(el("div", "SPECIAL BADGES", "profile-section-title"));
    const badgeList = el("div", null, "profile-special-badges");
    for (const id of earnedBadges) {
      const node = specialBadgeNode(id, true);
      if (node) badgeList.appendChild(node);
    }
    badgeSection.appendChild(badgeList);
    body.appendChild(badgeSection);
  }
  const about = el("section", null, "profile-section");
  about.appendChild(el("div", "ABOUT ME", "profile-section-title"));
  about.appendChild(el("p", u.bio || "This person hasn't added an About Me yet.", "profile-bio"));
  body.appendChild(about);

  const account = el("div", null, "profile-account");
  account.appendChild(el("span", "Member since", "muted small"));
  account.appendChild(el("span", new Date(u.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }), "small"));
  body.appendChild(account);

  const actions = el("div", null, "profile-actions");
  if (uid !== session.user.id) {
    const dm = el("button", "Message", "btn-primary profile-message");
    dm.type = "button";
    dm.onclick = () => {
      closeProfile();
      openDM(uid);
    };
    actions.appendChild(dm);
  } else {
    const edit = el("button", "✎ Edit Profile", "btn-primary");
    edit.type = "button";
    edit.onclick = () => { closeProfile(); openProfileEditor(); };
    actions.appendChild(edit);
  }
  body.appendChild(actions);
  overlay.classList.remove("hidden");
  const closeProfile = () => {
    overlay.classList.add("hidden");
    ok.onclick = cancel.onclick = overlay.onclick = null;
    card.classList.remove("profile-card-modal");
    $("modal-title").classList.remove("hidden");
    body.className = "muted small";
  };
  cancel.onclick = closeProfile;
  overlay.onclick = (e) => { if (e.target === overlay) closeProfile(); };
  ok.onclick = closeProfile;
}

function openProfileEditor() {
  const card = $("modal-card");
  const overlay = $("modal-overlay");
  const body = $("modal-body");
  const title = $("modal-title");
  const save = $("modal-ok");
  const cancel = $("modal-cancel");
  card.classList.remove("profile-card-modal");
  card.classList.add("profile-editor-modal");
  title.classList.remove("hidden");
  title.textContent = "Edit your profile";
  body.replaceChildren();
  body.className = "profile-editor-body";
  $("modal-input").classList.add("hidden");
  $("modal-err").classList.add("hidden");
  overlay.querySelectorAll(".modal-extra-btn").forEach((button) => button.remove());
  save.textContent = "Save changes";
  save.disabled = false;
  save.classList.remove("danger");
  cancel.textContent = "Cancel";

  const fields = buildProfileEditorFields(body);
  const username = fields.username;
  const status = fields.status;
  const bio = fields.bio;

  const close = () => {
    overlay.classList.add("hidden");
    save.onclick = cancel.onclick = overlay.onclick = null;
    save.disabled = false;
    card.classList.remove("profile-editor-modal");
    title.classList.remove("hidden");
    body.className = "muted small";
    cancel.textContent = "Cancel";
  };
  cancel.onclick = close;
  overlay.onclick = (event) => { if (event.target === overlay) close(); };
  save.onclick = async () => {
    const nextName = username.value.trim();
    if (nextName.length < 2 || nextName.length > 20) {
      $("modal-err").textContent = "Display names must be 2–20 characters.";
      $("modal-err").classList.remove("hidden");
      username.focus();
      return;
    }
    save.disabled = true;
    const { data: names, error: namesError } = await supabase.from("profiles").select("id,username");
    if (namesError) {
      $("modal-err").textContent = "Couldn't check whether that username is available.";
      $("modal-err").classList.remove("hidden");
      save.disabled = false;
      return;
    }
    const duplicate = (names || []).some((member) =>
      member.id !== profile.id && member.username.toLowerCase() === nextName.toLowerCase());
    if (duplicate) {
      $("modal-err").textContent = "That username is already taken.";
      $("modal-err").classList.remove("hidden");
      save.disabled = false;
      username.focus();
      return;
    }
    const updates = {
      username: nextName,
      custom_status: status.value.trim().slice(0, 60),
      bio: bio.value.trim().slice(0, 240),
      avatar_emoji: fields.getAvatar() || null
    };
    const { data, error } = await supabase.from("profiles").update(updates).eq("id", profile.id).select("*").single();
    if (error) {
      $("modal-err").textContent = /duplicate/i.test(error.message)
        ? "That username is already taken."
        : "Couldn't save your profile. Run the latest profile block in supabase-schema.sql and try again.";
      $("modal-err").classList.remove("hidden");
      save.disabled = false;
      return;
    }
    profile = data;
    close();
    await refreshUsers(true);
    toast("Your profile is updated.", "ok");
    openProfile(profile.id);
  };
  overlay.classList.remove("hidden");
  username.focus();
}

async function sendImageMessage(url) {
  if (view.type === "dm" && !view.uid) { toast("Pick a conversation first.", "err"); return; }
  if (view.type === "channel" && !activeChannel) return;
  if (profile.is_muted) { toast("You are muted.", "err"); return; }
  const content = `[img]${url}`;
  const payload = view.type === "dm"
    ? { sender_id: session.user.id, receiver_id: view.uid, content }
    : { channel_id: activeChannel.id, user_id: session.user.id, content };
  const { error } = await supabase.from(view.type === "dm" ? "dms" : "messages").insert(payload);
  if (error) toast("Couldn't send image: " + error.message, "err");
}

/* ---------------- direct messages (private, never on dashboard) ---------------- */
function ensureDmSub() {
  if (dmChannel || !supabase) return;
  dmChannel = supabase.channel("my-dms")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "dms" }, (payload) => {
      const d = payload.new;
      const other = d.sender_id === session.user.id ? d.receiver_id : d.sender_id;
      const isCurrentThread = view.type === "dm" && view.uid === other;
      if (isCurrentThread) {
        appendMessage({ id: d.id, user_id: d.sender_id, content: d.content, created_at: d.created_at }, true);
      }
      if (d.sender_id !== session.user.id) {
        if (!isCurrentThread) {
          dmUnread.set(other, (dmUnread.get(other) || 0) + 1);
          paintDmUnread();
        }
        if (uiSettings.dmNotifications && (!isCurrentThread || document.hidden || !document.hasFocus())) {
          const sender = users.find((user) => user.id === d.sender_id);
          const preview = String(d.content || "").startsWith("[img]") ? "Sent an image" : d.content;
          showMessageNotification("New DM from " + (sender ? sender.username : "someone"), preview, "dm-" + other,
            { toastWhenVisible: !document.hidden });
        }
      }
      dmThreadCache = [d, ...(dmThreadCache || []).filter((item) => item.id !== d.id)].slice(0, 200);
      if (view.type === "dm") renderDmList();
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "dms" }, (payload) => {
      dmThreadCache = (dmThreadCache || []).filter((item) => item.id !== payload.old.id);
      const node = document.querySelector(`.msg[data-mid="${payload.old.id}"]`);
      if (node) node.remove();
    })
    .subscribe();
}

async function enterHome() {
  setMobileNav(false);
  view = { type: "dm", uid: null };
  document.body.classList.add("dm-home");
  $("dm-search-wrap").classList.remove("hidden");
  $("extra-nav").classList.remove("hidden");
  $("dm-header-avatar").classList.add("hidden");
  $("channel-name").classList.remove("profile-trigger");
  $("channel-name").removeAttribute("role");
  $("channel-name").removeAttribute("tabindex");
  $("channel-name").removeAttribute("aria-label");
  $("channel-name").onclick = null;
  $("channel-name").onkeydown = null;
  activeServer = null;
  activeChannel = null;
  if (msgChannel) { await supabase.removeChannel(msgChannel); msgChannel = null; }
  renderServerRail();
  $("server-header").textContent = "Direct Messages";
  await renderDmList(true);
  const box = $("messages");
  box.innerHTML = "";
  const welcome = el("section", null, "dm-home-empty");
  welcome.appendChild(el("div", "✉", "dm-home-icon"));
  welcome.appendChild(el("h2", "Your conversations live here"));
  welcome.appendChild(el("p", "Choose a direct message, or find someone new to chat with. Your DMs stay private between participants."));
  const findPeople = el("button", "Find people", "btn-primary");
  findPeople.type = "button";
  findPeople.onclick = () => $("people-btn").click();
  welcome.appendChild(findPeople);
  box.appendChild(welcome);
  $("channel-hash").textContent = "✉";
  $("channel-name").textContent = "Direct Messages";
  $("channel-topic").textContent = "";
  $("message-input").placeholder = "Select a conversation first";
  paintAnnounceBtn();
  lastRenderDay = ""; lastRenderUid = "";
  typingUsers.clear();
  renderTyping();
}

async function renderDmList(refresh = true) {
  const list = $("channel-list");
  list.innerHTML = "";
  const search = $("dm-search").value.trim().toLowerCase();
  if (search || peopleDirectoryOpen) {
    if (!users.length) await refreshUsers(true);
    list.appendChild(el("div", search ? "SEARCH RESULTS" : "PEOPLE", "chan-group"));
    const matches = users.filter((u) => u.id !== session.user.id && u.username.toLowerCase().includes(search));
    for (const u of matches.slice(0, 40)) {
      const row = el("div", null, "dm-thread-row");
      const avatarButton = el("button", null, "dm-avatar-button");
      avatarButton.type = "button";
      avatarButton.setAttribute("aria-label", "View " + u.username + "'s profile");
      avatarButton.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}));
      avatarButton.onclick = () => openProfile(u.id);
      const start = el("button", null, "dm-thread dm-thread-copy");
      start.type = "button";
      const meta = el("span", null, "dm-meta");
      const title = el("span", null, "dm-title-line");
      title.appendChild(el("span", u.username, "dm-name"));
      const badge = roleBadge(u.role);
      if (badge) title.appendChild(badge);
      appendSpecialBadgeStrip(title, u.id, { limit: 2 });
      meta.appendChild(title);
      const presence = presenceStatusForUser(u);
      const online = presence !== "offline";
      meta.appendChild(el("span", online ? presenceLabel(presence) + " · Start a conversation" : "Start a conversation", "muted small"));
      start.appendChild(meta);
      start.onclick = () => openDM(u.id);
      row.append(avatarButton, start);
      list.appendChild(row);
    }
    if (!matches.length) list.appendChild(el("div", "No people match that name.", "empty-note"));
    return;
  }
  list.appendChild(el("div", "DIRECT MESSAGES", "chan-group"));
  if (refresh || !Array.isArray(dmThreadCache)) {
    const { data, error } = await supabase.from("dms").select("*")
      .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
      .order("id", { ascending: false }).limit(200);
    if (error) { toast("Couldn't load direct messages: " + error.message, "err"); return; }
    dmThreadCache = data || [];
  }
  const threads = new Map();
  for (const d of dmThreadCache || []) {
    const other = d.sender_id === session.user.id ? d.receiver_id : d.sender_id;
    if (!threads.has(other)) threads.set(other, d);
  }
  for (const [uid, last] of threads) {
    const u = users.find((x) => x.id === uid);
    const name = u ? u.username : "unknown";
    const unread = dmUnread.get(uid) || 0;
    const row = el("div", null, "dm-thread-row");
    const avatarButton = el("button", null, "dm-avatar-button");
    avatarButton.type = "button";
    avatarButton.setAttribute("aria-label", "View " + name + "'s profile");
    avatarButton.appendChild(avatarNode(name, u && u.avatar_emoji, (u && u.equipped) || {}));
    avatarButton.onclick = () => { if (u) openProfile(uid); };
    const b = el("button", null, "chan dm-thread dm-thread-copy" + (view.uid === uid ? " active" : "") + (unread ? " unread" : ""));
    b.type = "button";
    if (unread) b.setAttribute("aria-label", name + ", " + unread + " unread messages");
    const meta = el("span");
    const dmName = el("div", null, "dm-title-line");
    dmName.appendChild(el("span", name, "dm-name"));
    const badge = roleBadge(u && u.role);
    if (badge) dmName.appendChild(badge);
    if (u) appendSpecialBadgeStrip(dmName, u.id, { limit: 2 });
    meta.appendChild(dmName);
    meta.appendChild(el("div", String(last.content).slice(0, 34), "muted small"));
    b.appendChild(meta);
    if (unread) b.appendChild(el("span", unread > 99 ? "99+" : String(unread), "dm-unread"));
    b.onclick = () => openDM(uid);
    row.append(avatarButton, b);
    list.appendChild(row);
  }
  if (!threads.size) list.appendChild(el("div", "No conversations yet. Search for someone above to say hello.", "empty-note"));
  const add = el("button", "+ New DM", "chan chan-add");
  add.type = "button";
  add.onclick = newDm;
  list.appendChild(add);
}

async function newDm() {
  await refreshUsers(true);
  const name = await showModal({ title: "New direct message", body: "Enter their exact username.", input: true, placeholder: "username", okText: "Message" });
  if (!name) return;
  const u = users.find((x) => x.username.toLowerCase() === name.toLowerCase());
  if (!u) { toast("No user called " + name, "err"); return; }
  if (u.id === session.user.id) { toast("That's you.", "err"); return; }
  openDM(u.id);
}

async function openDM(uid) {
  if (uid === session.user.id) return;
  setMobileNav(false);
  view = { type: "dm", uid };
  document.body.classList.add("dm-home");
  $("dm-search-wrap").classList.remove("hidden");
  $("extra-nav").classList.remove("hidden");
  $("dm-search").value = "";
  peopleDirectoryOpen = false;
  dmUnread.delete(uid);
  paintDmUnread();
  activeServer = null;
  activeChannel = null;
  if (msgChannel) { await supabase.removeChannel(msgChannel); msgChannel = null; }
  ensureDmSub();
  renderServerRail();
  $("server-header").textContent = "Direct Messages";
  await renderDmList(true);
  const u = users.find((x) => x.id === uid);
  const name = u ? u.username : "unknown";
  $("channel-hash").textContent = "";
  const headerAvatar = $("dm-header-avatar");
  headerAvatar.replaceChildren(avatarNode(name, u && u.avatar_emoji, (u && u.equipped) || {}));
  headerAvatar.classList.add("profile-trigger");
  headerAvatar.classList.remove("hidden");
  headerAvatar.setAttribute("role", "button");
  headerAvatar.setAttribute("tabindex", "0");
  headerAvatar.setAttribute("aria-label", "View " + name + "'s profile");
  headerAvatar.onclick = () => openProfile(uid);
  headerAvatar.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProfile(uid); }
  };
  $("channel-name").textContent = name;
  $("channel-name").classList.add("profile-trigger");
  $("channel-name").setAttribute("role", "button");
  $("channel-name").setAttribute("tabindex", "0");
  $("channel-name").setAttribute("aria-label", "View " + name + "'s profile");
  $("channel-name").onclick = () => openProfile(uid);
  $("channel-name").onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProfile(uid); }
  };
  $("channel-topic").textContent = "Private conversation";
  $("message-input").placeholder = "Message @" + name;
  paintAnnounceBtn();
  const box = $("messages");
  box.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  lastRenderDay = ""; lastRenderUid = ""; lastRenderTs = 0;
  msgCache.clear();
  reactionMap.clear();
  typingUsers.clear();
  renderTyping();
  const me = session.user.id;
  const { data } = await supabase.from("dms").select("*")
    .or(`and(sender_id.eq.${me},receiver_id.eq.${uid}),and(sender_id.eq.${uid},receiver_id.eq.${me})`)
    .order("id").limit(100);
  box.innerHTML = "";
  for (const d of data || []) {
    appendMessage({ id: d.id, user_id: d.sender_id, content: d.content, created_at: d.created_at }, false);
  }
  if (!(data || []).length) box.appendChild(el("div", "No messages yet — say hi! 👋", "empty-note"));
  box.scrollTop = box.scrollHeight;
  stickBottom = true;
  unreadCount = 0;
  $("scroll-pill").classList.add("hidden");
}

/* ---------------- voice channels (presence + WebRTC mesh, best effort) ---------------- */
let voiceId = null, voiceCh = null, localStream = null;
let voiceMuted = false, voiceDeaf = false, voiceFailed = false;
const voicePcs = new Map();
const voiceRosters = {};
let voiceRosterSubs = [];
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  // Free TURN relay (no signup): carries audio over TCP/443 when direct
  // peer-to-peer is blocked by NATs/firewalls. Remove if you run your own.
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turns:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
];
/* per-peer diagnostics: state + whether audio is relayed through TURN */
const peerConn = new Map(); // peerId -> { state, relayed, retried }
const peerLevels = new Map(); // peerId -> 0..1 speaking level
let meterTimer = null, sharedAudioCtx = null;

async function joinVoice(ch) {
  await leaveVoice(true);
  voiceId = ch.id;
  voiceMuted = false;
  voiceDeaf = false;
  voiceFailed = false;
  $("voice-name").textContent = ch.name;
  $("voice-hint").textContent = "mesh audio · may fail on strict networks";
  paintVoiceButtons();
  showView("voice-view");
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    localStream = null;
    voiceMuted = true;
    toast("Mic unavailable — listen-only mode.", "err");
  }
  voiceCh = supabase.channel("voice-" + ch.id, { config: { presence: { key: session.user.id } } });
  voiceCh
    .on("presence", { event: "sync" }, onVoiceSync)
    .on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload))
    .subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await voiceCh.track({ username: profile.username, muted: voiceMuted || !localStream, deafened: voiceDeaf, noMic: !localStream });
      voiceCh.send({ type: "broadcast", event: "signal", payload: { kind: "hello", from: session.user.id } });
      logActivity("voice_join", ch.name);
      paintVoiceButtons();
    });
  renderVoiceGrid();
  startMeter();
}

function onVoiceSync() {
  if (!voiceCh) return;
  const states = Object.entries(voiceCh.presenceState());
  voiceRosters[voiceId] = states.map(([id, arr]) => ({ id, ...((arr && arr[0]) || {}) }));
  paintRosters();
  renderVoiceGrid();
  for (const [id] of states) {
    if (id !== session.user.id && id > session.user.id) ensureOffer(id);
  }
}

async function ensureOffer(peerId) {
  if (voicePcs.has(peerId) || !localStream || !voiceCh) return;
  try {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    voicePcs.set(peerId, { pc, audio: null });
    wirePc(peerId, pc);
    for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    voiceCh.send({ type: "broadcast", event: "signal", payload: { kind: "offer", from: session.user.id, to: peerId, sdp: offer } });
  } catch { voiceNoteFailed(); }
}

function wirePc(peerId, pc) {
  peerConn.set(peerId, peerConn.get(peerId) || { state: "new", relayed: false, retried: false });
  pc.onicecandidate = (ev) => {
    if (ev.candidate && voiceCh) voiceCh.send({ type: "broadcast", event: "signal", payload: { kind: "ice", from: session.user.id, to: peerId, candidate: ev.candidate } });
  };
  pc.ontrack = (ev) => {
    let entry = voicePcs.get(peerId);
    if (!entry) { entry = { pc, audio: null }; voicePcs.set(peerId, entry); }
    if (!entry.audio) {
      const a = document.createElement("audio");
      a.autoplay = true;
      a.muted = voiceDeaf;
      document.body.appendChild(a);
      entry.audio = a;
    }
    entry.audio.srcObject = ev.streams[0];
    attachMeter(peerId, ev.streams[0]);
  };
  pc.onconnectionstatechange = async () => {
    const info = peerConn.get(peerId) || { state: "", relayed: false, retried: false };
    info.state = pc.connectionState;
    peerConn.set(peerId, info);
    if (pc.connectionState === "connected") {
      try {
        const stats = await pc.getStats();
        let remote = null;
        stats.forEach((r) => {
          if (r.type === "candidate-pair" && r.nominated) remote = stats.get(r.remoteCandidateId);
        });
        info.relayed = !!remote && remote.candidateType === "relay";
        peerConn.set(peerId, info);
      } catch { /* stats optional */ }
    }
    if (pc.connectionState === "failed" && !info.retried) {
      info.retried = true;
      peerConn.set(peerId, info);
      toast("Audio path failed — retrying via relay…");
      try { await pc.restartIce(); } catch { voiceNoteFailed(); }
    } else if (pc.connectionState === "failed") {
      voiceNoteFailed();
    }
    if (voiceId) renderVoiceGrid();
  };
}

/* speaking detection: analyser per remote stream, polled while in voice */
function attachMeter(peerId, stream) {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = sharedAudioCtx.createMediaStreamSource(stream);
    const an = sharedAudioCtx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const entry = voicePcs.get(peerId);
    if (entry) entry.meter = { an, buf: new Uint8Array(an.frequencyBinCount) };
  } catch { /* meters optional */ }
}
function startMeter() {
  stopMeter();
  meterTimer = setInterval(() => {
    if (!voiceId) return stopMeter();
    for (const [id, e] of voicePcs) {
      let level = 0;
      if (e.meter) {
        e.meter.an.getByteTimeDomainData(e.meter.buf);
        let sum = 0;
        for (let i = 0; i < e.meter.buf.length; i += 4) {
          const v = (e.meter.buf[i] - 128) / 128;
          sum += v * v;
        }
        level = Math.sqrt(sum / (e.meter.buf.length / 4));
      }
      peerLevels.set(id, level);
      const card = document.querySelector(`.voice-card[data-peer="${id}"]`);
      if (card) card.classList.toggle("speaking", level > 0.08);
    }
  }, 250);
}
function stopMeter() {
  if (meterTimer) clearInterval(meterTimer);
  meterTimer = null;
}

async function onSignal(p) {
  if (!p || p.to !== session.user.id || !voiceCh) return;
  try {
    if (p.kind === "hello") {
      if (session.user.id > p.from) ensureOffer(p.from);
      return;
    }
    const entry = voicePcs.get(p.from);
    if (p.kind === "offer") {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
      voicePcs.set(p.from, { pc, audio: null });
      wirePc(p.from, pc);
      if (localStream) for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
      await pc.setRemoteDescription(p.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      voiceCh.send({ type: "broadcast", event: "signal", payload: { kind: "answer", from: session.user.id, to: p.from, sdp: answer } });
    } else if (p.kind === "answer" && entry) {
      await entry.pc.setRemoteDescription(p.sdp);
    } else if (p.kind === "ice" && entry) {
      await entry.pc.addIceCandidate(p.candidate);
    }
  } catch { voiceNoteFailed(); }
}

function voiceNoteFailed() {
  if (voiceFailed) return;
  voiceFailed = true;
  $("voice-hint").textContent = "audio path failed (NAT?) — presence still works";
}

async function leaveVoice(silent) {
  if (voiceCh) { try { await supabase.removeChannel(voiceCh); } catch { /* gone */ } voiceCh = null; }
  for (const [, e] of voicePcs) {
    try { e.pc.close(); } catch { /* closed */ }
    if (e.audio) e.audio.remove();
  }
  voicePcs.clear();
  peerConn.clear();
  peerLevels.clear();
  stopMeter();
  if (localStream) { for (const t of localStream.getTracks()) t.stop(); localStream = null; }
  voiceId = null;
  if (!silent) {
    showView("chat-view");
    toast("Left voice.");
  }
}

function paintVoiceButtons() {
  $("voice-mute").textContent = voiceMuted ? "🔇" : "🎤";
  $("voice-mute").classList.toggle("off", voiceMuted);
  $("voice-deafen").textContent = voiceDeaf ? "🔇" : "🎧";
  $("voice-deafen").classList.toggle("off", voiceDeaf);
}

function renderVoiceGrid() {
  const grid = $("voice-grid");
  grid.innerHTML = "";
  const states = (voiceId && voiceRosters[voiceId]) || [];
  if (!states.length) {
    grid.appendChild(el("div", "Connecting…", "muted"));
    return;
  }
  for (const st of states) {
    const u = users.find((x) => x.id === st.id);
    const card = el("div", null, "voice-card");
    card.dataset.peer = st.id;
    const info = peerConn.get(st.id);
    if ((peerLevels.get(st.id) || 0) > 0.08) card.classList.add("speaking");
    card.appendChild(avatarNode(st.username || (u && u.username) || "?", u && u.avatar_emoji, (u && u.equipped) || {}));
    const voiceName = el("div", null, "voice-name-line");
    voiceName.appendChild(el("span", (st.username || "?") + (st.id === session.user.id ? " (you)" : ""), "voice-name2"));
    const badge = roleBadge(u && u.role);
    if (badge) voiceName.appendChild(badge);
    if (u) appendSpecialBadgeStrip(voiceName, u.id, { limit: 2 });
    card.appendChild(voiceName);
    let sub = st.noMic ? "listen-only" : st.muted ? "🔇 muted" : "🎤 live";
    if (st.id !== session.user.id && info) {
      if (info.state === "connected") sub += info.relayed ? " · relayed" : " · direct";
      else if (info.state) sub += " · " + info.state;
    }
    card.appendChild(el("div", sub, "muted small"));
    grid.appendChild(card);
  }
}

function unwatchVoiceRosters() {
  for (const rc of voiceRosterSubs) { try { supabase.removeChannel(rc); } catch { /* gone */ } }
  voiceRosterSubs = [];
}
function watchVoiceRosters() {
  unwatchVoiceRosters();
  if (!supabase || !session) return;
  for (const ch of channels.filter((c) => (c.kind || "text") === "voice")) {
    const rc = supabase.channel("roster-" + ch.id);
    rc.on("presence", { event: "sync" }, () => {
      voiceRosters[ch.id] = Object.entries(rc.presenceState())
        .filter(([id]) => !id.startsWith("roster-"))
        .map(([id, arr]) => ({ id, ...((arr && arr[0]) || {}) }));
      paintRosters();
    });
    rc.subscribe();
    voiceRosterSubs.push(rc);
  }
  paintRosters();
}
function paintRosters() {
  for (const ch of channels.filter((c) => (c.kind || "text") === "voice")) {
    const box = document.getElementById("roster-" + ch.id);
    if (!box) continue;
    box.innerHTML = "";
    for (const st of voiceRosters[ch.id] || []) {
      const u = users.find((x) => x.id === st.id);
      const row = el("div", null, "roster-row");
      row.appendChild(avatarNode(st.username || "?", u && u.avatar_emoji, (u && u.equipped) || {}));
      const rosterName = el("span", (st.username || "?") + (st.muted ? " (muted)" : ""), "small");
      row.appendChild(rosterName);
      const badge = roleBadge(u && u.role);
      if (badge) row.appendChild(badge);
      if (u) appendSpecialBadgeStrip(row, u.id, { limit: 2 });
      box.appendChild(row);
    }
  }
}

/* ---------------- admin dashboard ---------------- */
let dashboardSnapshot = {
  users: [], msgCount: {}, latestIp: {}, activities: [], reports: [], channels: {},
  reportError: null, gameScores: [], gameCount: null, gameError: null
};
async function loadDashboard() {
  const refresh = $("dash-refresh");
  refresh.disabled = true;
  $("admin-updated").textContent = "Refreshing dashboard data…";
  try {
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const [userResult, messageResult, activityResult, ipResult, serverResult, loginResult,
      reportResult, reportCountResult, channelResult, gameResult, gameCountResult] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("messages").select("user_id").order("id", { ascending: false }).limit(5000),
      supabase.from("activity_log").select("*").order("id", { ascending: false }).limit(100),
      supabase.from("user_ips").select("*").order("seen_at", { ascending: false }).limit(500),
      supabase.from("servers").select("id", { count: "exact", head: true }),
      supabase.from("activity_log").select("id", { count: "exact", head: true })
        .eq("action", "login").gte("created_at", weekAgo),
      supabase.from("message_reports").select("*").order("id", { ascending: false }).limit(100),
      supabase.from("message_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("channels").select("id,name"),
      supabase.from("game_scores").select("user_id,game_id,score,result,created_at")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("game_scores").select("id", { count: "exact", head: true })
    ]);
    const error = [userResult, messageResult, activityResult, ipResult, serverResult, loginResult, channelResult]
      .find((result) => result.error)?.error;
    if (error) toast("Some dashboard data could not be loaded: " + error.message, "err");
    users = userResult.data || [];
    const messages = messageResult.data || [];
    const activities = activityResult.data || [];
    const ips = ipResult.data || [];
    const msgCount = {};
    for (const message of messages) msgCount[message.user_id] = (msgCount[message.user_id] || 0) + 1;
    const latestIp = {};
    for (const entry of ips) if (!(entry.user_id in latestIp)) latestIp[entry.user_id] = entry.ip;
    dashboardSnapshot = {
      users, msgCount, latestIp, activities,
      reports: reportResult.data || [],
      channels: Object.fromEntries((channelResult.data || []).map((channel) => [channel.id, channel.name])),
      reportError: reportResult.error || reportCountResult.error,
      openReportCount: reportCountResult.count,
      gameScores: gameResult.data || [],
      gameCount: gameCountResult.count,
      gameError: gameResult.error || gameCountResult.error
    };
    $("currency-admin-section").classList.toggle("hidden", !isAdmin());
    populateCurrencyMembers();

    const onlineNow = users.filter((u) => presenceStatusForUser(u) !== "offline").length;
    $("stat-users").textContent = users.length;
    $("stat-online").textContent = onlineNow;
    $("stat-messages").textContent = messages.length + (messages.length === 5000 ? "+" : "");
    $("stat-logins").textContent = loginResult.count ?? "–";
    $("stat-servers").textContent = serverResult.count ?? "–";
    $("stat-muted").textContent = users.filter((u) => u.is_muted || u.is_banned).length;
    $("stat-reports").textContent = dashboardSnapshot.reportError ? "–" : dashboardSnapshot.openReportCount ?? "–";
    $("stat-games").textContent = dashboardSnapshot.gameError ? "–" : dashboardSnapshot.gameCount ?? "–";
    $("admin-updated").textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    renderDashboardUsers();
    renderDashboardActivity();
    renderReportQueue();
    renderDashboardGames();
  } catch (error) {
    $("admin-updated").textContent = "Couldn't refresh dashboard data.";
    toast("Dashboard refresh failed: " + (error.message || "connection error"), "err");
  } finally {
    refresh.disabled = false;
  }
}

function populateCurrencyMembers() {
  const select = $("grant-currency-user");
  if (!select) return;
  const selected = select.value;
  select.replaceChildren();
  const placeholder = el("option", "Choose a member");
  placeholder.value = "";
  select.appendChild(placeholder);
  for (const member of [...dashboardSnapshot.users].sort((a, b) => a.username.localeCompare(b.username))) {
    const option = el("option", member.username + (member.role === "admin" ? " · admin" : ""));
    option.value = member.id;
    select.appendChild(option);
  }
  if (dashboardSnapshot.users.some((member) => member.id === selected)) select.value = selected;
}

async function grantCurrencyFromDashboard() {
  if (!isAdmin()) return;
  const target = dashboardSnapshot.users.find((member) => member.id === $("grant-currency-user").value);
  const amount = Number($("grant-currency-amount").value);
  if (!target) { toast("Choose a member first.", "err"); return; }
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
    toast("Enter a whole number from 1 to 100,000.", "err"); return;
  }
  const confirmed = await showModal({
    title: "Confirm coin grant",
    body: `Give ${amount.toLocaleString()} Ping coins to ${target.username}? This will be recorded in the wallet ledger.`,
    okText: "Grant coins"
  });
  if (confirmed !== true) return;
  if (await grantCoinsToUser(target, amount)) $("grant-currency-amount").value = "";
}

async function grantCoinsToUser(target, amount, { refreshDashboard = true } = {}) {
  if (!isAdmin()) return false;
  const { error } = await logActivity("coin_grant", `grant:${target.username}:+${amount}`);
  if (error) { toast("Coin grant failed: " + error.message, "err"); return false; }
  toast(`Granted ${amount.toLocaleString()} Ping coins to ${target.username}.`, "ok");
  if (refreshDashboard) await loadDashboard();
  return true;
}

async function grantItemToUser(target, item) {
  if (!isAdmin()) return false;
  const { error } = await logActivity("item_grant", "item:" + target.username + ":" + item.id);
  if (error) { toast("Item grant failed: " + error.message, "err"); return false; }
  toast("Granted " + item.name + " to " + target.username + ".", "ok");
  return true;
}

function renderReportQueue() {
  const list = $("report-list");
  list.replaceChildren();
  if (dashboardSnapshot.reportError) {
    list.appendChild(el("p", "Reports need the latest Supabase schema update. Run supabase-schema.sql, then refresh this dashboard.", "report-empty"));
    return;
  }
  const filter = $("report-state-filter").value;
  const reports = dashboardSnapshot.reports.filter((report) => filter === "all" || report.status === filter);
  if (!reports.length) {
    list.appendChild(el("p", filter === "open" ? "No open message reports." : "No reports match this filter.", "report-empty"));
    return;
  }
  const reasonLabels = { spam: "Spam", harassment: "Harassment", hate: "Hate speech", sexual: "Sexual content", threats: "Threats", other: "Other" };
  for (const report of reports) {
    const reporter = dashboardSnapshot.users.find((user) => user.id === report.reporter_id);
    const author = dashboardSnapshot.users.find((user) => user.id === report.message_author_id);
    const channel = dashboardSnapshot.channels[report.channel_id];
    const card = el("article", null, "report-card");
    const head = el("div", null, "report-card-head");
    const title = el("div", null);
    title.appendChild(el("div", `Report #${report.id}`, "report-card-title"));
    title.appendChild(el("div", `${reporter ? "@" + reporter.username : "Deleted account"} reported @${author ? author.username : "deleted user"} in #${channel || "channel"} · ${fmtTime(report.created_at)}`, "report-card-meta"));
    const reason = el("span", reasonLabels[report.reason] || "Other", "report-reason");
    title.querySelector(".report-card-title").appendChild(reason);
    head.append(title, el("span", report.status, "report-status " + report.status));
    card.appendChild(head);
    card.appendChild(el("blockquote", report.message_content, "report-message"));
    if (report.status === "open") {
      const actions = el("div", null, "report-actions");
      const resolve = el("button", "Mark resolved", "mini-btn good");
      resolve.type = "button";
      resolve.onclick = () => reviewMessageReport(report, "resolved", false);
      const dismiss = el("button", "Dismiss", "mini-btn");
      dismiss.type = "button";
      dismiss.onclick = () => reviewMessageReport(report, "dismissed", false);
      actions.append(resolve, dismiss);
      if (report.message_id) {
        const remove = el("button", "Delete message", "mini-btn danger");
        remove.type = "button";
        remove.onclick = () => reviewMessageReport(report, "resolved", true);
        actions.appendChild(remove);
      }
      card.appendChild(actions);
    } else if (report.reviewed_at) {
      const reviewer = dashboardSnapshot.users.find((user) => user.id === report.reviewed_by);
      card.appendChild(el("div", `Reviewed by ${reviewer ? "@" + reviewer.username : "moderator"} · ${fmtTime(report.reviewed_at)}`, "report-card-meta"));
    }
    list.appendChild(card);
  }
}

async function reviewMessageReport(report, status, deleteMessage) {
  if (!canModerateServer()) return;
  if (deleteMessage) {
    const confirmed = await showModal({
      title: "Delete reported message?",
      body: "The message will be removed from its public channel. The report will remain in the moderation history.",
      okText: "Delete message",
      danger: true
    });
    if (confirmed !== true) return;
    const { error } = await supabase.from("messages").delete().eq("id", report.message_id);
    if (error) { toast("Message deletion failed: " + error.message, "err"); return; }
  }
  const { error } = await supabase.from("message_reports").update({
    status,
    reviewed_by: profile.id,
    reviewed_at: new Date().toISOString()
  }).eq("id", report.id);
  if (error) { toast("Couldn't update report: " + error.message, "err"); return; }
  await loadDashboard();
}

function renderDashboardGames() {
  const summary = $("game-admin-summary");
  const feed = $("game-admin-feed");
  summary.replaceChildren();
  feed.replaceChildren();
  if (dashboardSnapshot.gameError) {
    feed.appendChild(el("p", "Game activity is unavailable. Run the latest Supabase schema update and refresh.", "report-empty"));
    return;
  }
  const rows = dashboardSnapshot.gameScores;
  const tttWins = rows.filter((row) => row.game_id === "tictactoe" && row.result === "win").length;
  const quickdraws = rows.filter((row) => row.game_id === "quickdraw");
  const scrambles = rows.filter((row) => row.game_id === "scramble");
  const bestReaction = quickdraws.length ? Math.min(...quickdraws.map((row) => Number(row.score))) : null;
  const bestScramble = scrambles.length ? Math.max(...scrambles.map((row) => Number(row.score))) : null;
  for (const [label, value] of [
    ["Saved games", dashboardSnapshot.gameCount ?? "—"],
    ["Recent Tic-Tac-Toe wins", tttWins],
    ["Best recent Quickdraw", bestReaction === null ? "—" : bestReaction + " ms"],
    ["Best recent Scramble", bestScramble === null ? "—" : bestScramble + " points"]
  ]) {
    const chip = el("div", null, "game-admin-chip");
    chip.append(el("strong", String(value)), el("span", label));
    summary.appendChild(chip);
  }
  if (!rows.length) {
    feed.appendChild(el("p", "No saved games yet. Open Games & Apps to try Ping Arcade.", "report-empty"));
    return;
  }
  for (const row of rows.slice(0, 8)) {
    const user = dashboardSnapshot.users.find((member) => member.id === row.user_id);
    const game = row.game_id === "quickdraw" ? "Quickdraw" : row.game_id === "scramble" ? "Word Scramble" : "Tic-Tac-Toe";
    const result = row.game_id === "quickdraw" ? `${row.score} ms reaction` : row.game_id === "scramble" ? `${row.score} points` : row.result;
    const item = el("div", null, "game-admin-row");
    item.append(el("strong", `${user ? "@" + user.username : "Player"} · ${game}`), el("span", `${result} · ${fmtTime(row.created_at)}`));
    feed.appendChild(item);
  }
}

function renderDashboardUsers() {
  const tb = document.querySelector("#users-table tbody");
  tb.innerHTML = "";
  const query = $("user-filter").value.trim().toLowerCase();
  const roleFilter = $("user-role-filter").value;
  const stateFilter = $("user-state-filter").value;
  const filteredUsers = dashboardSnapshot.users.filter((u) => {
    const ip = dashboardSnapshot.latestIp[u.id] || "";
    const online = presenceStatusForUser(u) !== "offline";
    const matchesQuery = !query || String(u.username || "").toLowerCase().includes(query) || ip.toLowerCase().includes(query);
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesState = stateFilter === "all"
      || (stateFilter === "online" && online)
      || (stateFilter === "muted" && u.is_muted)
      || (stateFilter === "banned" && u.is_banned);
    return matchesQuery && matchesRole && matchesState;
  });
  $("user-result-count").textContent = `${filteredUsers.length} of ${dashboardSnapshot.users.length} members`;
  for (const u of filteredUsers) {
    const tr = document.createElement("tr");
    const nameCell = el("td");
    const nameBtn = el("button", null, "admin-user-link");
    nameBtn.type = "button";
    nameBtn.title = "Open user detail";
    nameBtn.onclick = () => userDetail(u.id);
    nameBtn.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}));
    const nameText = el("span", null, "admin-user-name");
    nameText.appendChild(el("span", u.username));
    const badge = roleBadge(u.role);
    if (badge) nameText.appendChild(badge);
    appendSpecialBadgeStrip(nameText, u.id, { limit: 2 });
    nameBtn.appendChild(nameText);
    nameCell.appendChild(nameBtn);
    tr.appendChild(nameCell);
    const roleCell = el("td");
    roleCell.appendChild(el("span", u.role, "admin-role-pill role-" + u.role));
    tr.appendChild(roleCell);
    const statusCell = el("td");
    const presence = presenceStatusForUser(u);
    const status = u.is_banned ? "Banned" : u.is_muted ? "Muted" : presenceLabel(presence);
    statusCell.appendChild(el("span", status, "admin-state-pill " + status.toLowerCase().replace(/\s+/g, "-")));
    tr.appendChild(statusCell);
    tr.appendChild(el("td", fmtTime(u.created_at)));
    tr.appendChild(el("td", fmtTime(u.last_active)));
    tr.appendChild(el("td", String(dashboardSnapshot.msgCount[u.id] || 0)));
    tr.appendChild(el("td", dashboardSnapshot.latestIp[u.id] || "n/a"));
    const act = el("td");
    if (u.id !== profile.id) {
      const mute = el("button", u.is_muted ? "Unmute" : "Mute", "mini-btn admin-action");
      mute.type = "button";
      mute.onclick = () => modUser(u, "is_muted", !u.is_muted);
      act.appendChild(mute);
      if (isAdmin()) {
        const ban = el("button", u.is_banned ? "Unban" : "Ban",
          "mini-btn admin-action " + (u.is_banned ? "good" : "danger"));
        ban.type = "button";
        ban.onclick = () => modUser(u, "is_banned", !u.is_banned);
        act.appendChild(ban);
        if (u.role !== "admin") {
          const role = el("button", u.role === "mod" ? "Demod" : "Make mod", "mini-btn admin-action");
          role.type = "button";
          role.title = "Admins only";
          role.onclick = () => modRole(u);
          act.appendChild(role);
        }
      }
    } else {
      act.appendChild(el("span", "(you)", "muted"));
    }
    tr.appendChild(act);
    tb.appendChild(tr);
  }
  if (!filteredUsers.length) {
    const tr = document.createElement("tr");
    const cell = el("td", "No members match these filters.", "admin-empty-cell");
    cell.colSpan = 8;
    tr.appendChild(cell);
    tb.appendChild(tr);
  }
}

function renderDashboardActivity() {
  const eventFilter = $("activity-filter").value;
  const feed = $("activity-feed");
  feed.innerHTML = "";
  const regularActivity = dashboardSnapshot.activities.filter((a) =>
    !a.action.startsWith("mod_") && (eventFilter === "all" || a.action === eventFilter)).slice(0, 30);
  for (const a of regularActivity) {
    const d = el("div", null, "feed-item");
    d.appendChild(el("b", `${a.username} — ${a.action}${a.detail ? ": " + a.detail : ""}`));
    d.appendChild(el("span", fmtTime(a.created_at) + (a.ip ? " · " + a.ip : ""), "t"));
    feed.appendChild(d);
  }
  if (!feed.children.length) feed.appendChild(el("p", eventFilter === "all" ? "No activity yet." : "No events match this filter.", "muted admin-feed-empty"));

  const mod = $("mod-log");
  mod.innerHTML = "";
  for (const a of dashboardSnapshot.activities.filter((x) => x.action.startsWith("mod_")).slice(0, 30)) {
    const d = el("div", null, "mod-item");
    d.appendChild(el("b", `${a.username} — ${a.action}: ${a.detail}`));
    d.appendChild(el("span", fmtTime(a.created_at), "t"));
    mod.appendChild(d);
  }
  if (!mod.children.length) mod.appendChild(el("p", "No moderation actions yet.", "muted"));
}

async function modUser(u, field, value, { refreshDashboard = true } = {}) {
  if (field === "is_banned" && !isAdmin()) return false;
  if (field === "is_muted" && !canMod()) return false;
  const action = field === "is_muted" ? (value ? "mod_mute" : "mod_unmute") : (value ? "mod_ban" : "mod_unban");
  const { error } = await supabase.rpc("admin_set_profile_flag", {
    p_user_id: u.id,
    p_field: field,
    p_value: value
  });
  if (error) { toast("Action failed: " + error.message, "err"); return false; }
  await logActivity(action, `${u.username} → ${value}`);
  if (refreshDashboard) loadDashboard();
  await refreshUsers();
  return true;
}

async function modRole(u, requestedRole = null, { refreshDashboard = true } = {}) {
  if (!isAdmin() || u.role === "admin") return;
  const next = requestedRole || (u.role === "mod" ? "member" : "mod");
  if (!(["member", "mod"].includes(next)) || next === u.role) return false;
  const { error } = await supabase.rpc("admin_set_member_role", {
    p_user_id: u.id,
    p_role: next
  });
  if (error) { toast("Role change failed: " + error.message, "err"); return false; }
  await logActivity(next === "mod" ? "mod_promote" : "mod_demote", u.username);
  if (refreshDashboard) loadDashboard();
  await refreshUsers();
  return true;
}

/* per-user deep dive: activity, IPs, message count, coin grants (admin) */
async function userDetail(uid) {
  const u = users.find((x) => x.id === uid);
  if (!u) return;
  const box = $("user-detail");
  box.innerHTML = "";
  const card = el("div", null, "detail-card");
  card.appendChild(el("div", `${u.username} · ${u.role}`, "detail-title"));
  card.appendChild(el("div", "Loading…", "muted small"));
  box.appendChild(card);
  const close = el("button", "Close", "mini-btn");
  close.type = "button";
  close.onclick = () => { box.innerHTML = ""; };
  card.appendChild(close);
  const [acts, ips, msgs] = await Promise.all([
    supabase.from("activity_log").select("action,detail,created_at").eq("user_id", uid).order("id", { ascending: false }).limit(15),
    supabase.from("user_ips").select("ip,seen_at").eq("user_id", uid).order("seen_at", { ascending: false }).limit(10),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("user_id", uid)
  ]);
  const loading = card.querySelector(".muted.small");
  if (loading) loading.remove();
  card.insertBefore(el("div", `Joined ${fmtTime(u.created_at)} · active ${fmtTime(u.last_active)} · messages sent: ${msgs.count ?? "?"}`, "small"), close);
  const ipList = (ips.data || []).map((r) => `${r.ip} (${fmtTime(r.seen_at)})`).join(", ") || "none recorded";
  card.insertBefore(el("div", "IPs seen: " + ipList, "small"), close);
  for (const a of acts.data || []) {
    card.insertBefore(el("div", `${a.action}${a.detail ? " — " + a.detail : ""} · ${fmtTime(a.created_at)}`, "small"), close);
  }
  if (isAdmin()) {
    const badgeManager = el("section", null, "admin-badge-manager");
    badgeManager.appendChild(el("div", "SPECIAL BADGES", "profile-section-title"));
    badgeManager.appendChild(el("p", "Award a badge to this member. Click an awarded badge to remove it.", "muted small"));
    const choices = el("div", null, "admin-badge-grid");
    const awarded = new Set(userBadges.get(uid) || []);
    for (const item of SPECIAL_BADGES) {
      const hasBadge = awarded.has(item.id);
      const button = el("button", null, "admin-badge-choice" + (hasBadge ? " awarded" : ""));
      button.type = "button";
      button.setAttribute("aria-pressed", String(hasBadge));
      button.append(el("span", item.icon, "admin-badge-icon"), el("span", item.label, "admin-badge-label"));
      button.appendChild(el("span", hasBadge ? "Awarded" : "Give badge", "admin-badge-state"));
      button.onclick = () => setProfileBadge(uid, item.id, !hasBadge);
      choices.appendChild(button);
    }
    badgeManager.appendChild(choices);
    card.insertBefore(badgeManager, close);
    const grant = el("button", "Grant coins…", "mini-btn good");
    grant.type = "button";
    grant.onclick = async () => {
      const amt = await showModal({ title: "Grant coins", body: `How many coins for ${u.username}?`, input: true, placeholder: "100", okText: "Grant" });
      const n = parseInt(amt, 10);
      if (!amt || !Number.isFinite(n) || n <= 0 || n > 100000) { if (amt) toast("Enter a number 1–100000.", "err"); return; }
      await grantCoinsToUser(u, n);
    };
    card.insertBefore(grant, close);
    const gift = el("button", "Grant shop item…", "mini-btn good");
    gift.type = "button";
    gift.onclick = async () => {
      const choices = SHOP.map((item) => item.name + " (" + item.id + ")").join(" · ");
      const raw = await showModal({
        title: "Grant an item",
        body: "Enter an item name or ID: " + choices,
        input: true, placeholder: "frame-violet", okText: "Grant"
      });
      if (!raw) return;
      const wanted = raw.trim().toLowerCase();
      const item = SHOP.find((x) => x.id.toLowerCase() === wanted || x.name.toLowerCase() === wanted);
      if (!item) { toast("Choose an item from the shop list.", "err"); return; }
      await grantItemToUser(u, item);
    };
    card.insertBefore(gift, close);
  }
}

async function setProfileBadge(uid, badgeId, award, { refreshDashboard = true, openDetail = true } = {}) {
  if (!isAdmin() || !SPECIAL_BADGES.some((badge) => badge.id === badgeId)) return false;
  const result = award
    ? await supabase.from("profile_badges").insert({ user_id: uid, badge_id: badgeId, granted_by: profile.id })
    : await supabase.from("profile_badges").delete().eq("user_id", uid).eq("badge_id", badgeId);
  if (result.error) {
    toast("Couldn't update badge. Run the v10 profile badges block from supabase-schema.sql.", "err");
    return false;
  }
  await refreshUsers(true);
  if (refreshDashboard) renderDashboardUsers();
  if (openDetail) await userDetail(uid);
  toast(award ? "Badge awarded." : "Badge removed.", "ok");
  return true;
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
