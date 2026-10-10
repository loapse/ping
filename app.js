/* Ping — static frontend + Supabase backend (auth, realtime chat, admin). */
/* Supabase client is vendored locally (vendor-supabase-umd.js) so the app has
   zero third-party script dependencies. */
const { createClient } = window.supabase;
import { composeEditedMessage, getMessageEditDraft } from "./message-utils.mjs";
import { ADMIN_COMMANDS, getAdminCommandMatches, parseAdminCommand } from "./admin-commands.mjs";
// Signals index.html's boot watchdog that the module (incl. CDN imports) loaded.
window.__pingBooted = true;

/* ---------------- helpers ---------------- */
const $ = (id) => document.getElementById(id);
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
/* Inline SVG icon set for UI chrome (never message content). Original
   24×24 stroke icons in currentColor so they inherit text color. */
const ICON_PATHS = {
  pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h9a7 7 0 0 1 7 7v3"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.6 2.2 2.4 3.5 2.4s2.5-.8 3.5-2.4"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  clip: '<path d="M21 11.5 12.7 19.8a5.5 5.5 0 0 1-7.8-7.8L13.2 3.7a3.7 3.7 0 0 1 5.2 5.2l-8.3 8.3a1.8 1.8 0 0 1-2.6-2.6L14 8"/>',
  pin: '<path d="M9 4h6l1 7 3 3v2H5v-2l3-3Z"/><path d="M12 16v5"/>',
  star: '<path d="M12 3.5 14.7 9l6 .6-4.5 4 1.3 5.9L12 16.4 6.5 19.5l1.3-5.9-4.5-4 6-.6Z"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M4.5 12.5 10 18 19.5 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.8 4.2-5.5 7.5-5.5s6.1 1.7 7.5 5.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.8 19.5c1.2-3.2 3.5-4.7 6.2-4.7s5 1.5 6.2 4.7"/><circle cx="17" cy="9.5" r="2.8"/><path d="M15.5 14.6c2.9.2 5 1.7 6 4.4"/>',
  idcard: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16.5c.6-1.6 1.6-2.3 3-2.3s2.4.7 3 2.3"/><path d="M14 10.5h4M14 13.5h6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
  micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/><path d="M3 3l18 18"/>',
  phones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/>',
  phonesOff: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/><path d="M3 3l18 18"/>',
  rocket: '<path d="M12 15c5-4 7-8.5 7-12.5C15.5 3 11 5 7 10l5 5Z"/><circle cx="14" cy="10" r="1.6"/><path d="M7 10l-3.5 5L7 14M10 17l-5 3.5L14 17M9 21c-2 2-2.5 4-2.5 4"/>',
  cart: '<circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2.5l2.2 11h10.6l2.2-8H6"/>',
  swords: '<path d="M5 4l12 12M5 4v3M5 4h3M19 4L7 16M19 4v3M19 4h-3M6.5 17.5 4 20M17.5 17.5 20 20"/>',
  gamepad: '<rect x="2.5" y="7.5" width="19" height="10" rx="5"/><path d="M8 10.5v4M6 12.5h4"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="17.8" cy="14" r=".9"/>',
  chat: '<path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5c-1.4 0-2.8-.3-4-.9L4 19.5l1.2-3.3A7.5 7.5 0 1 1 21 11.5Z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>',
  logout: '<path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><path d="M15 16l4-4-4-4M19 12H9"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M2.5 12S6 5.5 12 5.5c1.8 0 3.4.6 4.8 1.4M21.5 12S18 18.5 12 18.5c-1.8 0-3.4-.6-4.8-1.4"/><circle cx="12" cy="12" r="2.8"/><path d="M3 3l18 18"/>',
  speaker: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  crown: '<path d="M4 18 3 8l5 3.5L12 5l4 6.5L21 8l-1 10H4Z"/><path d="M4 21h16"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.5 5.5-5.5 2.5 2.5-5.5Z"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8.5 16v-5M13 16V8M17.5 16v-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  share: '<path d="M14 5l6 6-6 6M20 11H9a5 5 0 0 0-5 5v1"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sticker: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M13 3v5a3 3 0 0 0 3 3h5M7.5 14.5h.01M11 14.5h.01M8.5 18c1.8 1.3 3.7 1.3 5.5 0"/>',
  gift: '<rect x="4" y="8.5" width="16" height="4" rx="1"/><path d="M6 12.5V20a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7.5M12 8.5V21M12 8.5S12 4.5 8.5 4.5 8 8.5 12 8.5ZM12 8.5s0-4 3.5-4 0 4-3.5 4Z"/>'
};
function icon(name, cls) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "ico" + (cls ? " " + cls : ""));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.9");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const wrap = ICON_PATHS[name] || "";
  const tmp = document.createElementNS("http://www.w3.org/2000/svg", "g");
  tmp.innerHTML = wrap;
  while (tmp.firstChild) svg.appendChild(tmp.firstChild);
  return svg;
}
/* Presence dots (status colors, no emoji). */
function presenceDot(status) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "ico presence-ico presence-" + status);
  svg.setAttribute("aria-hidden", "true");
  const NS = "http://www.w3.org/2000/svg";
  if (status === "idle") {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M12 3a9 9 0 1 0 9 9h-9V3Z");
    p.setAttribute("fill", "currentColor");
    svg.appendChild(p);
    const r = document.createElementNS(NS, "circle");
    r.setAttribute("cx", "12"); r.setAttribute("cy", "12"); r.setAttribute("r", "9");
    r.setAttribute("fill", "none"); r.setAttribute("stroke", "currentColor"); r.setAttribute("stroke-width", "2.5");
    svg.appendChild(r);
  } else if (status === "dnd") {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "12"); c.setAttribute("cy", "12"); c.setAttribute("r", "9");
    c.setAttribute("fill", "currentColor");
    svg.appendChild(c);
    const bar = document.createElementNS(NS, "rect");
    bar.setAttribute("x", "7"); bar.setAttribute("y", "10.4"); bar.setAttribute("width", "10");
    bar.setAttribute("height", "3.2"); bar.setAttribute("rx", "1.6");
    bar.setAttribute("fill", "var(--bg-2, #2b2d31)");
    svg.appendChild(bar);
  } else if (status === "invisible" || status === "offline") {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "12"); c.setAttribute("cy", "12"); c.setAttribute("r", "9");
    c.setAttribute("fill", "none"); c.setAttribute("stroke", "currentColor"); c.setAttribute("stroke-width", "2.5");
    svg.appendChild(c);
  } else {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "12"); c.setAttribute("cy", "12"); c.setAttribute("r", "9");
    c.setAttribute("fill", "currentColor");
    svg.appendChild(c);
  }
  return svg;
}
/* Icon button: <button> with an SVG icon child (clicks land on the button). */
function iconBtn(name, cls, title) {
  const b = el("button", null, cls);
  b.type = "button";
  if (title) {
    b.title = title;
    b.setAttribute("aria-label", title);
  }
  b.appendChild(icon(name));
  return b;
}
/* Escape LIKE wildcards so a username like "100%" matches literally. */
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (ch) => "\\" + ch);
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
  { id: "community_voice", label: "Community Voice", icon: "📣" },
  { id: "nitro", label: "Boost", icon: "⚡" },
  { id: "boost", label: "Boost", icon: "⚡" }
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
  community_voice: "Helped shape the direction of the community.",
  nitro: "Owns Ping Boost.",
  boost: "Owns Ping Boost."
};
/* Original geometric badge artwork (no emoji). All icons draw in a 48×48 box:
   dark medallion disc + one bold mark. Pure shapes only, so they stay crisp
   at 16px and can't carry scripts. */
function badgeSvgEl(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function badgeArtwork(id) {
  const svg = badgeSvgEl("svg", { viewBox: "0 0 48 48", class: "badge-svg" });
  svg.setAttribute("role", "img");
  const disc = (stroke) => svg.appendChild(badgeSvgEl("circle",
    { cx: 24, cy: 24, r: 17, fill: "#141519", stroke: stroke, "stroke-width": 2 }));
  const dot = (cx, cy, r, fill, op) => svg.appendChild(badgeSvgEl("circle",
    { cx: cx, cy: cy, r: r, fill: fill, opacity: op == null ? "1" : String(op) }));
  switch (id) {
    case "founder": {
      disc("#ffd75e");
      svg.appendChild(badgeSvgEl("polygon", { points: "24,8 28,18.5 39.2,19 30.5,26.1 33.4,37.4 24,30.8 14.6,37.4 17.5,26.1 8.8,19 20,18.5", fill: "#ffd75e" }));
      break;
    }
    case "early_supporter": {
      disc("#a78bfa");
      svg.appendChild(badgeSvgEl("path", { d: "M24 38 C14 30 9 24 9 18.5 C9 13.5 12.8 10 17.5 10 C20.5 10 23 11.8 24 14 C25 11.8 27.5 10 30.5 10 C35.2 10 39 13.5 39 18.5 C39 24 34 30 24 38 Z", fill: "#a78bfa" }));
      break;
    }
    case "event_winner": {
      disc("#fbbf24");
      const cup = badgeSvgEl("polygon", { points: "17,9 31,9 29,24 19,24", fill: "#fbbf24" });
      svg.appendChild(cup);
      svg.appendChild(badgeSvgEl("path", { d: "M17 11 C12 11 12 19 18.5 20.5 M31 11 C36 11 36 19 29.5 20.5", fill: "none", stroke: "#fbbf24", "stroke-width": 2.6, "stroke-linecap": "round" }));
      svg.appendChild(badgeSvgEl("rect", { x: 22.4, y: 24, width: 3.2, height: 6, rx: 1, fill: "#fbbf24" }));
      svg.appendChild(badgeSvgEl("rect", { x: 17.5, y: 30.5, width: 13, height: 3.4, rx: 1.7, fill: "#fbbf24" }));
      break;
    }
    case "helper": {
      disc("#fde047");
      svg.appendChild(badgeSvgEl("circle", { cx: 24, cy: 19, r: 9, fill: "#fde047" }));
      svg.appendChild(badgeSvgEl("rect", { x: 20.3, y: 28, width: 7.4, height: 3, rx: 1, fill: "#9aa0a6" }));
      svg.appendChild(badgeSvgEl("rect", { x: 21.5, y: 32, width: 5, height: 2.6, rx: 1, fill: "#9aa0a6" }));
      svg.appendChild(badgeSvgEl("path", { d: "M10 12 L13 15 M38 12 L35 15 M24 4 V8", stroke: "#fde047", "stroke-width": 2.2, "stroke-linecap": "round", fill: "none" }));
      break;
    }
    case "builder": {
      disc("#fb923c");
      svg.appendChild(badgeSvgEl("path", { d: "M12 27 C12 16.5 17 11 24 11 C31 11 36 16.5 36 27 Z", fill: "#fb923c" }));
      svg.appendChild(badgeSvgEl("rect", { x: 9, y: 27, width: 30, height: 3.6, rx: 1.8, fill: "#fb923c" }));
      svg.appendChild(badgeSvgEl("rect", { x: 22.3, y: 11, width: 3.4, height: 9, rx: 1.7, fill: "#ea7c28" }));
      break;
    }
    case "artist": {
      svg.appendChild(badgeSvgEl("circle", { cx: 24, cy: 24, r: 15, fill: "#f472b6" }));
      dot(30.5, 30.5, 4.2, "#141519");
      dot(18, 17.5, 2.6, "#ef4444");
      dot(28.5, 15.5, 2.6, "#facc15");
      dot(33, 23.5, 2.6, "#60a5fa");
      dot(15.5, 25.5, 2.6, "#34d399");
      break;
    }
    case "bug_hunter": {
      disc("#4ade80");
      const legs = "M16.5 22 L10 17.5 M16 26.5 L9.5 26.5 M16.5 31 L10 35.5 M31.5 22 L38 17.5 M32 26.5 L38.5 26.5 M31.5 31 L38 35.5 M22.5 11 L19.5 6.5 M25.5 11 L28.5 6.5";
      svg.appendChild(badgeSvgEl("path", { d: legs, stroke: "#4ade80", "stroke-width": 2, "stroke-linecap": "round", fill: "none" }));
      svg.appendChild(badgeSvgEl("ellipse", { cx: 24, cy: 26.5, rx: 7.6, ry: 9.5, fill: "#4ade80" }));
      svg.appendChild(badgeSvgEl("circle", { cx: 24, cy: 14.5, r: 4.4, fill: "#4ade80" }));
      svg.appendChild(badgeSvgEl("path", { d: "M24 17 V33", stroke: "#141519", "stroke-width": 1.6, opacity: "0.55", fill: "none" }));
      break;
    }
    case "veteran": {
      svg.appendChild(badgeSvgEl("path", { d: "M24 5 L37 10.5 V24 C37 33.5 30.5 39.5 24 42.5 C17.5 39.5 11 33.5 11 24 V10.5 Z", fill: "#475569", stroke: "#e5e7eb", "stroke-width": 2.2, "stroke-linejoin": "round" }));
      svg.appendChild(badgeSvgEl("polygon", { points: "24,16.5 26,21.8 31.8,22.1 27.3,25.7 28.7,31.3 24,28.2 19.3,31.3 20.7,25.7 16.2,22.1 22,21.8", fill: "#ffd75e", transform: "translate(0,1)" }));
      break;
    }
    case "vip": {
      disc("#22d3ee");
      svg.appendChild(badgeSvgEl("polygon", { points: "14,18 24,10 24,24", fill: "#a5f3fc" }));
      svg.appendChild(badgeSvgEl("polygon", { points: "24,10 34,18 24,24", fill: "#67e8f9" }));
      svg.appendChild(badgeSvgEl("polygon", { points: "14,18 34,18 24,38", fill: "#0e7490" }));
      svg.appendChild(badgeSvgEl("polygon", { points: "14,18 24,24 24,38", fill: "#155e75" }));
      break;
    }
    case "community_voice": {
      disc("#f87171");
      svg.appendChild(badgeSvgEl("polygon", { points: "13,21 29,14.5 29,31.5 13,27", fill: "#f87171" }));
      svg.appendChild(badgeSvgEl("rect", { x: 29, y: 12, width: 4.6, height: 22, rx: 2.3, fill: "#f87171" }));
      svg.appendChild(badgeSvgEl("rect", { x: 15.5, y: 27.5, width: 4.4, height: 9, rx: 1.5, fill: "#f87171" }));
      break;
    }
    default:
      return null;
  }
  return svg;
}
function specialBadgeNode(id, labeled = false, tier = 0) {
  const badge = SPECIAL_BADGES.find((item) => item.id === id);
  if (!badge) return null;
  const node = el("span", null, "special-badge badge-" + badge.id);
  node.setAttribute("role", "img");
  if (id === "nitro" || id === "boost") {
    const T = NITRO_TIERS[Math.min(Math.max(0, tier | 0), NITRO_TIERS.length - 1)];
    attachBadgeTooltip(node, T.name, "Boost subscriber — badge evolves with renewals.");
    node.appendChild(nitroBadgeNode(tier));
  } else {
    attachBadgeTooltip(node, badge.label, SPECIAL_BADGE_DETAILS[badge.id]);
    node.appendChild(badgeArtwork(id) || el("span", badge.icon, "special-badge-icon"));
  }
  if (labeled) node.appendChild(el("span", id === "nitro" || id === "boost" ? NITRO_TIERS[Math.min(Math.max(0, tier | 0), NITRO_TIERS.length - 1)].name : badge.label, "special-badge-label"));
  return node;
}
function appendSpecialBadgeStrip(parent, uid, { labels = false, limit = 3 } = {}) {
  const ids = userBadges.get(uid) || [];
  if (!ids.length) return;
  const strip = el("span", null, "special-badge-strip" + (labels ? " labeled" : ""));
  for (const id of ids.slice(0, limit)) {
    const badge = specialBadgeNode(id, labels, id === "nitro" || id === "boost" ? (nitroTiers.get(uid) || 0) : 0);
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
function avatarNode(name, emoji, equip, url) {
  const d = el("div", null, "avatar");
  if (url && isSafeImg(url)) {
    // Uploaded PFP (GIFs animate natively in <img>).
    const img = document.createElement("img");
    img.src = url;
    img.alt = String(name || "");
    img.loading = "lazy";
    img.draggable = false;
    applyAvatarCrop(img, equip && equip.avatarCrop);
    d.appendChild(img);
  } else if (emoji) {
    d.textContent = emoji;
  } else {
    d.textContent = String(name || "?").slice(0, 1).toUpperCase();
    d.style.background = avatarColor(name);
  }
  equip = equip || {};
  if (equip.frame) d.classList.add("fr-" + String(equip.frame).replace("frame-", ""));
  if (equip.frame && (equip.nitro || equip.boost)) d.classList.add("nitro-on");
  const frameArt = (shopCatalog || []).find((item) => item.id === equip.frame && item.image_url);
  if (frameArt && isSafeImg(frameArt.image_url)) {
    const art = document.createElement("img");
    art.src = frameArt.image_url;
    art.alt = "";
    art.className = "avatar-frame-art";
    art.draggable = false;
    d.appendChild(art);
  }
  return d;
}
/* Zoom-about-a-point crop for uploaded avatars. Keeps GIFs animated
   (pure CSS transform, no re-encoding). z: 1–4 zoom, cx/cy: 0–1 focus. */
function applyAvatarCrop(img, crop) {
  if (!crop) return;
  let z = Number(crop.z), cx = Number(crop.cx), cy = Number(crop.cy);
  if (!Number.isFinite(z)) z = 1;
  if (!Number.isFinite(cx)) cx = 0.5;
  if (!Number.isFinite(cy)) cy = 0.5;
  z = Math.min(4, Math.max(1, z));
  cx = Math.min(1, Math.max(0, cx));
  cy = Math.min(1, Math.max(0, cy));
  img.style.transformOrigin = `${cx * 100}% ${cy * 100}%`;
  img.style.transform = `scale(${z})`;
}
function userEmoji(id) {
  const u = users.find((x) => x.id === id);
  return u ? u.avatar_emoji : null;
}
function userAvatarUrl(id) {
  const u = users.find((x) => x.id === id);
  return u ? u.avatar_url : null;
}
/* Render the signed-in user's panel avatar (uploaded image wins). */
function paintUserPanelAvatar() {
  const av = $("user-avatar");
  if (!av || !profile) return;
  av.replaceChildren();
  av.style.background = "";
  av.classList.remove("nitro-on");
  [...av.classList].filter((name) => name.startsWith("fr-")).forEach((name) => av.classList.remove(name));
  if (profile.avatar_url && isSafeImg(profile.avatar_url)) {
    const img = document.createElement("img");
    img.src = profile.avatar_url;
    img.alt = profile.username;
    img.loading = "lazy";
    applyAvatarCrop(img, (profile.equipped || {}).avatarCrop);
    av.appendChild(img);
  } else if (profile.avatar_emoji) {
    av.textContent = profile.avatar_emoji;
    av.style.background = "var(--bg-3)";
  } else {
    av.textContent = profile.username.slice(0, 1).toUpperCase();
    av.style.background = avatarColor(profile.username);
  }
  const eq = profile.equipped || {};
  if (eq.frame) av.classList.add("fr-" + String(eq.frame).replace("frame-", ""));
  if (eq.frame && (eq.nitro || eq.boost)) av.classList.add("nitro-on");
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
const pendingMessageNodes = [];
let replyTo = null;
let spoilerNextMessage = false;

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
function showModal({ title, body = "", input = false, initial = "", placeholder = "", maxLength = 60, okText = "OK", danger = false, extra = [], textarea = false, textareaPlaceholder = "", textareaInitial = "" }) {
  return new Promise((resolve) => {
    $("modal-title").textContent = title;
    $("modal-body").textContent = body;
    const inp = $("modal-input");
    inp.classList.toggle("hidden", !input);
    inp.value = initial || "";
    inp.placeholder = placeholder;
    inp.maxLength = maxLength;
    const ta = $("modal-textarea");
    ta.classList.toggle("hidden", !textarea);
    ta.value = textareaInitial || "";
    ta.placeholder = textareaPlaceholder;
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
    updateScreenMini();
    if (input) setTimeout(() => inp.focus(), 50);
    const done = (val) => {
      overlay.classList.add("hidden");
      updateScreenMini();
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
      done(textarea ? { value: v, area: ta.value } : v);
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
const dmTyping = new Map(); // threadUid -> Map(username -> timestamp)
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
  // DM + group threads keep their own typing state, shown only while open.
  const threadKey = view.type === "dm" && view.uid ? view.uid
    : view.type === "gdm" && view.thread ? gdmTypingKey(view.thread) : null;
  if (threadKey) {
    const m = dmTyping.get(threadKey);
    if (m) {
      for (const [u, t] of m) {
        if (now - t > 3500) m.delete(u);
        else if ((!profile || u !== profile.username) && !names.includes(u)) names.push(u);
      }
      if (!m.size) dmTyping.delete(threadKey);
    }
  }
  $("typing-hint").textContent = names.length === 0 ? ""
    : names.length === 1 ? `${names[0]} is typing…`
    : names.length === 2 ? `${names[0]} and ${names[1]} are typing…`
    : "Several people are typing…";
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
      notice.onclick = () => {
        window.focus();
        notice.close();
        const key = String(tag || "");
        if (key.startsWith("dm-")) openDM(key.slice(3));
        else if (key.startsWith("group-")) openGroupDM(Number(key.slice(6)));
      };
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

/* Usernames double as ledger keys (coin/item grants) and mention targets:
   colons, tabs and newlines would corrupt those formats, so they're rejected
   everywhere a username is created or changed. */
function usernameProblem(name) {
  if (!name) return "Choose a username.";
  if (name.length < 2) return "Usernames must be at least 2 characters.";
  if (name.length > 20) return "Usernames can be up to 20 characters.";
  if (/[:\t\n\r]/.test(name)) return "Usernames can't contain colons or line breaks.";
  const normalized = name.normalize("NFKD").toLowerCase()
    .replace(/0/g, "o").replace(/@/g, "a").replace(/[1!|]/g, "i").replace(/[3]/g, "e")
    .replace(/[4]/g, "a").replace(/[5$]/g, "s").replace(/[7]/g, "t")
    .replace(/[^a-z]/g, "");
  const inappropriate = ["fuck", "shit", "bitch", "cunt", "asshole", "motherfucker", "faggot", "nigger", "nigga", "retard", "whore", "slut", "pussy"];
  if (inappropriate.some((term) => normalized.includes(term))) return "That username isn't allowed. Choose a different one.";
  return null;
}

async function doAuth() {
  const username = $("auth-username").value.trim();
  const password = $("auth-password").value;
  const email = $("auth-email").value.trim().toLowerCase();
  lastEmail = email;
  if (!password) return authFail("Enter your password.");
  if (!email || !email.includes("@")) return authFail("Enter a valid email address.");
  if (authMode === "register" && !username) return authFail("Choose a username.");
  const badName = authMode === "register" ? usernameProblem(username) : null;
  if (badName) return authFail(badName);
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
  await loadBlocks();
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
    const badRecovery = usernameProblem(name);
    if (badRecovery) throw new Error(badRecovery + " Log in again with a different one.");
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
  // Auto-unequip Boost-only frames after the subscription expires.
  try {
    await loadShopItems();
    const wallet = await myWallet();
    const equipped = { ...(profile.equipped || {}) };
    const frameItem = (shopCatalog.length ? shopCatalog : FALLBACK_SHOP).find((item) => item.id === equipped.frame);
    if (frameItem && frameItem.nitro && !wallet.nitroActive) {
      delete equipped.frame;
      const { error } = await supabase.from("profiles").update({ equipped }).eq("id", profile.id);
      if (!error) {
        profile.equipped = equipped;
        const cached = users.find((user) => user.id === profile.id);
        if (cached) cached.equipped = equipped;
      }
    }
  } catch { /* cosmetic cleanup is non-fatal */ }
  rememberAccount(session.user.email, profile.username);
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
  paintUserPanelAvatar();
  const panelName = $("user-name");
  panelName.textContent = profile.username;
  const panelBadge = roleBadge(profile.role);
  if (panelBadge) panelName.appendChild(panelBadge);
  appendSpecialBadgeStrip(panelName, profile.id, { limit: 2 });
  av.style.cursor = "pointer";
  panelName.style.cursor = "pointer";
  av.onclick = () => openSelfCard();
  panelName.onclick = () => openSelfCard();
  restorePresenceMode();
  $("user-role").onclick = openPresenceMenu;
  installPresenceActivityTracking();
  startPresence();
  if (profile.role === "admin" || profile.role === "mod") $("dashboard-btn").classList.remove("hidden");
  $("gif-btn").classList.remove("hidden");
  ensureDmSub();
  ensureCallInbox();
  ensurePollSub();
  ensureEventSub();
  await loadFriendships();
  ensureFriendSub();
  ensureGroupSub();
  if (!localStorage.getItem("ping-seen-polls-friends")) {
    localStorage.setItem("ping-seen-polls-friends", "1");
    setTimeout(() => toast("New: channel polls 📊, friends 🤝, server explore 🧭 — and DM typing!", "ok"), 1500);
  }
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
  await loadMemberships();
  if (servers.length === 0) {
    // First run: seed a public home server (creator auto-joins via trigger).
    const { data: srv } = await supabase.from("servers")
      .insert({ name: "Ping Public Chat", created_by: profile.id, visibility: "public" }).select().single();
    if (srv) {
      servers = [srv];
      myMemberships.add(srv.id);
      await supabase.from("channels").insert([
        { server_id: srv.id, name: "general", topic: "Say hi 👋" },
        { server_id: srv.id, name: "rules", topic: "Be kind. Mods log activity." }
      ]);
      await logActivity("server_create", "seeded Ping Public Chat");
    }
  }
  const params = new URLSearchParams(window.location.search);
  const requestedServer = params.get("server");
  const inviteCode = params.get("code");
  const invitedServer = requestedServer && servers.find((s) => String(s.id) === requestedServer);
  if (invitedServer) {
    activeServer = invitedServer;
  } else if (requestedServer) {
    // Not visible (private, or doesn't exist): try joining via invite code.
    await joinViaInvite(requestedServer, inviteCode);
  }
  if (!activeServer || !servers.find((s) => s.id === activeServer.id))
    activeServer = servers.find((s) => s.name === "Ping Public Chat") || servers[0] || null;
  renderServerRail();
  // Boost counts load lazily so the rail paints fast; pips fill in after.
  refreshAllBoosts().catch(() => {});
  await loadChannels();
  if (invitedServer) toast("Opened " + invitedServer.name + " from your invite link.", "ok");
  else if (requestedServer && !activeServer) toast("That server invite could not be found.", "err");
  if (requestedServer) {
    try { window.history.replaceState(null, "", window.location.pathname); } catch { /* keep link */ }
  }
}

/* Join a server: public servers join directly, private ones need the invite code. */
async function joinViaInvite(serverId, code) {
  const { error } = await supabase.rpc("join_server_via_invite", {
    p_server_id: Number(serverId), p_code: code || null
  });
  if (error) {
    if (/invite/i.test(error.message)) {
      toast("This server is private — ask a member for a fresh invite link.", "err");
    } else {
      toast("Couldn't join server: " + error.message, "err");
    }
    return false;
  }
  await loadMemberships();
  const { data } = await supabase.from("servers").select("*").eq("id", Number(serverId)).single();
  if (data) {
    if (!servers.find((s) => s.id === data.id)) servers.push(data);
    activeServer = data;
    toast("Welcome to " + data.name + "!", "ok");
    return true;
  }
  await loadServers();
  return true;
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
  const total = Array.from(dmUnread.values()).reduce((sum, count) => sum + count, 0)
    + Array.from(gdmUnread.values()).reduce((sum, count) => sum + count, 0);
  badge.textContent = total > 99 ? "99+" : String(total);
  badge.classList.toggle("hidden", total === 0);
  const label = total ? "Home, " + total + " unread direct messages" : "Home";
  home.setAttribute("aria-label", label);
  home.title = total ? total + " unread direct message" + (total === 1 ? "" : "s") : "Home";
}

function renderServerRail() {
  const box = $("server-icons");
  box.innerHTML = "";
  const railButton = (s) => {
    const b = el("button", null, "server-icon");
    b.title = s.name;
    if (s.icon_color) b.style.background = s.icon_color;
    if (activeServer && s.id === activeServer.id) b.classList.add("active");
    if (s.icon_url && isSafeImg(s.icon_url)) {
      const img = document.createElement("img");
      img.src = s.icon_url;
      img.alt = "";
      img.className = "server-icon-img";
      b.appendChild(img);
    } else {
      b.appendChild(el("span", s.name.slice(0, 1).toUpperCase()));
    }
    // Boost level pip.
    const lvl = serverBoostLevel(s.id);
    if (lvl > 0) {
      const pip = el("span", "◆" + lvl, "server-boost-pip lvl" + lvl);
      b.appendChild(pip);
    }
    b.onclick = () => {
      view = { type: "channel" };
      activeServer = s;
      renderServerRail();
      loadChannels();
    };
    return b;
  };
  // Servers grouped into collapsible folders (Discord-style), ungrouped last.
  const byFolder = new Map();
  for (const s of servers) {
    const key = (s.folder || "").trim();
    if (!key) continue;
    if (!byFolder.has(key)) byFolder.set(key, []);
    byFolder.get(key).push(s);
  }
  let lastFolder = null;
  for (const s of servers) {
    const folder = (s.folder || "").trim();
    if (folder !== lastFolder && folder) {
      lastFolder = folder;
      const members = byFolder.get(folder) || [];
      const head = el("button", null, "server-folder");
      head.type = "button";
      head.appendChild(el("span", null, "server-folder-arrow"));
      head.appendChild(el("span", folder));
      head.appendChild(el("span", String(members.length), "server-folder-count"));
      head.onclick = () => {
        head.classList.toggle("open");
        head.nextElementSibling.classList.toggle("hidden");
      };
      box.appendChild(head);
      const wrap = el("div", null, "server-folder-members");
      for (const member of members) wrap.appendChild(railButton(member));
      box.appendChild(wrap);
    } else if (!folder) {
      box.appendChild(railButton(s));
    }
  }
  const home = document.querySelector("#server-rail .home");
  if (home) home.classList.toggle("active", view.type !== "channel");
  paintDmUnread();
}

/* Boosts: level thresholds 2/7/14; cached counts per server. */
const boostCounts = new Map(); // serverId -> { count, mine: ownBoosts, boosters: [uid] }
const BOOST_LEVELS = [2, 7, 14];
function serverBoostLevel(serverId) {
  const c = (boostCounts.get(serverId) || {}).count || 0;
  if (c >= BOOST_LEVELS[2]) return 3;
  if (c >= BOOST_LEVELS[1]) return 2;
  if (c >= BOOST_LEVELS[0]) return 1;
  return 0;
}
/* Progress toward the next level (null when maxed). */
function boostProgress(serverId) {
  const c = (boostCounts.get(serverId) || {}).count || 0;
  for (let i = 0; i < BOOST_LEVELS.length; i++) {
    if (c < BOOST_LEVELS[i]) {
      const prev = i === 0 ? 0 : BOOST_LEVELS[i - 1];
      return { count: c, lvl: i, nextAt: BOOST_LEVELS[i], pct: Math.round(((c - prev) / (BOOST_LEVELS[i] - prev)) * 100) };
    }
  }
  return { count: c, lvl: 3, nextAt: null, pct: 100 };
}
const BOOST_PERKS = [
  { lvl: 1, at: 2, text: "Animated server icon + more emoji slots" },
  { lvl: 2, at: 7, text: "Server banner + more sticker slots" },
  { lvl: 3, at: 14, text: "Guild tag flair + Level 3 badge" }
];
async function refreshBoosts(serverId) {
  try {
    const { data } = await supabase.from("server_boosts").select("user_id").eq("server_id", serverId);
    const rows = data || [];
    const mine = session ? rows.filter((r) => r.user_id === session.user.id).length : 0;
    boostCounts.set(serverId, { count: rows.length, mine, boosters: rows.map((r) => r.user_id) });
  } catch { boostCounts.set(serverId, { count: 0, mine: 0, boosters: [] }); }
}
/* Refresh every server's count so rail pips stay accurate. */
async function refreshAllBoosts() {
  await Promise.all(servers.map((s) => refreshBoosts(s.id)));
  renderServerRail();
}
/* Guild tag chip shown next to names inside that server (like "SP" in the mock). */
function guildTagNode(tag) {
  if (!tag) return null;
  return el("span", tag.toUpperCase().slice(0, 4), "guild-tag");
}
function applyNameplate(node, equipped) {
  const id = equipped && equipped.nameplate;
  if (!id) return node;
  const item = (shopCatalog || []).find((entry) => entry.id === id && entry.kind === "nameplate");
  const style = String((item && item.value) || id.replace(/^nameplate-/, "")).toLowerCase().replace(/[^a-z0-9-]/g, "");
  node.classList.add("nameplate", "nameplate-" + style);
  if (item && item.image_url && isSafeImg(item.image_url)) node.style.backgroundImage = `linear-gradient(90deg,rgba(20,20,24,.22),rgba(20,20,24,.38)),url("${item.image_url.replace(/"/g, "")}")`;
  return node;
}
function equippedGuildTag(equipped) {
  const serverId = equipped && equipped.guildTagServerId;
  if (serverId == null) return null;
  const server = servers.find((item) => String(item.id) === String(serverId));
  return server && server.tag ? server.tag : null;
}

/* Boost a server — boosts stack, so every boost counts (no unboosting). Active
   Ping Boost subscribers boost free, everyone else spends 100 coins each. */
async function toggleBoost(s) {
  const w = await myWallet();
  const free = w.nitroActive;
  if (!free && w.balance < 100) { toast("Boosting costs 100 coins — earn more via quests.", "err"); return; }
  const bc = boostCounts.get(s.id) || { mine: 0 };
  const yes = await showModal({
    title: "Boost " + s.name + "?",
    body: free
      ? `Free with your Ping Boost${bc.mine ? ` (you've boosted ${bc.mine}x)` : ""}. Level 1 at 2 boosts, Level 2 at 7, Level 3 at 14.`
      : `Spend 100 coins to boost this server${bc.mine ? ` (you've boosted ${bc.mine}x)` : ""}. Level 1 at 2 boosts, Level 2 at 7, Level 3 at 14. (Free with Ping Boost.)`,
    okText: "Boost"
  });
  if (yes !== true) return;
  const { error: bErr } = await supabase.from("server_boosts").insert({ server_id: s.id, user_id: session.user.id });
  if (bErr) { toast("Couldn't boost (run the v26 schema upgrade first): " + bErr.message, "err"); return; }
  if (!free) {
    const { error: lErr } = await logActivity("shop_buy", "buy:server_boost:-100");
    if (lErr) { toast("Boost saved but coin deduction failed: " + lErr.message, "err"); return; }
  }
  toast(free ? "Server boosted ◆ (free with Boost)" : "Server boosted ◆", "ok");
  await refreshBoosts(s.id);
  renderServerRail();
  await renderServerSettings();
}

async function loadChannels() {
  if (!activeServer) return;
  document.body.classList.remove("dm-home");
  $("dm-search-wrap").classList.add("hidden");
  $("extra-nav").classList.add("hidden");
  $("dm-search").value = "";
  peopleDirectoryOpen = false;
  view = { type: "channel" };
  showView("chat-view");
  paintAnnounceBtn();
  $("server-header").textContent = activeServer.name;
  $("server-header").style.cursor = "pointer";
  $("server-header").title = "Server settings";
  await refreshBoosts(activeServer.id);
  renderServerRail();
  // Boost level pip next to the server name.
  document.querySelectorAll(".server-lvl-pip").forEach((n) => n.remove());
  if (serverBoostLevel(activeServer.id) > 0) {
    const pip = el("span", "◆" + serverBoostLevel(activeServer.id), "server-lvl-pip lvl" + serverBoostLevel(activeServer.id));
    pip.title = "Boost Level " + serverBoostLevel(activeServer.id);
    $("server-header").appendChild(pip);
  }
  // Server banner (Boost Level 2+ unlocks the display).
  document.querySelectorAll(".server-banner").forEach((n) => n.remove());
  if (activeServer.banner_url && isSafeImg(activeServer.banner_url) && serverBoostLevel(activeServer.id) >= 2) {
    const banner = document.createElement("img");
    banner.src = activeServer.banner_url;
    banner.alt = "";
    banner.className = "server-banner";
    $("channel-list").before(banner);
  }
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
  loadServerEmoji();
}

async function loadMessages(focusMessageId = null) {
  const box = $("messages");
  box.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  lastRenderDay = ""; lastRenderUid = ""; lastRenderTs = 0;
  msgCache.clear();
  reactionMap.clear();
  await refreshSavedMessageIds();
  const { data, error } = await supabase.from("messages").select("*")
    .eq("channel_id", activeChannel.id).order("id", { ascending: false }).limit(100);
  if (error) {
    box.replaceChildren(el("div", "Couldn't load messages: " + error.message, "empty-note error"));
    toast("Couldn't load messages: " + error.message, "err");
    return;
  }
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
    else if (preview.startsWith("[poll:")) preview = "📊 Poll";
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

/* Discord-style right-click message menu: react, reply, edit, copy, pin, save,
   report, delete. Closed by clicking anywhere or pressing Escape. */
function openMessageMenu(x, y, m) {
  document.querySelectorAll(".msg-menu").forEach((n) => n.remove());
  const menu = el("div", null, "msg-menu");
  const item = (iconName, label, fn, danger) => {
    const b = iconBtn(iconName, "msg-menu-item" + (danger ? " danger" : ""), label);
    b.onclick = (ev) => { ev.stopPropagation(); menu.remove(); fn(); };
    menu.appendChild(b);
  };
  item("smile", "React", () => openMiniReact(m.id, rowOf(m.id)));
  item("reply", "Reply", () => startReply(m.id));
  const ownMsg = session && m.user_id === session.user.id;
  if (ownMsg && view.type === "channel" && !isAttachmentMessage(m.content)) {
    item("pencil", "Edit", () => editMessage(m));
  }
  item("clip", "Copy text", async () => {
    try { await navigator.clipboard.writeText(m.content); toast("Copied to clipboard.", "ok"); }
    catch { toast("Couldn't copy — select the text manually.", "err"); }
  });
  if (view.type === "channel") {
    const saved = savedMessageIds.has(m.id);
    item("star", saved ? "Unsave" : "Save", () => toggleSavedMessage(m, rowOf(m.id)));
  }
  if (canModerateServer() && view.type === "channel") {
    const pinState = m.pinned;
    item("pin", pinState ? "Unpin" : "Pin", async () => {
      const { data } = await supabase.from("messages").select("pinned").eq("id", m.id).maybeSingle();
      togglePin(m.id, !((data && data.pinned) || pinState));
    });
  }
  if (view.type === "channel" && !ownMsg) item("flag", "Report", () => reportMessage(m), true);
  if (ownMsg || (session && canModerateServer() && view.type === "channel")) {
    item("trash", "Delete", async () => {
      const yes = await showModal({ title: "Delete message?", body: "This can't be undone.", okText: "Delete", danger: true });
      if (yes !== true) return;
      const table = view.type === "dm" ? "dms" : view.type === "gdm" ? "dm_group_messages" : "messages";
      const { error } = await supabase.from(table).delete().eq("id", m.id);
      if (error) toast("Delete failed: " + error.message, "err");
    }, true);
  }
  document.body.appendChild(menu);
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + "px";
  setTimeout(() => {
    const close = (ev) => {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
  }, 0);
}
function rowOf(mid) {
  const row = document.querySelector(`.msg[data-mid="${mid}"]`);
  return row ? row.querySelector(".msg-act") || null : null;
}

function safeHttpsFileUrl(raw) {
  try { return new URL(raw).protocol === "https:"; } catch { return false; }
}
function spoilerMedia(content, label) {
  const wrap = el("div", null, "spoiler-media message-content");
  content.classList.add("spoiler-media-content");
  wrap.appendChild(content);
  const reveal = el("button", "SPOILER · Click to reveal", "spoiler-media-cover");
  reveal.type = "button";
  reveal.onclick = () => { wrap.classList.add("revealed"); reveal.remove(); };
  reveal.setAttribute("aria-label", "Reveal " + label);
  wrap.appendChild(reveal);
  return wrap;
}

async function appendMessage(m, live) {
  if (isBlocked(m.user_id)) return;
  if (!users.find((x) => x.id === m.user_id)) await refreshUsers(true);
  if (session && m.user_id === session.user.id) {
    const pendingIndex = pendingMessageNodes.findIndex((item) => item.content === m.content);
    if (pendingIndex >= 0) {
      pendingMessageNodes[pendingIndex].node.remove();
      pendingMessageNodes.splice(pendingIndex, 1);
    }
  }
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
  row.oncontextmenu = (ev) => { ev.preventDefault(); openMessageMenu(ev.clientX, ev.clientY, m); };
  const avWrap = profileTrigger(
    avatarNode(userName(m.user_id), userEmoji(m.user_id), userEquip(m.user_id), userAvatarUrl(m.user_id)),
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
    applyNameplate(who, eqc);
    head.appendChild(who);
    const badge = roleBadge(userRole(m.user_id));
    if (badge) head.appendChild(badge);
    appendSpecialBadgeStrip(head, m.user_id, { limit: 3 });
    const equippedTag = guildTagNode(equippedGuildTag(userEquip(m.user_id)));
    if (equippedTag) head.appendChild(equippedTag);
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
  const mediaSpoiler = body.startsWith("[spoiler]");
  if (mediaSpoiler) body = body.slice("[spoiler]".length);
  if (replyId !== null) {
    const q = msgCache.get(replyId);
    const quote = el("div", null, "reply-quote");
    quote.dataset.replyId = replyId;
    quote.appendChild(el("span", q ? "↩ @" + q.username + ":  " : "↩ (message unavailable)", "rq-who"));
    if (q) quote.appendChild(el("span", q.content.slice(0, 90), "muted"));
    main.appendChild(quote);
  }
  const pm = /^\[poll:(\d+)\]/.exec(body);
  if (pm) {
    const pc = el("div", null, "poll-card");
    pc.dataset.pollCard = pm[1];
    main.appendChild(pc);
    renderPollCard(pc, +pm[1]);
  } else if (body.startsWith("[ANN]")) {
    main.appendChild(el("div", "📢 " + body.slice(5), "announce-banner"));
  } else if (body.startsWith("[img]") && isSafeImg(body.slice(5).trim())) {
    const img = document.createElement("img");
    img.src = body.slice(5).trim();
    img.loading = "lazy";
    img.className = "chat-img message-content";
    img.alt = "shared image";
    img.onclick = () => window.open(img.src, "_blank");
    main.appendChild(mediaSpoiler ? spoilerMedia(img, "Image spoiler") : img);
  } else if (/^\[sticker:\d+\]$/.test(body)) {
    const st = serverStickers.get(+body.slice(9, -1));
    if (st && st.image_url) {
      const img = document.createElement("img");
      img.src = st.image_url;
      img.loading = "lazy";
      img.className = "chat-sticker message-content";
      img.alt = ":" + st.name + ":";
      img.title = ":" + st.name + ":";
      img.onclick = () => window.open(img.src, "_blank");
      main.appendChild(mediaSpoiler ? spoilerMedia(img, "Sticker spoiler") : img);
    } else {
      const rbody = el("div", null, "msg-body message-content");
      rbody.appendChild(richText(body));
      main.appendChild(rbody);
    }
  } else if (body.startsWith("[file]")) {
    const split = body.indexOf("|", 6);
    const encodedName = split >= 0 ? body.slice(6, split) : "file";
    const fileUrl = split >= 0 ? body.slice(split + 1) : "";
    let fileName = "file";
    try { fileName = decodeURIComponent(encodedName).slice(0, 100); } catch { /* keep fallback */ }
    if (split >= 0 && safeHttpsFileUrl(fileUrl)) {
      const link = el("a", "⬇  " + fileName, "chat-file message-content");
      link.href = fileUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      main.appendChild(mediaSpoiler ? spoilerMedia(link, "File spoiler") : link);
    } else {
      main.appendChild(el("div", "Attachment unavailable.", "muted small"));
    }
  } else {
    const rbody = el("div", null, "msg-body message-content");
    rbody.appendChild(richText(body));
    main.appendChild(rbody);
    const linkCard = buildLinkEmbed(body);
    if (linkCard) main.appendChild(linkCard);
  }
  const chips = el("div", null, "react-chips");
  main.appendChild(chips);
  paintChips(m.id, chips);
  row.appendChild(main);
  // hover actions: reply, react (channels only), delete
  const acts = el("div", null, "msg-actions");
  const replyBtn = iconBtn("reply", "msg-act", "Reply");
  replyBtn.onclick = () => startReply(m.id);
  acts.appendChild(replyBtn);
  if (view.type === "channel") {
    const isSaved = savedMessageIds.has(m.id);
    const saveBtn = iconBtn("star", "msg-act save-message", isSaved ? "Remove from saved messages" : "Save message");
    saveBtn.classList.toggle("saved", isSaved);
    saveBtn.onclick = (event) => { event.stopPropagation(); toggleSavedMessage(m, saveBtn); };
    acts.appendChild(saveBtn);
  }
  if (view.type === "channel") {
    const reactBtn = iconBtn("smile", "msg-act", "React");
    reactBtn.onclick = (ev) => { ev.stopPropagation(); openMiniReact(m.id, reactBtn); };
    acts.appendChild(reactBtn);
    if (canModerateServer()) {
      const pinBtn = iconBtn("pin", "msg-act", "Pin to channel");
      pinBtn.onclick = async () => {
        const { data } = await supabase.from("messages").select("pinned").eq("id", m.id).single();
        togglePin(m.id, !!(data && data.pinned));
      };
      acts.appendChild(pinBtn);
    }
  }
  const ownMsg = session && m.user_id === session.user.id;
  if (view.type === "channel" && !ownMsg) {
    const report = el("button", "Report", "msg-act msg-report-act");
    report.title = "Report a possible Terms of Service violation";
    report.setAttribute("aria-label", "Report this message for a possible Terms of Service violation");
    report.type = "button";
    report.onclick = (ev) => { ev.stopPropagation(); reportMessage(m); };
    acts.appendChild(report);
  }
  if (ownMsg && view.type === "channel" && !profile.is_muted && !isAttachmentMessage(m.content)) {
    const edit = iconBtn("pencil", "msg-act", "Edit message");
    edit.onclick = () => editMessage(m);
    acts.appendChild(edit);
  }
  if (ownMsg || (session && canModerateServer() && view.type === "channel")) {
    const del = iconBtn("trash", "msg-act", "Delete message");
    del.onclick = async () => {
      // DMs/groups stay private: only the sender's own can go (RLS enforces this too).
      const table = view.type === "dm" ? "dms" : view.type === "gdm" ? "dm_group_messages" : "messages";
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
      const alertsEnabled = view.type === "channel"
        ? uiSettings.channelNotifications !== "none"
        : uiSettings.dmNotifications;
      if (alertsEnabled && ownPresenceStatus() !== "dnd") playBlip();
    }
    const channelAlert = view.type === "channel" && (uiSettings.channelNotifications === "all"
      || (uiSettings.channelNotifications === "mentions" && isMention));
    if (incoming && channelAlert && (document.hidden || !document.hasFocus())) {
      const notificationBody = m.content.startsWith("[spoiler]") || m.content.includes("||")
        ? "Sent a spoiler"
        : userName(m.user_id) + ": " + body;
      showMessageNotification("New message in #" + (activeChannel ? activeChannel.name : "server"),
        notificationBody, "channel-" + (activeChannel ? activeChannel.id : ""),
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
  const pm2 = /^\[poll:(\d+)\]/.exec(body);
  if (pm2) {
    content = el("div", null, "poll-card");
    content.dataset.pollCard = pm2[1];
    renderPollCard(content, +pm2[1]);
  } else if (body.startsWith("[ANN]")) {
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
  main.querySelector(".link-embed")?.remove();
  if (!pm2 && !body.startsWith("[ANN]") && !(body.startsWith("[img]") && isSafeImg(body.slice(5).trim()))) {
    const card = buildLinkEmbed(body);
    if (card) main.appendChild(card);
  }

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
  if (!session || !profile || view.type !== "channel" || profile.is_muted || message.user_id !== session.user.id || isAttachmentMessage(message.content)) return;
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
    const item = shopItemById(parts.value);
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
    paintUserPanelAvatar();
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
      row.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}, u.avatar_url));
      const memberName = el("span", u.username, "member-name");
      applyNameplate(memberName, u.equipped || {});
      row.appendChild(memberName);
      // Role color + custom status (Discord-style).
      const roleColor = memberRoleColor(u.id);
      if (roleColor) row.querySelector(".member-name").style.color = roleColor;
      const custom = (u.custom_status || "").trim().slice(0, 60);
      if (custom) row.appendChild(el("span", custom, "member-status"));
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
    if (!profile) return;
    const now = Date.now();
    if (now - lastTypeSent < 2000) return;
    lastTypeSent = now;
    if (view.type === "dm" && view.uid && dmChannel) {
      dmChannel.send({ type: "broadcast", event: "typing", payload: { user: profile.username, thread: view.uid } });
      return;
    }
    if (view.type === "gdm" && view.thread && dmChannel) {
      dmChannel.send({ type: "broadcast", event: "typing", payload: { user: profile.username, thread: gdmTypingKey(view.thread) } });
      return;
    }
    if (!msgChannel) return;
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

  // Searchable, categorized emoji picker with a broad Unicode emoji set.
  const EMOJIS = [
    ["😀","grinning face"],["😃","smiley"],["😄","smile"],["😁","beaming"],["😆","laughing"],["😅","sweat smile"],["🤣","rofl"],["😂","tears joy"],["🙂","slight smile"],["🙃","upside down"],["😉","wink"],["😊","blush"],["😇","angel"],["🥰","hearts"],["😍","heart eyes"],["🤩","star eyes"],["😘","kiss"],["😗","kissing"],["😚","closed eyes kiss"],["😋","yummy"],["😛","tongue"],["😜","wink tongue"],["🤪","zany"],["😝","squint tongue"],["🤑","money"],["🤗","hug"],["🤭","hand over mouth"],["🫢","gasp"],["🫣","peeking"],["🤫","shush"],["🤔","thinking"],["🫡","salute"],["🤐","zipper mouth"],["🤨","raised brow"],["😐","neutral"],["😑","expressionless"],["😶","no mouth"],["🫥","dotted line"],["😏","smirk"],["😒","unamused"],["🙄","rolling eyes"],["😬","grimace"],["😮‍💨","exhale"],["🤥","lying"],["😌","relieved"],["😔","pensive"],["😪","sleepy"],["🤤","drool"],["😴","sleeping"],["😷","mask"],["🤒","thermometer"],["🤕","bandage"],["🤢","nauseated"],["🤮","vomit"],["🥵","hot"],["🥶","cold"],["🥴","woozy"],["😵","dizzy"],["🤯","exploding head"],["🤠","cowboy"],["🥳","party"],["🥸","disguise"],["😎","sunglasses"],["🤓","nerd"],["🧐","monocle"],["😕","confused"],["🫤","diagonal mouth"],["😟","worried"],["🙁","frown"],["☹️","sad"],["😮","open mouth"],["😯","hushed"],["😲","astonished"],["😳","flushed"],["🥺","pleading"],["🥹","holding back tears"],["😦","frowning open"],["😧","anguished"],["😨","fearful"],["😰","anxious sweat"],["😥","sad relieved"],["😢","cry"],["😭","sob"],["😱","scream"],["😖","confounded"],["😣","persevere"],["😞","disappointed"],["😓","downcast sweat"],["😩","weary"],["😫","tired"],["🥱","yawn"],["😤","triumph"],["😡","rage"],["😠","angry"],["🤬","cursing"],["😈","smiling horns"],["👿","angry horns"],["💀","skull"],["☠️","skull crossbones"],["💩","poop"],["🤡","clown"],["👻","ghost"],["👽","alien"],["🤖","robot"],
    ["👋","wave"],["🤚","raised back hand"],["🖐️","hand fingers"],["✋","raised hand"],["🖖","vulcan"],["🫱","right hand"],["🫲","left hand"],["🫳","palm down"],["🫴","palm up"],["👌","ok"],["🤌","pinched fingers"],["🤏","pinch"],["✌️","peace"],["🤞","crossed fingers"],["🫰","finger heart"],["🤟","love you"],["🤘","rock on"],["🤙","call me"],["👈","point left"],["👉","point right"],["👆","point up"],["👇","point down"],["☝️","index up"],["👍","thumbs up"],["👎","thumbs down"],["✊","fist"],["👊","punch"],["🤛","left fist"],["🤜","right fist"],["👏","clap"],["🙌","raised hands"],["🫶","heart hands"],["🤲","palms up"],["🙏","pray"],["✍️","writing"],["💅","nail polish"],["💪","muscle"],["🦾","mechanical arm"],["🦿","mechanical leg"],["🦵","leg"],["🦶","foot"],["👂","ear"],["🦻","hearing aid"],["👃","nose"],["🧠","brain"],["🫀","anatomical heart"],["🫁","lungs"],["🦷","tooth"],["🦴","bone"],["👀","eyes"],["👁️","eye"],["👅","tongue"],["👄","mouth"],
    ["❤️","red heart"],["🧡","orange heart"],["💛","yellow heart"],["💚","green heart"],["💙","blue heart"],["🩵","light blue heart"],["💜","purple heart"],["🖤","black heart"],["🩶","grey heart"],["🤍","white heart"],["🤎","brown heart"],["💔","broken heart"],["❤️‍🔥","heart on fire"],["❤️‍🩹","mending heart"],["💕","two hearts"],["💞","revolving hearts"],["💓","beating heart"],["💗","growing heart"],["💖","sparkling heart"],["💘","heart arrow"],["💝","heart ribbon"],["💟","heart decoration"],["💌","love letter"],["💋","kiss mark"],["💯","hundred"],["💢","anger"],["💥","collision"],["💫","dizzy star"],["💦","sweat droplets"],["💨","dash"],["🕳️","hole"],["💬","speech"],["👁️‍🗨️","eye speech"],["🗯️","anger bubble"],["💭","thought"],["💤","zzz"],["🔥","fire"],["✨","sparkles"],["🌟","glowing star"],["⭐","star"],["🌈","rainbow"],["☀️","sun"],["🌙","moon"],["⚡","lightning"],["☁️","cloud"],["❄️","snowflake"],["🎉","party popper"],["🎊","confetti"],["🎈","balloon"],["🎁","gift"],["🎀","ribbon"],["🏆","trophy"],["🥇","gold medal"],["✅","check"],["❌","cross"],["❓","question"],["❗","exclamation"],["💡","idea"],["🔔","bell"],["🎵","music note"],["🎶","music notes"],["🎮","video game"],["🎯","target"],["🚀","rocket"],["🛸","ufo"],["📸","camera"],["💎","gem"],["👑","crown"],
    ["🐶","dog"],["🐱","cat"],["🐭","mouse"],["🐹","hamster"],["🐰","rabbit"],["🦊","fox"],["🐻","bear"],["🐼","panda"],["🐨","koala"],["🐯","tiger"],["🦁","lion"],["🐮","cow"],["🐷","pig"],["🐸","frog"],["🐵","monkey"],["🙈","see no evil"],["🙉","hear no evil"],["🙊","speak no evil"],["🐔","chicken"],["🐧","penguin"],["🐦","bird"],["🐤","chick"],["🦆","duck"],["🦅","eagle"],["🦉","owl"],["🦇","bat"],["🐺","wolf"],["🐗","boar"],["🐴","horse"],["🦄","unicorn"],["🐝","bee"],["🪱","worm"],["🦋","butterfly"],["🐌","snail"],["🐞","ladybug"],["🐜","ant"],["🪰","fly"],["🕷️","spider"],["🦂","scorpion"],["🐢","turtle"],["🐍","snake"],["🦎","lizard"],["🦖","trex"],["🦕","sauropod"],["🐙","octopus"],["🦑","squid"],["🦐","shrimp"],["🦀","crab"],["🐠","tropical fish"],["🐟","fish"],["🐬","dolphin"],["🐳","whale"],["🦈","shark"],["🐊","crocodile"],["🐅","tiger"],["🐆","leopard"],["🦓","zebra"],["🦍","gorilla"],["🦧","orangutan"],["🐘","elephant"],["🦛","hippo"],["🦏","rhino"],["🐪","camel"],["🦒","giraffe"],["🦬","bison"],["🐄","cow"],["🐎","horse"],["🐖","pig"],["🐑","sheep"],["🐐","goat"],["🦌","deer"],["🐕","dog"],["🐈","cat"],["🐓","rooster"],["🦃","turkey"],["🦚","peacock"],["🦜","parrot"],["🦢","swan"],["🦩","flamingo"],["🕊️","dove"],["🐇","bunny"],["🦝","raccoon"],["🦨","skunk"],["🦦","otter"],["🦥","sloth"],["🐁","rat"],["🐿️","chipmunk"],["🦔","hedgehog"],
    ["🍏","green apple"],["🍎","apple"],["🍐","pear"],["🍊","orange"],["🍋","lemon"],["🍌","banana"],["🍉","watermelon"],["🍇","grapes"],["🍓","strawberry"],["🫐","blueberries"],["🍈","melon"],["🍒","cherries"],["🍑","peach"],["🥭","mango"],["🍍","pineapple"],["🥥","coconut"],["🥝","kiwi"],["🍅","tomato"],["🍆","eggplant"],["🥑","avocado"],["🥦","broccoli"],["🥬","leafy green"],["🥒","cucumber"],["🌶️","pepper"],["🌽","corn"],["🥕","carrot"],["🧄","garlic"],["🧅","onion"],["🥔","potato"],["🍞","bread"],["🥐","croissant"],["🥨","pretzel"],["🧀","cheese"],["🥚","egg"],["🍳","cooking"],["🧇","waffle"],["🥞","pancakes"],["🧈","butter"],["🍗","poultry"],["🍖","meat"],["🌭","hot dog"],["🍔","burger"],["🍟","fries"],["🍕","pizza"],["🫓","flatbread"],["🥪","sandwich"],["🥙","stuffed flatbread"],["🧆","falafel"],["🌮","taco"],["🌯","burrito"],["🫔","tamale"],["🥗","salad"],["🍝","spaghetti"],["🍜","ramen"],["🍲","pot"],["🍛","curry"],["🍣","sushi"],["🍱","bento"],["🥟","dumpling"],["🍤","shrimp"],["🍙","rice ball"],["🍚","rice"],["🍦","ice cream"],["🍧","shaved ice"],["🍨","ice cream"],["🍩","donut"],["🍪","cookie"],["🎂","cake"],["🍰","shortcake"],["🧁","cupcake"],["🍫","chocolate"],["🍿","popcorn"],["☕","coffee"],["🧋","bubble tea"],["🥤","cup straw"],["🍺","beer"],["🍻","cheers"],["🥂","clink"],["🍷","wine"],["🍸","cocktail"],["🍹","tropical drink"],
    ["⚽","soccer"],["🏀","basketball"],["🏈","football"],["⚾","baseball"],["🥎","softball"],["🎾","tennis"],["🏐","volleyball"],["🏉","rugby"],["🥏","frisbee"],["🎱","billiards"],["🏓","ping pong"],["🏸","badminton"],["🥅","goal net"],["🏒","hockey"],["🏑","field hockey"],["🥍","lacrosse"],["🏏","cricket"],["🪃","boomerang"],["🥊","boxing"],["🥋","martial arts"],["⛳","golf"],["⛸️","skating"],["🎣","fishing"],["🤿","diving"],["🎿","ski"],["🛷","sled"],["🥌","curling"],["🎯","bullseye"],["🪁","kite"],["🎮","controller"],["🕹️","joystick"],["🎲","dice"],["🧩","puzzle"],["♟️","chess"],["🎨","art"],["🎭","theater"],["🎤","microphone"],["🎧","headphones"],["🎼","music"],["🎹","piano"],["🥁","drum"],["🎷","saxophone"],["🎸","guitar"],["🎻","violin"],["🎬","clapper"],["🎟️","ticket"],["🎪","circus"],["🚗","car"],["🚕","taxi"],["🚌","bus"],["🚎","trolleybus"],["🏎️","race car"],["🚓","police car"],["🚑","ambulance"],["🚒","fire engine"],["🚚","truck"],["🚲","bicycle"],["🛵","scooter"],["🏍️","motorcycle"],["✈️","airplane"],["🛫","departures"],["🛬","arrivals"],["🚀","rocket"],["🛸","ufo"],["🚢","ship"],["⚓","anchor"],["🏠","house"],["🏢","office"],["🏫","school"],["🏥","hospital"],["🏰","castle"],["🗽","statue liberty"],["🗼","tokyo tower"],["🌋","volcano"],["🏖️","beach"],["🏝️","island"],["🌃","night city"],["🌉","bridge"],["🌌","milky way"],["🌠","shooting star"],["🌍","earth"],["🌎","earth americas"],["🌏","earth asia"],["🌕","full moon"],["🌑","new moon"],["🌞","sun face"],["☄️","comet"],["🔥","fire"],["💧","droplet"],["🌊","wave"],["☂️","umbrella"],["⚡","high voltage"],["❄️","snowflake"],["☃️","snowman"],["🌪️","tornado"],["🌫️","fog"],["🌈","rainbow"],["☀️","sunny"],["☁️","cloudy"],["⛅","partly cloudy"],["🌧️","rain"],["⛈️","thunderstorm"],["🌩️","lightning"],["🌨️","snow"],["🌬️","wind"],["🌀","cyclone"]
  ];
  const pk = $("emoji-picker");
  const emojiGrid = $("emoji-grid");
  const emojiSearch = $("emoji-search");
  const renderEmojiGrid = () => {
    const query = (emojiSearch.value || "").trim().toLowerCase();
    emojiGrid.replaceChildren();
    for (const [emoji, name] of EMOJIS) {
      if (query && !name.includes(query) && !emoji.includes(query)) continue;
      const s = el("button", emoji, "em emoji-choice");
      s.type = "button";
      s.title = name;
      s.onclick = () => {
        const inp = $("message-input");
        inp.value += emoji;
        inp.focus();
      };
      emojiGrid.appendChild(s);
    }
  };
  renderEmojiGrid();
  emojiSearch.oninput = renderEmojiGrid;
  const serverEmoteBox = el("div", null, "server-emote-box hidden");
  pk.appendChild(serverEmoteBox);
  $("emoji-btn").onclick = (ev) => { ev.stopPropagation(); pk.classList.toggle("hidden"); };
  $("sticker-btn").onclick = (ev) => {
    ev.stopPropagation();
    pk.classList.remove("hidden");
    serverEmoteBox.classList.remove("hidden");
    if (!serverEmoteBox.children.length) serverEmoteBox.appendChild(el("div", view.type === "channel" ? "No stickers in this server yet." : "Join a server to browse its stickers.", "muted small"));
    serverEmoteBox.scrollIntoView({ block: "nearest" });
  };
  document.addEventListener("click", (e) => {
    if (!pk.classList.contains("hidden") && !pk.contains(e.target) && e.target.id !== "emoji-btn" && e.target.id !== "sticker-btn")
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
  $("gif-btn").classList.remove("hidden");
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
    const safeText = spoilerNextMessage ? text.slice(0, 496) : text;
    const messageText = spoilerNextMessage ? `||${safeText}||` : safeText;
    const content = replyTo ? `[↩${replyTo.id}] ${messageText}` : messageText;
    if (view.type === "dm") {
      if (!view.uid) { toast("Pick a conversation first.", "err"); return; }
      const stored = content.slice(0, 500);
      const pending = addPendingMessage(stored);
      const { error } = await supabase.from("dms").insert({
        sender_id: session.user.id, receiver_id: view.uid, content: stored
      });
      if (error) { removePendingMessage(pending); toast("Couldn't send: " + error.message, "err"); }
      else {
        confirmPendingMessage(pending);
        input.value = "";
        spoilerNextMessage = false;
        $("spoiler-btn").classList.remove("active");
        $("spoiler-btn").setAttribute("aria-pressed", "false");
        replyTo = null;
        $("reply-bar").classList.add("hidden");
      }
      return;
    }
    if (view.type === "gdm") {
      if (!view.thread) { toast("Pick a group first.", "err"); return; }
      const stored = content.slice(0, 500);
      const pending = addPendingMessage(stored);
      const { error } = await supabase.from("dm_group_messages").insert({
        thread_id: view.thread, sender_id: session.user.id, content: stored
      });
      if (error) { removePendingMessage(pending); toast("Couldn't send: " + error.message, "err"); }
      else {
        confirmPendingMessage(pending);
        input.value = "";
        spoilerNextMessage = false;
        $("spoiler-btn").classList.remove("active");
        $("spoiler-btn").setAttribute("aria-pressed", "false");
        replyTo = null;
        $("reply-bar").classList.add("hidden");
      }
      return;
    }
    if (!activeChannel) return;
    if (profile.is_muted) {
      input.value = "";
      input.placeholder = "You are muted.";
      return;
    }
    if (activeServer && !isMember(activeServer.id) && profile.role !== "admin" && profile.role !== "mod") {
      toast("Join this server first — open it from Explore or use an invite link.", "err");
      return;
    }
    const stored = content.slice(0, 500);
    const pending = addPendingMessage(stored);
    const { error } = await supabase.from("messages").insert({
      channel_id: activeChannel.id, user_id: session.user.id, content: stored
    });
    if (error) { removePendingMessage(pending); toast("Couldn't send: " + error.message, "err"); }
    else {
      confirmPendingMessage(pending);
      input.value = "";
      spoilerNextMessage = false;
      $("spoiler-btn").classList.remove("active");
      $("spoiler-btn").setAttribute("aria-pressed", "false");
      replyTo = null;
      $("reply-bar").classList.add("hidden");
      $("emoji-picker").classList.add("hidden");
    }
  };

  $("add-server-btn").onclick = async () => {
    const name = await showModal({ title: "Create server", body: "New servers are private — invite people with a link.", input: true, placeholder: "Server name", okText: "Create" });
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

  // pins, search, polls, events, uploads
  $("pins-btn").onclick = showPinsRich;
  $("polls-btn").onclick = createPollModal;
  $("events-btn").onclick = openEvents;
  $("saved-btn").onclick = openSavedMessages;
  const callBtn = $("call-btn");
  if (callBtn) callBtn.onclick = () => startDmCall();
  const giftBtn = $("gift-btn");
  if (giftBtn) giftBtn.onclick = () => giftCoinsFlow();
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
    if (f.size > 5 * 1024 * 1024) { toast("Max 5 MB.", "err"); return; }
    toast("Uploading…");
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const path = `${session.user.id}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, f);
      if (error) throw error;
      const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      if (f.type.startsWith("image/")) await sendImageMessage(data.publicUrl);
      else {
        const prefix = spoilerNextMessage ? "[spoiler]" : "";
        await sendMessageContent(`${prefix}[file]${encodeURIComponent(f.name.slice(0, 48))}|${data.publicUrl}`, "file");
      }
    } catch (err) {
      toast("Upload failed: " + storageErrorMessage(err), "err");
    }
  });

  // voice controls
  paintStaticChrome();
  paintCallBtn();
  $("spoiler-btn").onclick = () => {
    spoilerNextMessage = !spoilerNextMessage;
    $("spoiler-btn").classList.toggle("active", spoilerNextMessage);
    $("spoiler-btn").setAttribute("aria-pressed", String(spoilerNextMessage));
    $("spoiler-btn").title = spoilerNextMessage ? "Spoiler mode is on" : "Mark next message as spoiler";
    toast(spoilerNextMessage ? "Spoiler mode on for the next message." : "Spoiler mode off.");
  };
  $("voice-input-select").onchange = () => selectVoiceInput($("voice-input-select").value);
  $("voice-output-select").onchange = () => selectVoiceOutput($("voice-output-select").value);
  $("voice-share").onclick = toggleScreenShare;
  $("voice-fullscreen").onclick = toggleVoiceFullscreen;
  $("voice-dock-return").onclick = () => showView("voice-view");
  $("voice-dock-hangup").onclick = () => leaveVoice(false);
  $("screen-mini-return").onclick = () => showView("voice-view");
  $("screen-mini-stop").onclick = closeScreenMini;
  $("voice-mute").onclick = async () => {
    voiceMuted = !voiceMuted;
    if (localStream) for (const t of localStream.getAudioTracks()) t.enabled = !voiceMuted;
    await updateVoicePresence();
    paintVoiceButtons();
  };
  $("voice-deafen").onclick = async () => {
    voiceDeaf = !voiceDeaf;
    for (const [, e] of voicePcs) if (e.audio) e.audio.muted = voiceDeaf;
    await updateVoicePresence();
    paintVoiceButtons();
  };
  $("voice-leave").onclick = () => leaveVoice(false);

  $("logout-btn").onclick = async () => {    await logActivity("logout", "");
    clearInterval(heartbeat);
    if (msgChannel) await supabase.removeChannel(msgChannel);
    if (dmChannel) await supabase.removeChannel(dmChannel);
    if (callInboxChannel) { await supabase.removeChannel(callInboxChannel); callInboxChannel = null; }
    if (typeof gdmChannel !== "undefined" && gdmChannel) await supabase.removeChannel(gdmChannel);
    if (pollSub) await supabase.removeChannel(pollSub);
    pollSub = null;
    if (eventSub) await supabase.removeChannel(eventSub);
    eventSub = null;
    pollSub = null;
    if (friendSub) await supabase.removeChannel(friendSub);
    friendSub = null;
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
  $("explore-btn").onclick = openExplore;
  $("server-header").onclick = () => {
  if (!activeServer || view.type !== "channel") { loadServerStickers(); return; }
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
    const discoveryCategoryLabel = el("label", "Discover category");
    const discoveryCategory = el("select");
    for (const [value, label] of [["Gaming", "Gaming"], ["Music", "Music"], ["Entertainment", "Entertainment"], ["Science & Tech", "Science & Tech"], ["Education", "Education"], ["Community", "Community"]]) {
      const option = el("option", label); option.value = value; discoveryCategory.appendChild(option);
    }
    discoveryCategory.value = s.discovery_category || "Community";
    discoveryCategoryLabel.appendChild(discoveryCategory);
    const colorLabel = el("label", "Server icon color");
    const color = el("input"); color.type = "color"; color.value = /^#[\da-f]{6}$/i.test(s.icon_color || "") ? s.icon_color : "#5865f2"; colorLabel.append(color);
    const iconLabel = el("label", "Server icon image URL (https, png/jpg/gif/webp)");
    const iconUrl = el("input"); iconUrl.value = s.icon_url || ""; iconUrl.placeholder = "https://…"; iconUrl.maxLength = 300; iconLabel.append(iconUrl);
    const bannerLabel = el("label", "Server banner image URL (recommended 1200×400, max 3 MB; Boost Level 2+ display)");
    const bannerUrl = el("input"); bannerUrl.value = s.banner_url || ""; bannerUrl.placeholder = "https://…"; bannerUrl.maxLength = 300; bannerLabel.append(bannerUrl);
    const bannerUp = el("button", "Upload banner image", "btn-secondary");
    bannerUp.type = "button";
    bannerUp.onclick = () => {
      const pick = document.createElement("input");
      pick.type = "file";
      pick.accept = "image/*";
      pick.onchange = async () => {
        const f = pick.files[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) { toast("Only image files work as banners.", "err"); return; }
        if (f.size > 3 * 1024 * 1024) { toast("Max 3 MB.", "err"); return; }
        bannerUp.disabled = true;
        bannerUp.textContent = "Uploading…";
        try {
          const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40) || "banner";
          const path = `server-banners/${s.id}/${Date.now()}_${safe}`;
          const { error } = await supabase.storage.from("chat-uploads").upload(path, f);
          if (error) throw error;
          const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
          bannerUrl.value = data.publicUrl;
          toast("Banner uploaded — hit Save changes to apply.", "ok");
        } catch (err) {
          toast("Upload failed: " + storageErrorMessage(err), "err");
        } finally {
          bannerUp.disabled = false;
          bannerUp.textContent = "Upload banner image";
        }
      };
      pick.click();
    };
    bannerLabel.append(bannerUp);
    const tagLabel = el("label", "Guild tag (2–4 letters, shown next to names like SP)");
    const tagIn = el("input"); tagIn.value = s.tag || ""; tagIn.maxLength = 4; tagIn.placeholder = "SP"; tagLabel.append(tagIn);
    const folderLabel = el("label", "Server folder (groups servers in the rail)");
    const folderIn = el("input"); folderIn.value = s.folder || ""; folderIn.maxLength = 24; folderIn.placeholder = "e.g. Games"; folderLabel.append(folderIn);
    const save = el("button", "Save changes", "btn-primary"); save.type = "submit";
    form.append(nameLabel, descLabel, discoveryCategoryLabel, colorLabel, iconLabel, bannerLabel, tagLabel, folderLabel, save);
    form.onsubmit = async (event) => {
      event.preventDefault();
      const nextName = name.value.trim();
      if (!nextName) { toast("Server name cannot be empty.", "err"); return; }
      const nextTag = tagIn.value.trim().toUpperCase().slice(0, 4);
      if (nextTag && !/^[A-Z0-9]{2,4}$/.test(nextTag)) { toast("Tag must be 2–4 letters/numbers.", "err"); return; }
      if (nextTag && nextTag !== (s.tag || "") && serverBoostLevel(s.id) < 3) { toast("Guild tags unlock at Boost Level 3 (14 boosts).", "err"); return; }
      const nextFolder = folderIn.value.trim().slice(0, 24);
      const nextIcon = iconUrl.value.trim().slice(0, 300);
      if (nextIcon && !isSafeImg(nextIcon)) { toast("Icon must be an https image URL.", "err"); return; }
      if (/\.gif(\?|#|$)/i.test(nextIcon) && serverBoostLevel(s.id) < 1) { toast("Animated icons unlock at Boost Level 1 (2 boosts).", "err"); return; }
      const nextBanner = bannerUrl.value.trim().slice(0, 300);
      if (nextBanner && !isSafeImg(nextBanner)) { toast("Banner must be an https image URL.", "err"); return; }
      const { error } = await supabase.from("servers").update({ name: nextName.slice(0, 40), description: description.value.trim().slice(0, 240), discovery_category: discoveryCategory.value, icon_color: color.value, icon_url: nextIcon || null, banner_url: nextBanner || null, tag: nextTag || null, folder: nextFolder || null }).eq("id", s.id);
      if (error) { toast("Couldn't save server settings. Apply the v24 schema upgrade first.", "err"); return; }
      s.name = nextName.slice(0, 40); s.description = description.value.trim().slice(0, 240); s.discovery_category = discoveryCategory.value; s.icon_color = color.value;
      s.icon_url = nextIcon || null; s.banner_url = nextBanner || null; s.tag = nextTag || null; s.folder = nextFolder || null;
      await loadServers(); await renderServerSettings(); toast("Server settings saved.", "ok");
    };
    section.append(form);
    // Boosts.
    const boostSec = el("div", null, "server-privacy");
    const bc = boostCounts.get(s.id) || { count: 0, mine: 0, boosters: [] };
    const prog = boostProgress(s.id);
    boostSec.append(el("h3", `Server Boosts · Level ${prog.lvl}`));
    const bar = el("div", null, "boost-bar");
    const fill = el("div", null, "boost-fill lvl" + Math.max(prog.lvl, 1));
    fill.style.width = prog.pct + "%";
    bar.appendChild(fill);
    boostSec.append(bar);
    boostSec.append(el("div",
      prog.nextAt
        ? `${prog.count} boost${prog.count === 1 ? "" : "s"} · ${prog.nextAt - prog.count} more to Level ${prog.lvl + 1}`
        : `${prog.count} boosts · max Level 3!`,
      "muted small"));
    for (const perk of BOOST_PERKS) {
      const row = el("div", null, "boost-perk" + (prog.lvl >= perk.lvl ? " on" : ""));
      row.appendChild(el("span", prog.lvl >= perk.lvl ? "◆" : "◇", "boost-perk-mark"));
      row.appendChild(el("span", `Level ${perk.lvl} (${perk.at} boosts) — ${perk.text}`));
      boostSec.appendChild(row);
    }
    if ((bc.boosters || []).length) {
      const names = bc.boosters
        .map((id) => (users.find((x) => x.id === id) || {}).username)
        .filter(Boolean).slice(0, 12);
      if (names.length) boostSec.append(el("div", "Boosted by " + names.join(", "), "muted small"));
    }
    const boostBtn = el("button", bc.mine > 0 ? `Boost again ◆ (you've boosted ${bc.mine}x)` : "Boost this server (100 coins · free with Ping Boost)", "btn-primary");
    boostBtn.type = "button";
    boostBtn.onclick = () => toggleBoost(s);
    boostSec.append(boostBtn);
    section.append(boostSec);
    // Privacy, invites, membership.
    const priv = el("div", null, "server-privacy");
    priv.append(el("h3", "Privacy & invites"));
    const vis = el("div", null, "server-vis-row");
    vis.append(el("span", null, "server-vis-label"));
    vis.firstChild.textContent = "Visibility: " + (s.visibility === "private" ? "🔒 Invite-only" : "🌐 Public");
    const flip = el("button", s.visibility === "private" ? "Make public" : "Make private", "btn-secondary");
    flip.type = "button";
    flip.onclick = async () => {
      const next = s.visibility === "private" ? "public" : "private";
      const { error } = await supabase.from("servers").update({ visibility: next }).eq("id", s.id);
      if (error) { toast("Couldn't change visibility: " + error.message, "err"); return; }
      s.visibility = next;
      await loadServers();
      await renderServerSettings();
      toast("Server is now " + (next === "private" ? "invite-only." : "public."), "ok");
    };
    vis.append(flip);
    priv.append(vis);
    const invRow = el("div", null, "server-vis-row");
    const invBtn = el("button", "Copy invite link", "btn-secondary"); invBtn.type = "button";
    invBtn.onclick = copyServerInvite;
    invRow.append(invBtn);
    const regen = el("button", "New invite code", "btn-secondary"); regen.type = "button";
    regen.title = "Invalidates old invite links";
    regen.onclick = async () => {
      const yes = await showModal({ title: "New invite code?", body: "Old invite links will stop working.", okText: "Regenerate", danger: true });
      if (yes !== true) return;
      const { data, error } = await supabase.from("servers")
        .update({ invite_code: crypto.randomUUID() }).eq("id", s.id).select("invite_code").single();
      if (error) { toast("Couldn't regenerate: " + error.message, "err"); return; }
      s.invite_code = data.invite_code;
      toast("New invite code created. Copy a fresh link to share.", "ok");
    };
    invRow.append(regen);
    priv.append(invRow);
    const leave = el("button", "Leave server", "btn-secondary"); leave.type = "button";
    leave.onclick = async () => {
      const yes = await showModal({ title: "Leave " + s.name + "?", body: "You'll need a new invite to come back.", okText: "Leave", danger: true });
      if (yes !== true) return;
      const { error } = await supabase.from("server_members").delete().eq("server_id", s.id).eq("user_id", session.user.id);
      if (error) { toast("Couldn't leave: " + error.message, "err"); return; }
      myMemberships.delete(s.id);
      activeServer = null; activeChannel = null;
      await loadServers();
      if (!activeServer) enterHome();
      else showView("chat-view");
    };
    priv.append(leave);
    // AutoMod word filter (database-enforced on every message insert).
    const amTitle = el("h3", "AutoMod");
    amTitle.style.margin = "12px 0 4px";
    priv.append(amTitle);
    priv.append(el("div", "Blocked words, one per line. Matching messages are rejected for everyone (DMs excluded).", "muted small"));
    const amBox = el("textarea", null, "automod-box");
    amBox.rows = 3;
    amBox.maxLength = 1000;
    amBox.placeholder = "spam\nscam\nhttp://bad.example";
    priv.append(amBox);
    const amSave = el("button", "Save filters", "btn-secondary");
    amSave.type = "button";
    amSave.style.marginTop = "6px";
    amSave.onclick = async () => {
      const words = amBox.value.split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean).slice(0, 100);
      const { error: selErr, data: existing } = await supabase.from("server_settings").select("server_id").eq("server_id", s.id).maybeSingle();
      if (selErr) { toast("Couldn't load filters: " + selErr.message, "err"); return; }
      const { error } = existing
        ? await supabase.from("server_settings").update({ blocked_words: words }).eq("server_id", s.id)
        : await supabase.from("server_settings").insert({ server_id: s.id, blocked_words: words });
      if (error) { toast("Couldn't save filters: " + error.message, "err"); return; }
      toast(words.length ? `AutoMod watching ${words.length} word${words.length === 1 ? "" : "s"}.` : "AutoMod cleared.", "ok");
    };
    priv.append(amSave);
    supabase.from("server_settings").select("blocked_words").eq("server_id", s.id).maybeSingle()
      .then(({ data }) => { if (data && amBox.isConnected) amBox.value = (data.blocked_words || []).join("\n"); });
    section.append(priv);
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
  const { error } = await supabase.rpc("delete_server", { p_server_id: s.id });
  if (error) { toast("Delete failed: " + error.message, "err"); return; }
  activeServer = null; activeChannel = null; await loadServers(); if (!activeServer) enterHome();
}

async function copyServerInvite() {
  if (!activeServer) return;
  const invite = new URL(window.location.href);
  invite.search = "";
  invite.hash = "";
  invite.searchParams.set("server", String(activeServer.id));
  if (activeServer.invite_code) invite.searchParams.set("code", activeServer.invite_code);
  const link = invite.toString();
  const note = activeServer.visibility === "private"
    ? "Private server: only people with this link can join."
    : "Public server: anyone with the link (or from Explore) can join.";
  try {
    await navigator.clipboard.writeText(link);
    toast("Invite link copied. " + note, "ok");
  } catch {
    await showModal({
      title: "Invite to " + activeServer.name,
      body: note,
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
const PROFILE_BANNERS = [
  ["", "None"],
  ["linear-gradient(135deg,#5865f2,#9b59b6)", "Blurple"],
  ["linear-gradient(135deg,#00aff4,#005577)", "Ocean"],
  ["linear-gradient(135deg,#ed4245,#fee75c)", "Sunset"],
  ["linear-gradient(135deg,#2ea043,#0a2e1a)", "Forest"],
  ["linear-gradient(135deg,#2b2d31,#111214)", "Mono"],
  ["linear-gradient(135deg,#eb459e,#5865f2)", "Candy"]
];
/* Translate raw Supabase storage errors into actionable messages. */
function storageErrorMessage(err) {
  const m = String((err && err.message) || err);
  if (/bucket not found/i.test(m))
    return "Upload storage isn't set up — re-run supabase-schema.sql, then try again.";
  if (/row-level security|permission denied|not authorized|unauthorized/i.test(m))
    return "Upload blocked by database permissions — re-run supabase-schema.sql, then try again.";
  if (/too large|maximum|exceeded/i.test(m)) return "That file is too large for the bucket.";
  return m;
}
function buildProfileEditorFields(container, { intro = true, includeAvatar = true, initial = null } = {}) {
  if (intro) container.appendChild(el("p", "Your username, avatar, status, and About Me are visible to other members.", "profile-editor-intro"));
  // Discord-style sidebar: User Profile | Decoration | Banner.
  const shell = el("div", null, "editor-shell");
  const side = el("div", null, "editor-side");
  const main = el("div", null, "editor-main");
  shell.append(side, main);
  container.appendChild(shell);
  const panelProfile = el("div", null, "editor-panel");
  const panelDeco = el("div", null, "editor-panel");
  const panelBanner = el("div", null, "editor-panel");
  main.append(panelProfile, panelDeco, panelBanner);
  let activePanel = "profile";
  const renderPanels = () => {
    panelProfile.classList.toggle("hidden", activePanel !== "profile");
    panelDeco.classList.toggle("hidden", activePanel !== "deco");
    panelBanner.classList.toggle("hidden", activePanel !== "banner");
  };
  const renderSide = () => {
    side.replaceChildren();
    for (const [key, label] of [["profile", "User Profile"], ["deco", "Decoration"], ["banner", "Banner"]]) {
      const b = el("button", label, "editor-nav" + (activePanel === key ? " active" : ""));
      b.type = "button";
      b.onclick = () => { activePanel = key; renderSide(); renderPanels(); };
      side.appendChild(b);
    }
  };
  renderSide();
  renderPanels();
  const field = (labelText, value, maxLength, placeholder) => {
    const label = el("label", null, "profile-editor-field");
    label.appendChild(el("span", labelText));
    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.maxLength = maxLength;
    input.placeholder = placeholder;
    label.appendChild(input);
    panelProfile.appendChild(label);
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
  panelProfile.appendChild(statusTools);
  const bioLabel = el("label", null, "profile-editor-field");
  bioLabel.appendChild(el("span", "About Me"));
  const bio = document.createElement("textarea");
  bio.value = initial ? (initial.bio || "") : (profile.bio || "");
  bio.maxLength = 240;
  bio.rows = 4;
  bio.placeholder = "A little about you";
  bioLabel.appendChild(bio);
  panelProfile.appendChild(bioLabel);

  let selectedAvatar = initial ? (initial.avatar || "") : (profile.avatar_emoji || "");
  let selectedAvatarUrl = (profile && profile.avatar_url) || "";
  if (includeAvatar) {
    panelProfile.appendChild(el("div", "Profile picture", "profile-editor-subtitle"));
    // Custom picture upload (images incl. GIFs for Boost, max 3 MB).
    const uploadRow = el("div", null, "avatar-upload-row");
    const uploadPreview = el("span", null, "avatar-upload-preview");
    const renderUploadPreview = () => {
      uploadPreview.replaceChildren();
      if (selectedAvatarUrl && isSafeImg(selectedAvatarUrl)) {
        const img = document.createElement("img");
        img.src = selectedAvatarUrl;
        img.alt = "Avatar preview";
        uploadPreview.appendChild(img);
      } else {
        uploadPreview.appendChild(el("span", "No picture uploaded.", "muted small"));
      }
    };
    renderUploadPreview();
    const uploadBtn = el("button", "Upload picture", "btn-secondary");
    uploadBtn.type = "button";
    uploadBtn.onclick = () => {
      const pick = document.createElement("input");
      pick.type = "file";
      pick.accept = "image/*";
      pick.onchange = async () => {
        const f = pick.files[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) { toast("Only image files work as avatars.", "err"); return; }
        if (f.size > 3 * 1024 * 1024) { toast("Max 3 MB.", "err"); return; }
        const isGif = f.type === "image/gif" || /\.gif$/i.test(f.name);
        if (isGif) {
          try {
            const w = await myWallet();
            if (!w.nitroActive) { toast("Animated GIF avatars need Boost.", "err"); return; }
          } catch {
            toast("Couldn't verify Boost status. Try again.", "err");
            return;
          }
        }
        uploadBtn.disabled = true;
        uploadBtn.textContent = "Uploading…";
        try {
          const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40) || "avatar";
          const path = `avatars/${session.user.id}/${Date.now()}_${safe}`;
          const { error } = await supabase.storage.from("chat-uploads").upload(path, f);
          if (error) throw error;
          const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
          selectedAvatarUrl = data.publicUrl;
          selectedAvatar = "";
          renderUploadPreview();
          // Apply immediately (Discord-style) so closing without Save still works.
          try {
            const { error: saveErr } = await supabase.from("profiles")
              .update({ avatar_url: selectedAvatarUrl }).eq("id", session.user.id);
            if (saveErr) throw saveErr;
            profile.avatar_url = selectedAvatarUrl;
            const u = users.find((x) => x.id === profile.id);
            if (u) u.avatar_url = selectedAvatarUrl;
            paintUserPanelAvatar();
            refreshUsers(true);
            toast("Profile picture updated.", "ok");
          } catch (applyErr) {
            toast("Uploaded, but couldn't apply it: " + storageErrorMessage(applyErr), "err");
          }
        } catch (err) {
          toast("Upload failed: " + storageErrorMessage(err), "err");
        } finally {
          uploadBtn.disabled = false;
          uploadBtn.textContent = "Upload picture";
        }
      };
      pick.click();
    };
    const removeBtn = el("button", "Remove", "btn-secondary");
    removeBtn.type = "button";
    removeBtn.onclick = () => {
      selectedAvatarUrl = "";
      renderUploadPreview();
    };
    const resetBtn = el("button", "Reset avatar", "btn-secondary");
    resetBtn.type = "button";
    resetBtn.title = "Back to your initial letter";
    resetBtn.onclick = () => {
      selectedAvatarUrl = "";
      selectedAvatar = "";
      renderUploadPreview();
    };
    const adjustBtn = el("button", "Adjust crop", "btn-secondary");
    adjustBtn.type = "button";
    adjustBtn.title = "Zoom and reposition your picture (Discord-style)";
    adjustBtn.onclick = () => {
      if (!selectedAvatarUrl || !isSafeImg(selectedAvatarUrl)) {
        toast("Upload a picture first.", "err");
        return;
      }
      openAvatarCrop(selectedAvatarUrl);
    };
    uploadRow.append(uploadPreview, uploadBtn, adjustBtn, removeBtn, resetBtn);
    panelProfile.appendChild(uploadRow);
  }
  let selectedBanner = (profile && profile.equipped && profile.equipped.banner) || "";
  let customBannerUrl = selectedBanner && /^https?:/i.test(selectedBanner) ? selectedBanner : "";
  let selectedBannerItemId = (profile && profile.equipped && profile.equipped.bannerItem) || "";
  let ownedBannerItems = [];
  panelBanner.appendChild(el("div", "Banner color · custom banners recommended 1200×400 PNG/JPG/GIF/WebP, max 3 MB", "profile-editor-subtitle"));
  const bannerChoices = el("div", null, "profile-banner-choices");
  const renderBannerChoices = () => {
    bannerChoices.replaceChildren();
    for (const [value, label] of PROFILE_BANNERS) {
      const selected = !selectedBannerItemId && selectedBanner === value;
      const button = el("button", label, "banner-choice" + (selected ? " selected" : ""));
      button.type = "button";
      if (value) button.style.background = value;
      button.title = value ? "Use " + label : "No banner";
      button.setAttribute("aria-pressed", String(selected));
      button.onclick = () => { selectedBanner = value; selectedBannerItemId = ""; customBannerUrl = ""; renderBannerChoices(); renderCustomBanner(); };
      bannerChoices.appendChild(button);
    }
    for (const item of ownedBannerItems) {
      const button = el("button", item.name, "banner-choice" + (selectedBannerItemId === item.id ? " selected" : ""));
      button.type = "button"; button.title = item.description || item.name;
      if (item.image_url && isSafeImg(item.image_url)) button.style.backgroundImage = `linear-gradient(transparent,rgba(0,0,0,.3)),url("${item.image_url.replace(/"/g, "")}")`;
      button.setAttribute("aria-pressed", String(selectedBannerItemId === item.id));
      button.onclick = () => { selectedBanner = item.image_url || ""; selectedBannerItemId = item.id; customBannerUrl = item.image_url || ""; renderBannerChoices(); renderCustomBanner(); };
      bannerChoices.appendChild(button);
    }
  };
  renderBannerChoices();
  panelBanner.appendChild(bannerChoices);
  // Custom banner image (Boost only).
  const customBannerRow = el("div", null, "avatar-upload-row");
  const customBannerPreview = el("span", null, "banner-upload-preview");
  const renderCustomBanner = () => {
    customBannerPreview.replaceChildren();
    if (customBannerUrl && isSafeImg(customBannerUrl)) {
      const img = document.createElement("img");
      img.src = customBannerUrl;
      img.alt = "Banner preview";
      customBannerPreview.appendChild(img);
    } else {
      customBannerPreview.appendChild(el("span", "No custom banner.", "muted small"));
    }
  };
  renderCustomBanner();
  (async () => {
    try {
      await loadShopItems();
      const wallet = await myWallet();
      ownedBannerItems = (shopCatalog || []).filter((item) => item.kind === "banner" && item.image_url && wallet.owned.has(item.id));
      renderBannerChoices();
    } catch { /* banner catalog is optional */ }
  })();
  const bannerUploadBtn = el("button", "Upload banner", "btn-secondary");
  bannerUploadBtn.type = "button";
  bannerUploadBtn.title = "Boost only";
  bannerUploadBtn.onclick = () => {
    const pick = document.createElement("input");
    pick.type = "file";
    pick.accept = "image/*";
    pick.onchange = async () => {
      const f = pick.files[0];
      if (!f) return;
      if (!f.type.startsWith("image/")) { toast("Only image files work as banners.", "err"); return; }
      if (f.size > 3 * 1024 * 1024) { toast("Max 3 MB.", "err"); return; }
      try {
        const w = await myWallet();
        if (!w.nitroActive) { toast("Custom banners need Boost.", "err"); return; }
      } catch {
        toast("Couldn't verify Boost status. Try again.", "err");
        return;
      }
      bannerUploadBtn.disabled = true;
      bannerUploadBtn.textContent = "Uploading…";
      try {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40) || "banner";
        const path = `banners/${session.user.id}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage.from("chat-uploads").upload(path, f);
        if (error) throw error;
        const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
        customBannerUrl = data.publicUrl;
        selectedBanner = data.publicUrl;
        selectedBannerItemId = "";
        renderBannerChoices();
        renderCustomBanner();
        toast("Banner uploaded — hit Save changes to apply.", "ok");
      } catch (err) {
        toast("Upload failed: " + storageErrorMessage(err), "err");
      } finally {
        bannerUploadBtn.disabled = false;
        bannerUploadBtn.textContent = "Upload banner";
      }
    };
    pick.click();
  };
  customBannerRow.append(customBannerPreview, bannerUploadBtn);
  panelBanner.appendChild(customBannerRow);
  // Decoration panel: equip frames you own (rainbow-class frames need Boost).
  panelDeco.appendChild(el("div", "Avatar decoration", "profile-editor-subtitle"));
  const decoList = el("div", null, "profile-deco-list");
  decoList.appendChild(el("span", "Loading owned frames…", "muted small"));
  panelDeco.appendChild(decoList);
  renderOwnedFrames();
  async function renderOwnedFrames() {
    let wallet = null;
    try { wallet = await myWallet(); } catch { /* shop unavailable */ }
    decoList.replaceChildren();
    const catalog = (shopCatalog.length ? shopCatalog : FALLBACK_SHOP).filter((i) => i.kind === "frame");
    const owned = wallet ? wallet.owned : new Set();
    const current = (profile.equipped && profile.equipped.frame) || "";
    const none = el("button", "None", "banner-choice" + (!current ? " selected" : ""));
    none.type = "button";
    none.onclick = () => setFrameChoice("");
    decoList.appendChild(none);
    let any = false;
    for (const item of catalog) {
      if (!owned.has(item.id) && !(profile.equipped && profile.equipped.frame === item.id)) continue;
      any = true;
      const b = el("button", item.name, "banner-choice deco-frame" + (current === item.id ? " selected" : ""));
      b.type = "button";
      b.title = item.desc || item.name;
      b.onclick = () => setFrameChoice(item.id);
      decoList.appendChild(b);
    }
    if (!any) decoList.appendChild(el("span", "No frames yet — visit the Shop.", "muted small"));
    decoList.appendChild(el("div", "More frames live in the Shop.", "muted small"));
    async function setFrameChoice(frameId) {
      const eq = { ...(profile.equipped || {}) };
      if (frameId) eq.frame = frameId;
      else delete eq.frame;
      // Boost-only frames need an active Boost subscription.
      if (frameId) {
        const w = await myWallet();
        const item = (shopCatalog.length ? shopCatalog : FALLBACK_SHOP).find((i) => i.id === frameId);
        if (item && item.nitro && !w.nitroActive) { toast("That frame needs an active Boost subscription.", "err"); return; }
      }
      const { error } = await supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id);
      if (error) { toast("Couldn't equip frame: " + error.message, "err"); return; }
      profile.equipped = eq;
      const u = users.find((x) => x.id === profile.id);
      if (u) u.equipped = eq;
      paintUserPanelAvatar();
      refreshUsers(true);
      renderOwnedFrames();
      toast(frameId ? "Frame equipped." : "Frame removed.", "ok");
    }
  }
  panelDeco.appendChild(el("div", "Name color", "profile-editor-subtitle"));
  const colorPreview = el("div", profile.username || "you", "profile-color-preview");
  const applyColorPreview = () => {
    colorPreview.textContent = (username && username.value.trim()) || profile.username || "you";
    colorPreview.style.color = selectedColor || "";
  };
  if (username) username.oninput = () => applyColorPreview();
  panelDeco.appendChild(colorPreview);
  const colorList = el("div", null, "profile-deco-list");
  colorList.appendChild(el("span", "Loading owned colors…", "muted small"));
  panelDeco.appendChild(colorList);
  let selectedColor = (profile.equipped && profile.equipped.color) || "";
  renderOwnedColors();
  async function renderOwnedColors() {
    let wallet = null;
    try { wallet = await myWallet(); } catch { /* shop unavailable */ }
    colorList.replaceChildren();
    const catalog = (shopCatalog.length ? shopCatalog : FALLBACK_SHOP).filter((i) => i.kind === "color" && i.value);
    const owned = wallet ? wallet.owned : new Set();
    const none = el("button", "Default", "banner-choice" + (!selectedColor ? " selected" : ""));
    none.type = "button";
    none.onclick = () => setColorChoice("");
    colorList.appendChild(none);
    let any = false;
    for (const item of catalog) {
      if (!owned.has(item.id) && selectedColor !== item.value) continue;
      any = true;
      const b = el("button", item.name, "banner-choice" + (selectedColor === item.value ? " selected" : ""));
      b.type = "button";
      b.title = item.desc || item.name;
      b.style.color = item.value;
      b.onclick = () => setColorChoice(item.value);
      colorList.appendChild(b);
    }
    if (!any) colorList.appendChild(el("span", "No colors yet — visit the Shop.", "muted small"));
    applyColorPreview();
    async function setColorChoice(value) {
      const eq = { ...(profile.equipped || {}) };
      if (value) eq.color = value;
      else delete eq.color;
      const { error } = await supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id);
      if (error) { toast("Couldn't equip color: " + error.message, "err"); return; }
      profile.equipped = eq;
      selectedColor = value;
      const u = users.find((x) => x.id === profile.id);
      if (u) u.equipped = eq;
      refreshUsers(true);
      renderOwnedColors();
      toast(value ? "Name color equipped." : "Name color removed.", "ok");
    }
  }
  // Profile effects: equip an animated aura from the Shop.
  panelDeco.appendChild(el("div", "Profile effect", "profile-editor-subtitle"));
  const effectList = el("div", null, "profile-deco-list");
  panelDeco.appendChild(effectList);
  let effectCatalog = [];
  const renderEffectChoices = async () => {
    await loadShopItems();
    effectCatalog = (shopCatalog.length ? shopCatalog : FALLBACK_SHOP).filter((i) => i.kind === "effect");
    effectList.replaceChildren();
    let owned = new Set();
    try { owned = (await myWallet()).owned; } catch { /* shop unavailable */ }
    const noneB = el("button", "None", "banner-choice" + (!(profile.equipped && profile.equipped.effect) ? " selected" : ""));
    noneB.type = "button";
    noneB.onclick = () => setEffectChoice("");
    effectList.appendChild(noneB);
    let any = false;
    for (const item of effectCatalog) {
      if (!owned.has(item.id) && (profile.equipped || {}).effect !== item.id) continue;
      any = true;
      const b = el("button", item.name, "banner-choice" + ((profile.equipped || {}).effect === item.id ? " selected" : ""));
      b.type = "button";
      b.title = item.desc || item.name;
      b.onclick = () => setEffectChoice(item.id);
      effectList.appendChild(b);
    }
    if (!any) effectList.appendChild(el("span", "No effects yet — visit the Shop to buy one.", "muted small"));
  };
  renderEffectChoices();
  async function setEffectChoice(value) {
    const eq = { ...(profile.equipped || {}) };
    if (value) eq.effect = value;
    else delete eq.effect;
    if (value) {
      const w = await myWallet();
      const item = effectCatalog.find((i) => i.id === value);
      if (item && item.nitro && !w.nitroActive) { toast("That effect needs an active Boost subscription.", "err"); return; }
    }
    const { error } = await supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id);
    if (error) { toast("Couldn't equip effect: " + error.message, "err"); return; }
    profile.equipped = eq;
    const u = users.find((x) => x.id === profile.id);
    if (u) u.equipped = eq;
    refreshUsers(true);
    renderEffectChoices();
    toast(value ? "Profile effect equipped." : "Profile effect removed.", "ok");
  }
  // One profile guild tag at a time; choose from servers this account joined.
  panelDeco.appendChild(el("div", "Guild tag", "profile-editor-subtitle"));
  panelDeco.appendChild(el("div", "Choose one server tag to show beside your name across Ping.", "muted small"));
  const guildTagSelect = el("select", null, "profile-guild-tag-select");
  const noTag = el("option", "No guild tag");
  noTag.value = "";
  guildTagSelect.appendChild(noTag);
  const taggedServers = servers.filter((server) => myMemberships.has(server.id) && server.tag);
  for (const server of taggedServers) {
    const option = el("option", `${server.tag} · ${server.name}`);
    option.value = String(server.id);
    guildTagSelect.appendChild(option);
  }
  const equippedTagServerId = (profile.equipped || {}).guildTagServerId;
  guildTagSelect.value = equippedTagServerId == null ? "" : String(equippedTagServerId);
  guildTagSelect.disabled = !taggedServers.length;
  guildTagSelect.onchange = async () => {
    const eq = { ...(profile.equipped || {}) };
    if (guildTagSelect.value) eq.guildTagServerId = Number(guildTagSelect.value);
    else delete eq.guildTagServerId;
    const { error } = await supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id);
    if (error) { toast("Couldn't equip guild tag: " + error.message, "err"); return; }
    profile.equipped = eq;
    const cached = users.find((user) => user.id === profile.id);
    if (cached) cached.equipped = eq;
    refreshUsers(true);
    toast(eq.guildTagServerId ? "Guild tag equipped." : "Guild tag removed.", "ok");
  };
  panelDeco.appendChild(guildTagSelect);
  if (!taggedServers.length) panelDeco.appendChild(el("div", "Join a server with a configured guild tag to equip it. Server tags unlock at Boost Level 3.", "muted small"));
  panelDeco.appendChild(el("div", "Profile nameplate", "profile-editor-subtitle"));
  panelDeco.appendChild(el("div", "A colorful name banner shown beside your name in chat.", "muted small"));
  const nameplateList = el("div", null, "profile-deco-list");
  panelDeco.appendChild(nameplateList);
  const renderNameplates = async () => {
    await loadShopItems();
    let owned = new Set();
    try { owned = (await myWallet()).owned; } catch { /* shop unavailable */ }
    nameplateList.replaceChildren();
    const none = el("button", "None", "banner-choice" + (!(profile.equipped || {}).nameplate ? " selected" : ""));
    none.type = "button";
    none.onclick = () => equipNameplate("");
    nameplateList.appendChild(none);
    const items = (shopCatalog || []).filter((item) => item.kind === "nameplate" && owned.has(item.id));
    if (!items.length) nameplateList.appendChild(el("span", "Buy nameplates in Shop → Nameplates.", "muted small"));
    for (const item of items) {
      const button = el("button", item.name, "banner-choice" + (((profile.equipped || {}).nameplate === item.id) ? " selected" : ""));
      button.type = "button";
      button.onclick = () => equipNameplate(item.id);
      nameplateList.appendChild(button);
    }
  };
  async function equipNameplate(id) {
    const equipped = { ...(profile.equipped || {}) };
    if (id) equipped.nameplate = id;
    else delete equipped.nameplate;
    const { error } = await supabase.from("profiles").update({ equipped }).eq("id", profile.id);
    if (error) { toast("Couldn't equip nameplate: " + error.message, "err"); return; }
    profile.equipped = equipped;
    const cached = users.find((user) => user.id === profile.id);
    if (cached) cached.equipped = equipped;
    refreshUsers(true);
    renderNameplates();
    toast(id ? "Nameplate equipped." : "Nameplate removed.", "ok");
  }
  renderNameplates();
  return {
    username, status, bio,
    getAvatar: () => selectedAvatar,
    setAvatar: (value) => { selectedAvatar = value || ""; },
    getBanner: () => selectedBanner,
    getBannerItem: () => selectedBannerItemId,
    getAvatarUrl: () => selectedAvatarUrl
  };
}
async function saveOwnProfileFields(fields) {
  const nextName = fields.username.value.trim();
  const nameError = usernameProblem(nextName);
  if (nameError) return { error: nameError, field: "username" };
  if (nextName.toLowerCase() !== profile.username.toLowerCase()) {
    const { data: names, error: namesError } = await supabase.from("profiles").select("id,username");
    if (namesError) return { error: "Couldn't check whether that username is available." };
    const duplicate = (names || []).some((member) =>
      member.id !== profile.id && member.username.toLowerCase() === nextName.toLowerCase());
    if (duplicate) return { error: "That username is already taken.", field: "username" };
  }
  const equipped = { ...(profile.equipped || {}), banner: fields.getBanner ? (fields.getBanner() || "") : ((profile.equipped || {}).banner || "") };
  if (fields.getBannerItem && fields.getBannerItem()) equipped.bannerItem = fields.getBannerItem();
  else if (!equipped.banner || equipped.banner !== (profile.equipped || {}).banner) delete equipped.bannerItem;
  const updates = {
    username: nextName,
    custom_status: fields.status.value.trim().slice(0, 60),
    bio: fields.bio.value.trim().slice(0, 240),
    avatar_emoji: fields.getAvatar() || null,
    avatar_url: fields.getAvatarUrl && fields.getAvatarUrl() ? fields.getAvatarUrl() : null,
    equipped
  };
  try {
    const { data, error } = await supabase.from("profiles").update(updates).eq("id", profile.id).select("*").single();
    if (error) {
      const duplicate = /duplicate/i.test(error.message);
      return { error: duplicate
        ? "That username is already taken."
        : "Couldn't save your profile: " + error.message, field: duplicate ? "username" : "" };
    }
    profile = data;
    paintUserPanelAvatar();
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
  $("announce-btn").classList.toggle("hidden", !(canMod() && inChannel));
  $("pins-btn").classList.toggle("hidden", !inChannel);
  $("search-btn").classList.toggle("hidden", !inChannel);
  $("polls-btn").classList.toggle("hidden", !inChannel);
  $("events-btn").classList.toggle("hidden", !inChannel);
  paintCallBtn();
  if (!inChannel) {
    $("search-bar").classList.add("hidden");
    $("search-results").classList.add("hidden");
  }
}
/* Call button: DMs and group DMs get a voice call via the same WebRTC mesh,
   keyed on a synthetic channel id (presence names are arbitrary strings). */
function paintCallBtn() {
  const btn = $("call-btn");
  if (!btn) return;
  const inDm = (view.type === "dm" && view.uid) || (view.type === "gdm" && view.thread);
  btn.classList.toggle("hidden", !inDm);
}
async function startDmCall() {
  if (view.type === "dm" && view.uid) {
    const u = users.find((x) => x.id === view.uid);
    const name = u ? u.username : "unknown";
    const pair = [session.user.id, view.uid].sort().join("-");
    const room = "dm-" + pair;
    await sendCallInvite(view.uid, room, "Call from " + profile.username);
    await joinVoice({ id: room, name: "Call with " + name });
  } else if (view.type === "gdm" && view.thread) {
    const room = "gdm-" + view.thread;
    const { data } = await supabase.from("dm_group_members").select("user_id").eq("thread_id", view.thread);
    for (const member of data || []) {
      if (member.user_id !== session.user.id) await sendCallInvite(member.user_id, room, profile.username + " started a group call");
    }
    await joinVoice({ id: room, name: "Group call" });
  }
}

function addPendingMessage(content) {
  const box = $("messages");
  const row = el("div", null, "msg pending-message");
  row.appendChild(avatarNode(profile.username, profile.avatar_emoji, profile.equipped || {}, profile.avatar_url));
  const main = el("div", null, "pending-message-main");
  main.appendChild(el("span", profile.username, "msg-user"));
  const body = el("div", null, "msg-body");
  body.appendChild(richText(content));
  main.appendChild(body);
  main.appendChild(el("span", "Sending…", "pending-indicator"));
  row.appendChild(main);
  pendingMessageNodes.push({ content, node: row });
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
  return row;
}
function removePendingMessage(node) {
  node.remove();
  const index = pendingMessageNodes.findIndex((item) => item.node === node);
  if (index >= 0) pendingMessageNodes.splice(index, 1);
}
function confirmPendingMessage(node) {
  if (!node || !node.isConnected) return;
  node.classList.add("pending-confirmed");
  const label = node.querySelector(".pending-indicator");
  if (label) label.textContent = "Sent";
  setTimeout(() => removePendingMessage(node), 1400);
}

function isAttachmentMessage(content) {
  const value = String(content || "").replace(/^\[↩\d+\] /, "").replace(/^\[spoiler\]/, "");
  return value.startsWith("[img]") || value.startsWith("[file]") || /^\[sticker:\d+\]$/.test(value);
}
function ensureCallInbox() {
  if (callInboxChannel || !session || !supabase) return;
  callInboxChannel = supabase.channel("call-inbox-" + session.user.id)
    .on("broadcast", { event: "invite" }, async ({ payload }) => {
      if (!payload || payload.from === session.user.id || Date.now() - Number(payload.at || 0) > 60000) return;
      showMessageNotification("Incoming Ping call", payload.name || "Someone is calling you", "call-" + payload.room, { toastWhenVisible: true });
      const answer = await showModal({
        title: "Incoming Ping call",
        body: payload.name || "Someone is calling you.",
        okText: "Ignore",
        extra: [{ label: "Accept call", value: "accept" }]
      });
      if (answer === "accept") await joinVoice({ id: payload.room, name: "Call with " + (payload.name || "friend") });
    })
    .subscribe();
}
async function sendCallInvite(uid, room, name) {
  try {
    const channel = supabase.channel("call-inbox-" + uid);
    await new Promise((resolve) => channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve();
    }));
    await channel.send({ type: "broadcast", event: "invite", payload: { from: session.user.id, room, name, at: Date.now() } });
    await supabase.removeChannel(channel);
  } catch { toast("Couldn't send the call invite.", "err"); }
}

async function tenorSearch(q) {
  const key = ENV.TENOR_API_KEY;
  if (key) {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q || "hello")}&key=${key}&limit=12&media_filter=gif`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("GIF search request failed");
    const j = await r.json();
    return (j.results || []).map((x) => x.media_formats && x.media_formats.gif && x.media_formats.gif.url).filter(Boolean);
  }
  // Giphy's public demo key keeps local/dev builds usable without extra setup.
  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(q || "hello")}&limit=16&rating=pg`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("GIF search unavailable");
    const result = await response.json();
    const gifs = (result.data || []).map((item) => item.images && item.images.fixed_height && item.images.fixed_height.url).filter(Boolean);
    if (gifs.length) return gifs;
  } catch { /* curated fallback below */ }
  return [
    "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
    "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif"
  ];
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
  await sendImageMessage(url);
}

/* ---------------- coins economy (ledger on activity_log, no server needed) ---------------- */
/* Shop catalog: database-driven (admins manage it), static fallback if the
   v21 table isn't there yet. Row shape is normalized to the fallback shape. */
const FALLBACK_SHOP = [
  { id: "frame-violet", kind: "frame", name: "Violet Ring", desc: "Purple avatar ring", cost: 50 },
  { id: "frame-cyan", kind: "frame", name: "Cyan Ring", desc: "Cool cyan avatar ring", cost: 80 },
  { id: "frame-pixel", kind: "frame", name: "Pixel Corners", desc: "Retro corner brackets", cost: 120 },
  { id: "frame-gold", kind: "frame", name: "Gold Ring", desc: "Shiny gold avatar ring", cost: 150 },
  { id: "frame-rose", kind: "frame", name: "Rose Aura", desc: "Soft pink glowing ring · Boost exclusive", cost: 220, nitro: true },
  { id: "frame-rainbow", kind: "frame", name: "Rainbow Flow", desc: "Animated rainbow ring · Boost exclusive", cost: 400, nitro: true },
  { id: "color-gold", kind: "color", name: "Gold Name", desc: "Gold username color", cost: 200, value: "#fee75c" },
  { id: "color-pink", kind: "color", name: "Pink Name", desc: "Pink username color", cost: 200, value: "#eb459e" },
  { id: "color-mint", kind: "color", name: "Mint Name", desc: "Mint username color", cost: 200, value: "#57f287" },
  { id: "color-sky", kind: "color", name: "Sky Name", desc: "Sky-blue username color", cost: 150, value: "#00aff4" },
  { id: "color-coral", kind: "color", name: "Coral Name", desc: "Warm coral username color", cost: 150, value: "#ff7f50" },
  { id: "boost", kind: "boost", name: "Ping Boost · 30 days", desc: "Animated glow avatar + exclusive frame access", cost: 500 }
];
/* Live catalog from the shop_items table (v21); static fallback otherwise. */
let shopCatalog = [];
async function loadShopItems() {
  try {
    const { data, error } = await supabase.from("shop_items").select("*").eq("active", true).order("cost");
    if (error) throw error;
    // Prefer the rebranded 'boost' row over the legacy 'nitro' row when both exist.
    const rows = (data || []).map((r) => ({
      id: r.id, kind: r.kind === "nitro" ? "boost" : r.kind, name: r.name, desc: r.description || "",
      cost: r.cost, value: r.value || null, nitro: !!r.nitro_required, image_url: r.image_url || null
    })).filter((r, _, arr) => r.id !== "nitro" || !arr.some((x) => x.id === "boost"));
    if (rows.length) {
      shopCatalog = rows;
      return rows;
    }
  } catch { /* fall through to static catalog */ }
  shopCatalog = FALLBACK_SHOP;
  return shopCatalog;
}
function shopItemById(id) {
  const list = shopCatalog.length ? shopCatalog : FALLBACK_SHOP;
  return list.find((entry) => entry.id.toLowerCase() === String(id).toLowerCase()) || null;
}
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
      .like("detail", `grant:${escapeLike(profile.username)}:%`).limit(200),
    supabase.from("activity_log").select("action,detail,created_at").eq("action", "item_grant")
      .like("detail", `item:${escapeLike(profile.username)}:%`).limit(200)
  ]);
  let balance = 0;
  const owned = new Set(), claimsToday = new Set();
  let nitroUntil = 0, nitroBuys = 0;
  const today = todayISO();
  const eat = (action, detail, created) => {
    let m;
    if (action === "quest_claim" && (m = /quest:([^:]+):\+(\d+)/.exec(detail))) {
      balance += +m[2];
      if (String(created).slice(0, 10) === today) claimsToday.add(m[1]);
    } else if (action === "shop_buy" && (m = /buy:([^:]+):-(\d+)/.exec(detail))) {
      balance -= +m[2];
      owned.add(m[1]);
      if (m[1] === "nitro" || m[1] === "boost") { nitroUntil = Math.max(nitroUntil, Date.parse(created) + 30 * 864e5); nitroBuys++; }
      if (m[1] === "nitro_basic" || m[1] === "boost_basic") { nitroUntil = Math.max(nitroUntil, Date.parse(created) + 7 * 864e5); nitroBuys++; }
    } else if (action === "coin_grant" && (m = /grant:[^:]+:\+(\d+)/.exec(detail))) {
      balance += +m[1];
    } else if (action === "coin_gift_send" && (m = /gift:[^:]+:-(\d+)/.exec(detail))) {
      balance -= +m[1];
    } else if (action === "item_grant" && (m = /^item:[^:]+:([^:]+)$/.exec(detail))) {
      if (m[1] === "nitro" || m[1] === "boost") { nitroUntil = Math.max(nitroUntil, Date.parse(created) + 30 * 864e5); nitroBuys++; }
      else if (m[1] === "nitro_basic" || m[1] === "boost_basic") { nitroUntil = Math.max(nitroUntil, Date.parse(created) + 7 * 864e5); nitroBuys++; }
      else owned.add(m[1]);
    }
  };
  for (const r of (own.data || []).filter((r) => r.action !== "coin_grant")) eat(r.action, r.detail, r.created_at);
  for (const r of grants.data || []) eat(r.action, r.detail, r.created_at);
  for (const r of itemGrants.data || []) eat(r.action, r.detail, r.created_at);
  if (session) nitroTiers.set(session.user.id, nitroTierForBuys(nitroBuys));
  return { balance, owned, claimsToday, nitroUntil, nitroActive: nitroUntil > Date.now(), nitroBuys };
}

/* Evolving Boost badge tiers by lifetime Boost purchases (original artwork,
   Discord-inspired winged medallion). Others show tier 0 — we can't see why
   someone else's badge evolved, only that it's active. */
const NITRO_TIERS = [
  { name: "Bronze Boost", ring: ["#f0a35e", "#8c5a2b"], wing: "#cd7f32" },
  { name: "Silver Boost", ring: ["#eef1f6", "#8f96a3"], wing: "#c0c0c0" },
  { name: "Gold Boost", ring: ["#ffe98a", "#c9a227"], wing: "#ffd75e" },
  { name: "Platinum Boost", ring: ["#a8e6ff", "#4d9fd1"], wing: "#7dd3fc" },
  { name: "Diamond Boost", ring: ["#d9c6ff", "#8b5cf6"], wing: "#c4b5fd" },
  { name: "Emerald Boost", ring: ["#7df0b8", "#0f9d6c"], wing: "#34d399" },
  { name: "Ruby Boost", ring: ["#ff8fa3", "#c9184a"], wing: "#ff4d6d" },
  { name: "Sapphire Boost", ring: ["#90e0ff", "#1d4ed8"], wing: "#48bfe3" },
  { name: "Void Boost", ring: ["#c77dff", "#3c096c"], wing: "#9d4edd" },
  { name: "Prismatic Boost", ring: ["#f0abfc", "#6366f1"], wing: "#e879f9" }
];
const NITRO_TIER_AT = [1, 2, 3, 5, 8, 12, 16, 21, 27, 35];
const nitroTiers = new Map(); // uid -> tier index
function nitroTierForBuys(n) {
  let tier = 0;
  for (let i = 0; i < NITRO_TIER_AT.length; i++) if (n >= NITRO_TIER_AT[i]) tier = i;
  return tier;
}
/* Next rank info for progress display (null when maxed). */
function nitroNextTier(buys) {
  for (let i = 0; i < NITRO_TIER_AT.length; i++) {
    if (buys < NITRO_TIER_AT[i]) return { tier: i, at: NITRO_TIER_AT[i] };
  }
  return null;
}
let nitroBadgeSeq = 0;
function nitroBadgeNode(tier) {
  const idx = Math.min(Math.max(0, tier | 0), NITRO_TIERS.length - 1);
  const T = NITRO_TIERS[idx];
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("class", "nitro-badge-svg tier" + idx);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", T.name);
  const gid = "nitro-grad-" + (nitroBadgeSeq++);
  const defs = document.createElementNS(NS, "defs");
  const grad = document.createElementNS(NS, "linearGradient");
  grad.setAttribute("id", gid);
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "1");
  grad.setAttribute("y2", "1");
  const stops = [["0", T.ring[0]], ["1", T.ring[1]]];
  for (const [off, col] of stops) {
    const stop = document.createElementNS(NS, "stop");
    stop.setAttribute("offset", off);
    stop.setAttribute("stop-color", col);
    // Top rank shimmers.
    if (idx === NITRO_TIERS.length - 1) {
      const anim = document.createElementNS(NS, "animate");
      anim.setAttribute("attributeName", "stop-color");
      anim.setAttribute("values", col + ";" + T.wing + ";" + col);
      anim.setAttribute("dur", "3s");
      anim.setAttribute("repeatCount", "indefinite");
      stop.appendChild(anim);
    }
    grad.appendChild(stop);
  }
  defs.appendChild(grad);
  svg.appendChild(defs);
  // Notched outer ring: 12 rounded ticks.
  for (let i = 0; i < 12; i++) {
    const tick = document.createElementNS(NS, "rect");
    tick.setAttribute("x", "22.4");
    tick.setAttribute("y", "2.6");
    tick.setAttribute("width", "3.2");
    tick.setAttribute("height", "5.4");
    tick.setAttribute("rx", "1.6");
    tick.setAttribute("fill", `url(#${gid})`);
    tick.setAttribute("transform", `rotate(${i * 30} 24 24)`);
    svg.appendChild(tick);
  }
  // Orbit ring for Diamond and up, slowly rotating.
  if (idx >= 4) {
    const orbit = document.createElementNS(NS, "circle");
    orbit.setAttribute("cx", "24");
    orbit.setAttribute("cy", "24");
    orbit.setAttribute("r", "20.5");
    orbit.setAttribute("fill", "none");
    orbit.setAttribute("stroke", T.wing);
    orbit.setAttribute("stroke-width", "1.4");
    orbit.setAttribute("stroke-dasharray", "4 5");
    orbit.setAttribute("opacity", "0.85");
    const spin = document.createElementNS(NS, "animateTransform");
    spin.setAttribute("attributeName", "transform");
    spin.setAttribute("type", "rotate");
    spin.setAttribute("from", "0 24 24");
    spin.setAttribute("to", "360 24 24");
    spin.setAttribute("dur", "14s");
    spin.setAttribute("repeatCount", "indefinite");
    orbit.appendChild(spin);
    svg.appendChild(orbit);
  }
  // Feathered wings: three slim blades fanning out on each side.
  const blades = [
    [9.5, 18.5, 7.2, 2.1, -24, 0.95],
    [8.2, 24.0, 7.4, 2.1, -8, 0.8],
    [8.4, 29.5, 6.2, 2.0, 8, 0.65]
  ];
  for (const [cx, cy, rx, ry, rot, op] of blades) {
    for (const side of [1, -1]) {
      const e = document.createElementNS(NS, "ellipse");
      e.setAttribute("cx", side === 1 ? cx : 48 - cx);
      e.setAttribute("cy", cy);
      e.setAttribute("rx", rx);
      e.setAttribute("ry", ry);
      e.setAttribute("transform", `rotate(${side === 1 ? rot : -rot} ${side === 1 ? cx : 48 - cx} ${cy})`);
      e.setAttribute("fill", T.wing);
      e.setAttribute("opacity", String(op));
      svg.appendChild(e);
    }
  }
  // Inner medallion.
  const disc = document.createElementNS(NS, "circle");
  disc.setAttribute("cx", "24");
  disc.setAttribute("cy", "24");
  disc.setAttribute("r", "10.2");
  disc.setAttribute("fill", "#141519");
  disc.setAttribute("stroke", `url(#${gid})`);
  disc.setAttribute("stroke-width", "1.6");
  svg.appendChild(disc);
  // Center mark evolves with rank: bolt, then star, then crown.
  const mark = document.createElementNS(NS, "polygon");
  if (idx >= NITRO_TIERS.length - 1) {
    mark.setAttribute("points", "16.5,30.5 16.5,21.5 20,24.8 24,18.5 28,24.8 31.5,21.5 31.5,30.5");
  } else if (idx >= 6) {
    mark.setAttribute("points", "24,15.5 26.6,21.3 32.8,21.8 27.9,25.9 29.3,32 24,28.8 18.7,32 20.1,25.9 15.2,21.8 21.4,21.3");
  } else {
    mark.setAttribute("points", "26.6,15.5 19.2,26.2 22.7,26.2 21.2,32.8 28.9,22.6 25.4,22.6");
  }
  mark.setAttribute("fill", "#ffffff");
  mark.setAttribute("opacity", "0.95");
  svg.appendChild(mark);
  return svg;
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
  const wordleWins = rows.filter((x) => x.game_id === "wordle" && x.result === "win").length;
  const minesWins = rows.filter((x) => x.game_id === "minesweeper" && x.result === "win").length;
  content.classList.remove("hidden");
  content.appendChild(el("div", "Your account stats · " + wins + " Tic-Tac-Toe wins · best reaction " + best + " · best scramble " + scrambleBest + " · " + wordleWins + " Wordle solves · " + minesWins + " Minesweeper clears", "games-intro muted small"));
  const grid = el("div", null, "games-grid");
  grid.appendChild(makeTicTacToeCard());
  grid.appendChild(makeQuickdrawCard());
  grid.appendChild(makeWordScrambleCard());
  grid.appendChild(makeWordleCard());
  grid.appendChild(makeMinesCard());
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
        : row.game_id === "wordle"
          ? "Wordle · " + (row.result === "win" ? row.score + " points" : "unsolved")
          : row.game_id === "minesweeper"
            ? "Minesweeper · " + (row.result === "win" ? row.score + " points" : "boom")
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

const WORDLE_WORDS = ("about above abuse actor acute admit adore adopt adult after again agent agree ahead alarm album alert alike alive allow alone along aloud alter angel anger angle ankle apart apple apply arena argue arise array aside asset avoid awake award aware bacon badge baker bench birth black blade blame blank blast blend bless blind block bloom board bonus boost booth bound brain brand brave bread break brick bride brief bring broad broke brown brush build bunch buyer cabin cable candy carry catch cause chain chair charm chart chase cheap check cheese chest chief child choir choose civil claim class clean clear clerk click cliff climb clock close cloth cloud coach coast color comet comic comma coral could count court cover crack craft crash crazy cream crime cross crowd crown daily dance death delay depth diary dirty dodge doing doubt dozen draft drain drama dream dress drink drive eager early earth eight elbow elder elect elite empty enemy enjoy enter entry equal error essay event every exact exist extra faint faith false fault field fifth fifty fight final first flame flash fleet floor flour fluid focus force forth forty forum found frame fresh front frost fruit funny giant given glass globe glory gloves grade grain grand grant grape grass great green greet grief group guard guess guest guide happy heart heavy hello honey honor horse hotel house human hurry ideal image index inner input issue ivory joint judge juice knife knock known label large laugh layer learn least leave legal lemon level light limit liver local logic loose lover lower lucky lunch magic major maker march match maybe mayor meant medal mercy merge merry metal meter might minor minus minute model money month moral motor mount mouse mouth movie music nasty never night noble noise north novel nurse ocean offer often older olive onion opera order other ought outer owner paint panel paper party peace penny phase phone photo piano piece pilot pitch place plain plane plant plate point pound power press price pride prime print prize proof proud prove queen quick quiet quite radio raise range rapid ratio reach ready refer renew reply rider right river roast robot round route royal rural salad scale scene score sense serve seven shade shake shall shape share sharp sheep sheet shelf shell shift shine shirt shock short shout shown sight silly since sixth skill skirt sleep slice slide small smart smell smile smoke snake solar solid solve sorry sound south space spare speak speed spell spend spice split spoke sport staff stage stair stand start state steam steel steep stick still stock stone stood store storm story strip style sugar sunny super sweet table taken thank their theme there these thick thing think third those three threw throw thumb tiger tight tired title today token tooth topic track trade trail train trait treat trend trial tribe trick truck truly trust truth twice under union unite until upper upset urban usual valid value video visit vital voice waste watch water weave wheel where which while white whole whose woman women world worry worth would wound write wrong wrote yield young youth").split(" ").filter((w) => w.length === 5);
function makeWordleCard() {
  const card = el("section", null, "game-card");
  const head = el("div", null, "game-card-top");
  head.append(el("h3", "Wordle"), el("span", "6 TRIES", "game-badge"));
  card.appendChild(head);
  card.appendChild(el("p", "Guess the 5-letter word in 6 tries. Green = right spot, yellow = wrong spot.", "muted small"));
  const grid = el("div", null, "wordle-grid");
  const status = el("div", "Press New game, then type your guess.", "game-status");
  const form = document.createElement("form");
  form.className = "scramble-form";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 5;
  input.autocomplete = "off";
  input.placeholder = "5-letter guess";
  input.setAttribute("aria-label", "Wordle guess");
  input.disabled = true;
  const submit = el("button", "Guess", "mini-btn");
  submit.type = "submit";
  submit.disabled = true;
  form.append(input, submit);
  const start = el("button", "New game", "btn-primary scramble-start");
  start.type = "button";
  let answer = "", row = 0, playing = false;
  const cells = [];
  const paint = () => {
    grid.replaceChildren();
    cells.length = 0;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 5; c++) {
        const d = el("div", "", "wordle-cell" + (cells[r] && cells[r][c] ? " " + cells[r][c].cls : ""));
        if (cells[r] && cells[r][c]) d.textContent = cells[r][c].ch;
        grid.appendChild(d);
      }
    }
  };
  const scoreFor = (tries) => Math.max(10, 70 - tries * 10);
  const finish = (won) => {
    playing = false;
    input.disabled = true;
    submit.disabled = true;
    status.textContent = won ? `Solved in ${row} ${row === 1 ? "try" : "tries"}! +${scoreFor(row)} points.` : `Out of tries — it was ${answer.toUpperCase()}.`;
    saveGameScore("wordle", won ? scoreFor(row) : 0, won ? "win" : "loss");
  };
  const guess = (word) => {
    const res = Array(5).fill(null);
    const counts = {};
    for (const ch of answer) counts[ch] = (counts[ch] || 0) + 1;
    for (let i = 0; i < 5; i++) {
      if (word[i] === answer[i]) { res[i] = "hit"; counts[word[i]]--; }
    }
    for (let i = 0; i < 5; i++) {
      if (!res[i]) {
        if ((counts[word[i]] || 0) > 0) { res[i] = "near"; counts[word[i]]--; }
        else res[i] = "miss";
      }
    }
    return res;
  };
  paint();
  start.onclick = () => {
    answer = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
    row = 0;
    cells.length = 0;
    playing = true;
    input.value = "";
    input.disabled = false;
    submit.disabled = false;
    status.textContent = "Guess 1 of 6.";
    paint();
    input.focus();
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!playing) return;
    const word = input.value.trim().toLowerCase();
    if (word.length !== 5) { status.textContent = "Enter exactly 5 letters."; return; }
    if (!WORDLE_WORDS.includes(word)) { status.textContent = "Not in the word list — try another."; return; }
    const res = guess(word);
    cells[row] = word.split("").map((ch, i) => ({ ch: ch.toUpperCase(), cls: "wordle-" + res[i] }));
    row++;
    input.value = "";
    paint();
    if (word === answer) { finish(true); return; }
    if (row >= 6) { finish(false); return; }
    status.textContent = `Guess ${row + 1} of 6.`;
    input.focus();
  };
  card.append(grid, form, status, start);
  return card;
}
function makeMinesCard() {
  const card = el("section", null, "game-card");
  const head = el("div", null, "game-card-top");
  head.append(el("h3", "Minesweeper"), el("span", "9×9 · 10 MINES", "game-badge"));
  card.appendChild(head);
  card.appendChild(el("p", "Clear the field without hitting a mine. Toggle flag mode to mark suspects (right-click works too).", "muted small"));
  const status = el("div", "Press New game to start.", "game-status");
  const board = el("div", null, "mines-board");
  const controls = el("div", null, "mines-controls");
  const flagBtn = el("button", "🚩 Flag: off", "mini-btn");
  flagBtn.type = "button";
  const start = el("button", "New game", "btn-primary");
  start.type = "button";
  controls.append(flagBtn, start);
  const N = 9, MINES = 10;
  let mines = new Set(), open = new Set(), flags = new Set(), playing = false, flagMode = false, startedAt = 0;
  const key = (r, c) => r * N + c;
  const neighbors = (r, c) => {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push([nr, nc]);
    }
    return out;
  };
  const counts = (r, c) => neighbors(r, c).filter(([nr, nc]) => mines.has(key(nr, nc))).length;
  const paint = (dead) => {
    board.replaceChildren();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const k = key(r, c);
        const b = el("button", "", "mines-cell");
        b.type = "button";
        b.dataset.r = r;
        b.dataset.c = c;
        if (flags.has(k)) { b.textContent = "🚩"; b.classList.add("flagged"); }
        else if (open.has(k)) {
          b.classList.add("open");
          const n = counts(r, c);
          if (mines.has(k)) { b.textContent = "💥"; b.classList.add("boom"); }
          else if (n) { b.textContent = String(n); b.classList.add("n" + n); }
        } else if (dead && mines.has(k)) { b.textContent = "💣"; b.classList.add("open"); }
        b.onclick = (ev) => play(r, c, ev);
        b.oncontextmenu = (ev) => { ev.preventDefault(); play(r, c, { flag: true }); };
        board.appendChild(b);
      }
    }
  };
  const reveal = (r, c) => {
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const k = key(cr, cc);
      if (open.has(k) || flags.has(k)) continue;
      open.add(k);
      if (!counts(cr, cc) && !mines.has(k)) {
        for (const [nr, nc] of neighbors(cr, cc)) {
          if (!open.has(key(nr, nc))) stack.push([nr, nc]);
        }
      }
    }
  };
  const finish = (won) => {
    playing = false;
    const secs = Math.round((Date.now() - startedAt) / 1000);
    status.textContent = won ? `Cleared in ${secs}s! +${Math.max(10, 120 - secs)} points.` : "Boom! You hit a mine.";
    saveGameScore("minesweeper", won ? Math.max(10, 120 - secs) : 0, won ? "win" : "loss");
    paint(!won);
  };
  const play = (r, c, ev) => {
    if (!playing) return;
    const k = key(r, c);
    if ((ev && ev.flag) || flagMode) {
      if (open.has(k)) return;
      if (flags.has(k)) flags.delete(k); else flags.add(k);
      status.textContent = `${flags.size} 🚩 placed · ${MINES - flags.size} mines left (maybe)`;
      paint(false);
      return;
    }
    if (flags.has(k) || open.has(k)) return;
    if (mines.has(k)) { open.add(k); finish(false); return; }
    reveal(r, c);
    if (open.size >= N * N - MINES) { finish(true); return; }
    paint(false);
  };
  flagBtn.onclick = () => {
    flagMode = !flagMode;
    flagBtn.textContent = flagMode ? "🚩 Flag: on" : "🚩 Flag: off";
  };
  start.onclick = () => {
    mines = new Set();
    while (mines.size < MINES) mines.add(Math.floor(Math.random() * (N * N)));
    open = new Set();
    flags = new Set();
    playing = true;
    flagMode = false;
    flagBtn.textContent = "🚩 Flag: off";
    startedAt = Date.now();
    status.textContent = "Good luck — clear every safe square.";
    paint(false);
  };
  paint(false);
  card.append(board, controls, status);
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
  if (id !== "chat-view" || view.type !== "channel") {
    document.querySelectorAll(".server-banner").forEach((node) => node.remove());
  }
  for (const v of ["chat-view", "dashboard-view", "shop-view", "quests-view",
    "games-view", "saved-view", "server-settings-view", "voice-view", "events-view", "nitro-view", "friends-view"])
    $(v).classList.add("hidden");
  const destination = $(id);
  destination.classList.remove("hidden", "view-enter");
  void destination.offsetWidth;
  destination.classList.add("view-enter");
  setTimeout(() => destination.classList.remove("view-enter"), 650);
  if (id === "voice-view") mountCallChat();
  else restoreCallChat();
  updateVoiceDock(id);
  updateScreenMini();
  if (id === "chat-view" && view.type === "channel" && activeServer
    && activeServer.banner_url && isSafeImg(activeServer.banner_url)
    && serverBoostLevel(activeServer.id) >= 2 && !document.querySelector(".server-banner")) {
    const banner = document.createElement("img");
    banner.src = activeServer.banner_url;
    banner.alt = "";
    banner.className = "server-banner";
    $("channel-list").before(banner);
  }
}

let voiceChatNodes = null;
function mountCallChat() {
  const panel = $("voice-chat-panel");
  const hasThread = view.type === "dm" || view.type === "gdm" || (view.type === "channel" && !!activeChannel);
  if (!panel || !hasThread) {
    panel?.classList.add("hidden");
    $("voice-view")?.classList.remove("with-call-chat");
    return;
  }
  panel.classList.remove("hidden");
  $("voice-view").classList.add("with-call-chat");
  $("voice-chat-title").textContent = view.type === "gdm" ? "Group call chat"
    : view.type === "dm" ? "Call chat" : "#" + activeChannel.name;
  if (voiceChatNodes) return;
  voiceChatNodes = ["messages", "scroll-pill", "typing-hint", "reply-bar", "message-form"]
    .map((id) => $(id)).filter(Boolean);
  panel.append(...voiceChatNodes);
}
function restoreCallChat() {
  if (voiceChatNodes) {
    const chat = $("chat-view");
    for (const node of voiceChatNodes) chat.appendChild(node);
    voiceChatNodes = null;
  }
  $("voice-chat-panel")?.classList.add("hidden");
  $("voice-view")?.classList.remove("with-call-chat");
}
function updateVoiceDock(targetView) {
  const dock = $("voice-dock");
  if (!dock) return;
  const visible = !!voiceId && targetView !== "voice-view";
  dock.classList.toggle("hidden", !visible);
  if (visible) $("voice-dock-name").textContent = $("voice-name").textContent || "Call";
}

async function openShop() {
  showView("shop-view");
  await renderShop();
}
let shopFilter = { q: "", kind: "all" };
async function renderShop() {
  const grid = $("shop-grid");
  grid.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  const items = await loadShopItems();
  const w = await myWallet();
  $("shop-balance").textContent = `${w.balance} 🪙${w.nitroActive ? " · BOOST until " + new Date(w.nitroUntil).toLocaleDateString() : ""}`;
  cachedCoins = w.balance;
  // Also clean up immediately when a session stays open past Boost expiry.
  const equippedFrame = (profile.equipped || {}).frame;
  const frameItem = (items || []).find((item) => item.id === equippedFrame);
  if (frameItem && frameItem.nitro && !w.nitroActive) {
    const eq = { ...(profile.equipped || {}) };
    delete eq.frame;
    const { error } = await supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id);
    if (!error) {
      profile.equipped = eq;
      const ownUser = users.find((user) => user.id === profile.id);
      if (ownUser) ownUser.equipped = eq;
      paintUserPanelAvatar();
      refreshUsers(true);
      toast("Boost expired — your Boost-only frame was unequipped.", "err");
    }
  }
  const pill = $("coin-balance");
  if (pill) pill.textContent = `${w.balance} 🪙`;
  // Expired Boost loses its badge (own boost/nitro row only — enforced by RLS too).
  for (const bid of ["boost", "nitro"]) {
    if ((userBadges.get(profile.id) || []).includes(bid) && !w.nitroActive) {
      const { error } = await supabase.from("profile_badges")
        .delete().eq("user_id", profile.id).eq("badge_id", bid);
      if (!error) userBadges.set(profile.id, (userBadges.get(profile.id) || []).filter((b) => b !== bid));
    }
  }
  // Active Boost always shows its badge: backfill for gift recipients and
  // pre-badge subscribers who have ledger time but no badge row.
  if (w.nitroActive && !(userBadges.get(profile.id) || []).includes("boost")
    && !(userBadges.get(profile.id) || []).includes("nitro")) {
    const { error } = await supabase.from("profile_badges")
      .insert({ user_id: profile.id, badge_id: "boost", granted_by: profile.id });
    if (!error) {
      userBadges.set(profile.id, [...(userBadges.get(profile.id) || []), "boost"]);
      refreshUsers(true);
    }
    // Silently skip on error (e.g. v25 schema not applied yet) — the next
    // shop visit retries. Subscribe flows insert the row directly; gift
    // recipients (who can't be written by the sender under RLS) backfill here
    // on their own next shop visit.
  }
  grid.innerHTML = "";
  // Toolbar: search + kind filter.
  const bar = el("div", null, "shop-toolbar");
  const search = el("input", null, "shop-search");
  search.type = "text";
  search.placeholder = "Search the shop";
  search.maxLength = 40;
  search.value = shopFilter.q;
  search.setAttribute("aria-label", "Search the shop");
  search.oninput = () => { shopFilter.q = search.value; paintShopGrid(items, w); };
  bar.appendChild(search);
  for (const [key, label] of [["all", "All"], ["frame", "Avatar Frames"], ["banner", "Profile Banners"], ["nameplate", "Nameplates"], ["effect", "Effects"], ["color", "Name Colors"], ["boost", "Boost"]]) {
    const t = el("button", label, "shop-tab" + (shopFilter.kind === key ? " active" : ""));
    t.type = "button";
    t.onclick = () => { shopFilter.kind = key; renderShop(); };
    bar.appendChild(t);
  }
  grid.appendChild(bar);
  const list = el("div", null, "shop-list");
  grid.appendChild(list);
  paintShopGrid(items, w, list);
}
/* Visual preview of what an item looks like on you. */
function shopPreview(item) {
  const pv = el("div", null, "shop-preview");
  if (item.kind === "frame") {
    pv.appendChild(avatarNode(profile.username, profile.avatar_emoji,
      { ...(profile.equipped || {}), frame: item.id, nitro: true }, profile.avatar_url));
    pv.appendChild(el("div", profile.username, "shop-preview-name"));
  } else if (item.kind === "color") {
    pv.appendChild(avatarNode(profile.username, profile.avatar_emoji, profile.equipped || {}, profile.avatar_url));
    const nm = el("div", profile.username, "shop-preview-name");
    if (item.value) nm.style.color = item.value;
    pv.appendChild(nm);
  } else if (item.kind === "effect") {
    pv.classList.add("effect-preview", "effect-" + String(item.value || "sparkles"));
    const sample = el("div", null, "effect-preview-avatar");
    sample.appendChild(avatarNode(profile.username, profile.avatar_emoji, profile.equipped || {}, profile.avatar_url));
    for (let i = 0; i < 8; i++) {
      const particle = el("span", null, "fx-particle");
      particle.style.setProperty("--particle-index", String(i));
      pv.appendChild(particle);
    }
    if (item.image_url && isSafeImg(item.image_url)) { const art = document.createElement("img"); art.src = item.image_url; art.alt = ""; art.className = "profile-effect-art"; pv.appendChild(art); }
    pv.append(sample, el("div", item.name, "shop-preview-name"));
  } else if (item.kind === "banner") {
    pv.classList.add("banner-shop-preview");
    if (item.image_url && isSafeImg(item.image_url)) { const art = document.createElement("img"); art.src = item.image_url; art.alt = "Profile banner preview"; art.className = "banner-shop-art"; pv.appendChild(art); }
    pv.appendChild(el("div", profile.username, "shop-preview-name"));
  } else if (item.kind === "nameplate") {
    const sample = applyNameplate(el("div", profile.username, "nameplate-preview"), { nameplate: item.id });
    pv.appendChild(sample);
  } else {
    pv.appendChild(nitroBadgeNode(0));
    pv.appendChild(el("div", "Boost perks", "shop-preview-name"));
  }
  if (item.nitro) pv.appendChild(el("div", "BOOST", "shop-nitro-tag"));
  return pv;
}
function paintShopGrid(items, w, list) {
  list = list || document.querySelector("#shop-grid .shop-list");
  if (!list) return;
  list.innerHTML = "";
  const eq = profile.equipped || {};
  const q = shopFilter.q.trim().toLowerCase();
  const shown = items.filter((item) =>
    (shopFilter.kind === "all" || item.kind === shopFilter.kind) &&
    (!q || (item.name + " " + item.desc).toLowerCase().includes(q)));
  if (!shown.length) {
    list.appendChild(el("div", "Nothing matches. Try another search.", "empty-note"));
    return;
  }
  const groups = [["frame", "Avatar Frames"], ["banner", "Profile Banners"], ["nameplate", "Nameplates"], ["effect", "Profile Effects"], ["color", "Name Colors"], ["boost", "Boost"]];
  for (const [kind, title] of groups) {
    const inGroup = shown.filter((i) => i.kind === kind);
    if (!inGroup.length) continue;
    if (shopFilter.kind === "all") list.appendChild(el("div", title, "shop-group-title"));
    const row = el("div", null, "shop-row");
    for (const item of inGroup) {
      const card = el("div", null, "shop-card");
      card.appendChild(shopPreview(item));
      card.appendChild(el("div", item.name, "shop-name"));
      card.appendChild(el("div", item.desc, "muted small"));
      card.appendChild(el("div", `${item.cost} 🪙`, "shop-cost"));
      const btn = el("button", "", "mini-btn");
      btn.type = "button";
      if (item.kind === "boost") {
        btn.textContent = "View plans";
        btn.onclick = () => openNitro();
      } else if ((item.kind === "frame" && eq.frame === item.id)
        || (item.kind === "color" && eq.color === item.value)
        || (item.kind === "effect" && eq.effect === item.id)
        || (item.kind === "banner" && eq.bannerItem === item.id)
        || (item.kind === "nameplate" && eq.nameplate === item.id)) {
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
      row.appendChild(card);
    }
    list.appendChild(row);
  }
}
async function buyItem(item) {
  const w = await myWallet();
  if (w.balance < item.cost) { toast(`Need ${item.cost} 🪙 — you have ${w.balance}. Do quests!`, "err"); return; }
  if (item.nitro && !w.nitroActive) { toast("Rainbow Flow needs Boost first.", "err"); return; }
  if (item.kind === "banner" && (!item.image_url || !isSafeImg(item.image_url))) { toast("This profile banner has no valid art yet.", "err"); return; }
  await logActivity("shop_buy", `buy:${item.id}:-${item.cost}`);
  toast(`Bought ${item.name}!`, "ok");
  if (item.kind === "frame" || item.kind === "color" || item.kind === "effect" || item.kind === "banner" || item.kind === "nameplate") await equipItem(item);
  else {
    if (item.kind === "boost" || item.kind === "nitro") {
      // Write both flags so pre-rebrand clients keep showing the glow.
      const eq = { ...(profile.equipped || {}), nitro: true, boost: true };
      const { error: eqErr } = await supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id);
      if (eqErr) { toast("Couldn't apply Boost: " + eqErr.message, "err"); return; }
      profile.equipped = eq;
      // Durable proof of ownership: a boost badge on the profile (self-claim
      // policies only allow 'boost' (v25) or legacy 'nitro' for your own row).
      if (!(userBadges.get(profile.id) || []).includes("boost") && !(userBadges.get(profile.id) || []).includes("nitro")) {
        const { error: bErr } = await supabase.from("profile_badges").insert({
          user_id: profile.id, badge_id: "boost", granted_by: profile.id
        });
        if (bErr) {
          toast("Boost active, but the badge didn't save: " + bErr.message, "err");
        } else {
          userBadges.set(profile.id, [...(userBadges.get(profile.id) || []), "boost"]);
        }
      }
    }
    renderShop();
  }
  updateCoinPill();
}
async function equipItem(item) {
  const eq = { ...(profile.equipped || {}) };
  if (item.kind === "frame") eq.frame = item.id;
  if (item.kind === "color") eq.color = item.value;
  if (item.kind === "effect") eq.effect = item.id;
  if (item.kind === "banner") { eq.banner = item.image_url || ""; eq.bannerItem = item.id; }
  if (item.kind === "nameplate") eq.nameplate = item.id;
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
    cachedCoins = w.balance;
    const pill = $("coin-balance");
    if (pill) pill.textContent = `${w.balance} 🪙`;
  } catch { /* panel may be hidden */ }
}

/* ---------------- Boost page (plans, perks, gifting) ---------------- */
const NITRO_FULL_COST = 500, NITRO_BASIC_COST = 200;
async function openNitro() {
  showView("nitro-view");
  const box = $("nitro-content");
  box.innerHTML = "";
  const w = await myWallet();
  const hero = el("div", null, "nitro-hero");
  hero.appendChild(el("div", "UNLOCK A WORLD OF PERKS WITH BOOST", "nitro-hero-title"));
  hero.appendChild(el("div",
    w.nitroActive
      ? `You have Boost until ${new Date(w.nitroUntil).toLocaleDateString()}.`
      : "Subscribe with coins — no real money involved, everything is virtual.",
    "muted"));
  box.appendChild(hero);
  // Rank ladder: lifetime Boosts evolve your badge.
  const myTier = nitroTierForBuys(w.nitroBuys);
  const next = nitroNextTier(w.nitroBuys);
  const rankLine = el("div", null, "nitro-rank-line");
  rankLine.appendChild(nitroBadgeNode(myTier));
  rankLine.appendChild(el("div",
    next
      ? `${w.nitroBuys} lifetime Boost${w.nitroBuys === 1 ? "" : "s"} · ${next.at - w.nitroBuys} more to ${NITRO_TIERS[next.tier].name}`
      : `${w.nitroBuys} lifetime Boosts · max rank ${NITRO_TIERS[myTier].name}!`,
    "nitro-rank-text"));
  box.appendChild(rankLine);
  const ladder = el("div", null, "nitro-ladder");
  NITRO_TIERS.forEach((T, i) => {
    const slot = el("div", null, "nitro-ladder-slot" + (i <= myTier ? " earned" : ""));
    slot.title = `${T.name} · ${NITRO_TIER_AT[i]} lifetime Boost${NITRO_TIER_AT[i] === 1 ? "" : "s"}`;
    slot.appendChild(nitroBadgeNode(i));
    slot.appendChild(el("div", String(NITRO_TIER_AT[i]), "nitro-ladder-need"));
    ladder.appendChild(slot);
  });
  box.appendChild(ladder);
  const plans = el("div", null, "nitro-plans");
  const perksFull = ["Animated avatar glow + profile banner", "Custom emoji anywhere", "Boost-exclusive frames & colors", "2 Server Boosts included", "Special Boost badge that evolves"];
  const perksBasic = ["Custom emoji anywhere", "Special Boost badge on your profile", "7 days of Boost status"];
  const mkPlan = (name, cost, tagline, perks, popular, onSub) => {
    const card = el("div", null, "nitro-card" + (popular ? " popular" : ""));
    if (popular) card.appendChild(el("div", "POPULAR", "nitro-pop"));
    card.appendChild(el("div", name, "nitro-name"));
    card.appendChild(el("div", `${cost} coins`, "nitro-price"));
    card.appendChild(el("div", tagline, "muted small"));
    const ul = el("ul", null, "nitro-perks");
    for (const p of perks) ul.appendChild(el("li", p));
    card.appendChild(ul);
    const sub = el("button", "Subscribe", "btn-primary");
    sub.type = "button";
    sub.textContent = w.nitroActive ? "Extend" : "Subscribe";
    sub.onclick = onSub;
    const gift = el("button", "Gift Boost", "btn-secondary");
    gift.type = "button";
    gift.onclick = () => giftNitroFlow(cost, popular ? "boost" : "boost_basic", popular ? 30 : 7);
    card.append(sub, gift);
    return card;
  };
  plans.appendChild(mkPlan("BOOST", NITRO_FULL_COST, "30 days · full perks", perksFull, true, () => subscribeNitro("boost", NITRO_FULL_COST, 30)));
  plans.appendChild(mkPlan("BOOST BASIC", NITRO_BASIC_COST, "7 days · lite perks", perksBasic, false, () => subscribeNitro("boost_basic", NITRO_BASIC_COST, 7)));
  box.appendChild(plans);
  const note = el("div", "Gifts arrive instantly as coins or Boost on the recipient's account.", "muted small");
  box.appendChild(note);
}
async function subscribeNitro(itemId, cost, days) {
  const w = await myWallet();
  if (w.balance < cost) { toast(`Need ${cost} coins — you have ${w.balance}. Do quests!`, "err"); return; }
  const yes = await showModal({ title: `Subscribe to Boost?`, body: `Spend ${cost} coins for ${days} days of Boost.`, okText: "Subscribe" });
  if (yes !== true) return;
  const { error } = await logActivity("shop_buy", `buy:${itemId}:-${cost}`);
  if (error) { toast("Couldn't subscribe: " + error.message, "err"); return; }
  const eq = { ...(profile.equipped || {}), nitro: true, boost: true };
  await supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id);
  profile.equipped = eq;
  if (!(userBadges.get(profile.id) || []).includes("boost") && !(userBadges.get(profile.id) || []).includes("nitro")) {
    await supabase.from("profile_badges").insert({ user_id: profile.id, badge_id: "boost", granted_by: profile.id });
    userBadges.set(profile.id, [...(userBadges.get(profile.id) || []), "boost"]);
  }
  toast("Welcome to Boost!", "ok");
  updateCoinPill();
  openNitro();
}
/* Gift coins or Boost to another user (both rows are written by the sender;
   the receiver's balance updates through the existing grant paths). */
async function giftNitroFlow(cost, itemId = "boost", days = 30) {
  const name = await showModal({ title: "Gift Boost", body: `Recipient's exact username. Costs you ${cost} coins; they get ${days} days of Boost.`, input: true, placeholder: "username", okText: "Send gift" });
  if (!name) return;
  await refreshUsers(true);
  const u = users.find((x) => x.username.toLowerCase() === name.toLowerCase());
  if (!u) { toast("No user called " + name, "err"); return; }
  if (u.id === session.user.id) { toast("You can't gift yourself.", "err"); return; }
  const w = await myWallet();
  if (w.balance < cost) { toast(`Need ${cost} coins — you have ${w.balance}.`, "err"); return; }
  const { error: e1 } = await logActivity("shop_buy", `buy:boost_gift:-${cost}`);
  if (e1) { toast("Gift failed: " + e1.message, "err"); return; }
  const { error: e2 } = await logActivity("item_grant", `item:${u.username}:${itemId}`);
  if (e2) { toast("Gift deduction taken but delivery failed: " + e2.message, "err"); return; }
  toast(`Gifted Boost to ${u.username}!`, "ok");
  updateCoinPill();
}
async function giftCoinsFlow() {
  const name = await showModal({ title: "Send coins", body: "Recipient's exact username.", input: true, placeholder: "username", okText: "Next" });
  if (!name) return;
  await refreshUsers(true);
  const u = users.find((x) => x.username.toLowerCase() === name.toLowerCase());
  if (!u) { toast("No user called " + name, "err"); return; }
  if (u.id === session.user.id) { toast("You can't gift yourself.", "err"); return; }
  const amtRaw = await showModal({ title: `Gift coins to ${u.username}`, body: `Your balance funds this gift. Enter an amount.`, input: true, placeholder: "amount", okText: "Send gift" });
  const amt = Math.floor(Number(amtRaw));
  if (!amt || amt <= 0 || amt > 10000) { if (amtRaw) toast("Enter an amount between 1 and 10,000.", "err"); return; }
  const w = await myWallet();
  if (w.balance < amt) { toast(`Need ${amt} coins — you have ${w.balance}.`, "err"); return; }
  const { error: e1 } = await logActivity("coin_gift_send", `gift:${u.username}:-${amt}`);
  if (e1) { toast("Gift failed: " + e1.message, "err"); return; }
  const { error: e2 } = await logActivity("coin_grant", `grant:${u.username}:+${amt}`);
  if (e2) { toast("Gift deduction taken but delivery failed: " + e2.message, "err"); return; }
  toast(`Sent ${amt} coins to ${u.username}!`, "ok");
  updateCoinPill();
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
  // Custom server emoji first (names can't collide with markdown).
  const emoteRe = /:([a-z0-9_]{2,24}):/g;
  let last = 0, m;
  const pushMd = (t) => { if (t) richMarkdownPart(t, parent); };
  while ((m = emoteRe.exec(text))) {
    pushMd(text.slice(last, m.index));
    const url = serverEmoji.get(m[1]);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = m[0];
      img.title = m[0];
      img.loading = "lazy";
      img.className = "inline-emoji";
      parent.appendChild(img);
    } else {
      pushMd(m[0]);
    }
    last = m.index + m[0].length;
  }
  pushMd(text.slice(last));
}
/* @username mentions rendered as highlighted chips (Discord-style). */
function richMentions(text, parent) {
  const mentionRe = /@([a-zA-Z0-9_]{2,20})/g;
  let last = 0, m;
  const push = (t) => { if (t) parent.appendChild(document.createTextNode(t)); };
  while ((m = mentionRe.exec(text))) {
    push(text.slice(last, m.index));
    const name = m[1];
    const u = users.find((x) => x.username.toLowerCase() === name.toLowerCase());
    const chip = el("span", "@" + name, "mention-chip" + (u ? " known" : ""));
    if (u) {
      chip.title = "View " + u.username + "'s profile";
      chip.onclick = (ev) => { ev.stopPropagation(); openProfile(u.id); };
    }
    parent.appendChild(chip);
    last = m.index + m[0].length;
  }
  push(text.slice(last));
}
function richMarkdownPart(text, parent) {
  const re = /(\*\*.+?\*\*|\*[^*\n]+?\*|__[^_\n]+?__|\|\|.+?\|\||^&gt;.*$)/gm;
  let last = 0, m;
  const push = (t) => { if (t) richMentions(t, parent); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parent.appendChild(el("b", tok.slice(2, -2)));
    else if (tok.startsWith("__")) parent.appendChild(el("u", tok.slice(2, -2)));
    else if (tok.startsWith("||")) {
      const sp = el("span", tok.slice(2, -2), "spoiler");
      sp.onclick = () => sp.classList.add("revealed");
      parent.appendChild(sp);
    } else if (tok.startsWith("&gt; ")) parent.appendChild(el("div", tok.slice(5), "md-quote"));
    else parent.appendChild(el("i", tok.slice(1, -1)));
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

/* Remembered accounts for fast switching (emails only — never passwords). */
function getRememberedAccounts() {
  try {
    const list = JSON.parse(localStorage.getItem("ping-accounts") || "[]");
    return Array.isArray(list) ? list.filter((a) => a && a.email).slice(0, 5) : [];
  } catch { return []; }
}
function rememberAccount(email, username) {
  if (!email) return;
  const list = getRememberedAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase());
  list.unshift({ email, username: username || email.split("@")[0] });
  try { localStorage.setItem("ping-accounts", JSON.stringify(list.slice(0, 5))); } catch { /* private mode */ }
}
function forgetAccount(email) {
  try {
    localStorage.setItem("ping-accounts",
      JSON.stringify(getRememberedAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase())));
  } catch { /* private mode */ }
}
async function switchAccountTo(email) {
  try { sessionStorage.setItem("ping-prefill-email", email); } catch { /* private mode */ }
  await logActivity("logout", "account switch");
  clearInterval(heartbeat);
  for (const ch of [msgChannel, dmChannel, friendSub, callInboxChannel]) {
    if (ch) { try { await supabase.removeChannel(ch); } catch { /* gone */ } }
  }
  callInboxChannel = null;
  if (typeof gdmChannel !== "undefined" && gdmChannel) {
    try { await supabase.removeChannel(gdmChannel); } catch { /* gone */ }
  }
  await leaveVoice(true);
  unwatchVoiceRosters();
  await supabase.auth.signOut();
  location.reload();
}
/* Paint a profile banner: gradient string or uploaded image URL. */
function paintProfileCover(cover, u) {
  const banner = u && u.equipped && u.equipped.banner;
  if (!banner) return;
  if (/^https?:/i.test(banner)) {
    if (!isSafeImg(banner)) return;
    cover.style.backgroundImage = `url("${banner.replace(/"/g, "")}")`;
    cover.style.backgroundSize = "cover";
    cover.style.backgroundPosition = "center";
  } else {
    cover.style.background = banner;
  }
}
/* Linked game accounts (stored in equipped.connections, owner-editable). */
const CONNECTION_DEFS = [
  { key: "osu", label: "osu!", color: "#ed8ebc", short: "osu!" },
  { key: "minecraft", label: "Minecraft", color: "#5bba3f", short: "MC" },
  { key: "steam", label: "Steam", color: "#66c0f4", short: "S" }
];
function renderConnectionBadges(parent, u, labeled = false) {
  const conns = (u && u.equipped && u.equipped.connections) || {};
  for (const def of CONNECTION_DEFS) {
    const handle = conns[def.key];
    if (!handle) continue;
    const pill = el("span", null, "conn-badge");
    pill.style.background = def.color;
    pill.appendChild(el("span", def.short, "conn-short"));
    if (labeled) pill.appendChild(el("span", String(handle).slice(0, 24), "conn-name"));
    pill.title = `${def.label}: ${handle}`;
    pill.setAttribute("aria-label", `${def.label} account: ${handle}`);
    parent.appendChild(pill);
  }
}
function openSelfCard() {
  hideBadgeTooltip();
  const u = profile;
  if (!u) return;
  const overlay = $("modal-overlay");
  const card = $("modal-card");
  card.classList.add("profile-card-modal", "self-card-modal");
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
  paintProfileCover(cover, u);
  const closeButton = el("button", "×", "profile-close");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.onclick = () => ok.click();
  cover.appendChild(closeButton);
  body.appendChild(cover);
  const identity = el("div", null, "profile-identity");
  identity.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}, u.avatar_url));
  const details = el("div", null, "profile-identity-copy");
  const profileName = el("div", null, "profile-name");
  profileName.appendChild(el("span", u.username));
  applyNameplate(profileName, u.equipped || {});
  const badge = roleBadge(u.role);
  if (badge) profileName.appendChild(badge);
  appendSpecialBadgeStrip(profileName, u.id, { limit: 3 });
  const profileGuildTag = guildTagNode(equippedGuildTag(u.equipped || {}));
  if (profileGuildTag) profileName.appendChild(profileGuildTag);
  details.appendChild(profileName);
  details.appendChild(el("div", "@" + u.username, "profile-handle muted small"));
  const statusLine = el("div", null, "profile-status muted small");
  const dot = el("span", null, "dot " + ownPresenceStatus());
  dot.title = presenceLabel(ownPresenceStatus());
  statusLine.appendChild(dot);
  statusLine.appendChild(el("span", u.custom_status || presenceLabel(ownPresenceStatus())));
  details.appendChild(statusLine);
  identity.appendChild(details);
  body.appendChild(identity);
  renderConnectionBadges(body, u, true);
  if (u.bio) {
    const bioBox = el("div", null, "profile-info-box self-bio-box");
    bioBox.appendChild(el("div", "ABOUT ME", "profile-section-title"));
    bioBox.appendChild(el("p", u.bio, "profile-bio"));
    body.appendChild(bioBox);
  }
  const rows = el("div", null, "self-card-rows");
  const editRow = el("button", null, "self-card-row");
  editRow.type = "button";
  editRow.appendChild(icon("pencil"));
  editRow.appendChild(el("span", "Edit Profile"));
  editRow.onclick = () => { closeSelfCard(); openProfileEditor(); };
  rows.appendChild(editRow);
  for (const option of PRESENCE_OPTIONS) {
    const current = ownPresenceStatus() === option.id;
    const r = el("button", null, "self-card-row" + (current ? " active" : ""));
    r.type = "button";
    r.appendChild(presenceDot(option.id));
    const meta = el("span");
    meta.appendChild(el("div", option.label + (option.id === "invisible" ? " ⚠" : "")));
    meta.appendChild(el("div", option.id === "invisible" ? "Appear offline (messages still arrive)" : option.detail, "muted small"));
    r.appendChild(meta);
    if (current) {
      const chk = icon("check");
      chk.classList.add("self-card-check");
      r.appendChild(chk);
    }
    r.onclick = async () => { await setPresenceMode(option.id); closeSelfCard(); };
    rows.appendChild(r);
  }
  const remembered = getRememberedAccounts().filter((a) => a.email.toLowerCase() !== (session.user.email || "").toLowerCase());
  const swHead = el("button", null, "self-card-row");
  swHead.type = "button";
  swHead.appendChild(icon("user"));
  swHead.appendChild(el("span", "Switch Accounts"));
  swHead.appendChild(icon("chevR", "self-card-chev"));
  const swList = el("div", null, "self-card-sub hidden");
  if (!remembered.length) swList.appendChild(el("div", "No other accounts on this device yet.", "muted small"));
  for (const a of remembered) {
    const r = el("div", null, "self-card-acct");
    const go = el("button", null, "self-card-acct-go");
    go.type = "button";
    go.appendChild(el("span", (a.username || "?").slice(0, 1).toUpperCase(), "avatar mini-avatar"));
    go.appendChild(el("span", a.username + " · " + a.email, "small"));
    go.onclick = () => switchAccountTo(a.email);
    const del = el("button", "✕", "mini-btn");
    del.type = "button";
    del.title = "Forget this account";
    del.onclick = (ev) => { ev.stopPropagation(); forgetAccount(a.email); closeSelfCard(); openSelfCard(); };
    r.append(go, del);
    swList.appendChild(r);
  }
  const other = el("button", "Use another account…", "self-card-row");
  other.type = "button";
  other.onclick = () => switchAccountTo("");
  swList.appendChild(other);
  swHead.onclick = () => swList.classList.toggle("hidden");
  rows.appendChild(swHead);
  rows.appendChild(swList);
  const copyRow = el("button", null, "self-card-row");
  copyRow.type = "button";
  copyRow.appendChild(icon("idcard"));
  copyRow.appendChild(el("span", "Copy User ID"));
  copyRow.onclick = async () => {
    try {
      await navigator.clipboard.writeText(session.user.id);
      toast("User ID copied.", "ok");
    } catch {
      await showModal({ title: "Your User ID", body: session.user.id, okText: "Done" });
    }
  };
  rows.appendChild(copyRow);
  body.appendChild(rows);
  overlay.classList.remove("hidden");
  const closeSelfCard = () => {
    overlay.classList.add("hidden");
    ok.onclick = cancel.onclick = overlay.onclick = null;
    card.classList.remove("profile-card-modal", "self-card-modal");
    $("modal-title").classList.remove("hidden");
    body.className = "muted small";
  };
  cancel.onclick = closeSelfCard;
  overlay.onclick = (e) => { if (e.target === overlay) closeSelfCard(); };
  ok.onclick = closeSelfCard;
}
/* Profile effect particles: sparkles, embers, or a galaxy swirl. */
function renderProfileEffect(container, u) {
  container.querySelectorAll(".profile-effect-layer").forEach((n) => n.remove());
  const effect = u && u.equipped && u.equipped.effect;
  if (!effect) return;
  const item = (shopCatalog || []).find((entry) => entry.id === effect && entry.kind === "effect");
  if (!item) return;
  const style = String(item.value || "sparkles").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const layer = el("div", null, "profile-effect-layer effect-" + style);
  layer.setAttribute("aria-hidden", "true");
  if (item.image_url && isSafeImg(item.image_url)) {
    const image = document.createElement("img");
    image.src = item.image_url;
    image.alt = "";
    image.className = "profile-effect-art";
    image.draggable = false;
    layer.appendChild(image);
  }
  for (let i = 0; i < 12; i++) {
    const particle = el("span", null, "fx-particle");
    particle.style.setProperty("--particle-index", String(i));
    layer.appendChild(particle);
  }
  container.appendChild(layer);
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
  paintProfileCover(cover, u);
  const closeButton = el("button", "×", "profile-close");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close profile");
  closeButton.onclick = () => ok.click();
  cover.appendChild(closeButton);
  body.appendChild(cover);
  renderProfileEffect(cover, u);

  const identity = el("div", null, "profile-identity");
  identity.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}, u.avatar_url));
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
  details.appendChild(el("div", "@" + u.username, "profile-handle muted small"));
  const presence = presenceStatusForUser(u);
  const isOnline = presence !== "offline";
  const profileStatus = el("div", null, "profile-status muted small");
  const presenceDot = el("span", null, "dot " + presence);
  presenceDot.title = presenceLabel(presence);
  profileStatus.appendChild(presenceDot);
  profileStatus.appendChild(el("span", u.custom_status || (isOnline ? presenceLabel(presence) : "Last seen " + fmtTime(u.last_active))));
  details.appendChild(profileStatus);
  renderConnectionBadges(details, u, false);
  identity.appendChild(details);
  body.appendChild(identity);

  // Discord-style inset info box: about, member-since.
  // (Badges live next to the name above — no duplicate row here.)
  const infoBox = el("div", null, "profile-info-box");
  const aboutTitle = el("div", "ABOUT ME", "profile-section-title");
  const aboutText = el("p", u.bio || "This person hasn't added an About Me yet.", "profile-bio");
  infoBox.append(aboutTitle, aboutText);
  const sinceRow = el("div", null, "profile-since-row");
  const sinceText = el("div");
  sinceText.appendChild(el("div", "MEMBER SINCE", "profile-section-title"));
  sinceText.appendChild(el("div", new Date(u.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }), "small"));
  sinceRow.appendChild(sinceText);
  infoBox.appendChild(sinceRow);
  body.appendChild(infoBox);

  const actions = el("div", null, "profile-actions");
  if (uid !== session.user.id) {
    const dm = el("button", "Message", "btn-primary profile-message");
    dm.type = "button";
    dm.onclick = () => {
      closeProfile();
      openDM(uid);
    };
    actions.appendChild(dm);
    const fs = friendStatus(uid);
    if (fs === "none" || fs === "pending-out") {
      const add = el("button", fs === "none" ? "Add Friend" : "Request Sent", "btn-secondary");
      add.type = "button";
      add.disabled = fs !== "none";
      if (fs === "none") {
        add.onclick = () => {
          closeProfile();
          sendFriendRequestTo(uid);
        };
      }
      actions.appendChild(add);
    } else if (fs === "pending-in") {
      const acc = el("button", "Accept Request", "btn-secondary");
      acc.type = "button";
      acc.onclick = async () => {
        const row = friendships.find((r) => r.from_user === uid && r.status === "pending");
        closeProfile();
        if (row) answerFriendRequest(row.id, true);
      };
      actions.appendChild(acc);
    }
    const blockBtn = el("button", isBlocked(uid) ? "Unblock" : "Block", "btn-secondary" + (isBlocked(uid) ? "" : " danger"));
    blockBtn.type = "button";
    blockBtn.onclick = () => { closeProfile(); toggleBlockUser(uid); };
    actions.appendChild(blockBtn);
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
    const nameError = usernameProblem(nextName);
    if (nameError) {
      $("modal-err").textContent = nameError;
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
      avatar_emoji: fields.getAvatar() || null,
      avatar_url: fields.getAvatarUrl && fields.getAvatarUrl() ? fields.getAvatarUrl() : null,
      equipped: { ...(profile.equipped || {}), banner: fields.getBanner ? (fields.getBanner() || "") : ((profile.equipped || {}).banner || "") }
    };
    const { data, error } = await supabase.from("profiles").update(updates).eq("id", profile.id).select("*").single();
    if (error) {
      $("modal-err").textContent = /duplicate/i.test(error.message)
        ? "That username is already taken."
        : "Couldn't save your profile: " + error.message;
      $("modal-err").classList.remove("hidden");
      save.disabled = false;
      return;
    }
    profile = data;
    paintUserPanelAvatar();
    close();
    await refreshUsers(true);
    toast("Your profile is updated.", "ok");
    openProfile(profile.id);
  };
  overlay.classList.remove("hidden");
  username.focus();
}

async function sendImageMessage(url, asSpoiler = spoilerNextMessage) {
  const marker = asSpoiler ? "[spoiler]" : "";
  await sendMessageContent(marker + "[img]" + url, "attachment");
}
async function sendMessageContent(content, kindLabel = "attachment") {
  if (view.type === "dm" && !view.uid) { toast("Pick a conversation first.", "err"); return; }
  if (view.type === "gdm" && !view.thread) { toast("Pick a group first.", "err"); return; }
  if (view.type === "channel" && !activeChannel) return;
  if (profile.is_muted) { toast("You are muted.", "err"); return; }
  const payload = view.type === "dm"
    ? { sender_id: session.user.id, receiver_id: view.uid, content }
    : view.type === "gdm"
    ? { thread_id: view.thread, sender_id: session.user.id, content }
    : { channel_id: activeChannel.id, user_id: session.user.id, content };
  const table = view.type === "dm" ? "dms" : view.type === "gdm" ? "dm_group_messages" : "messages";
  const { error } = await supabase.from(table).insert(payload);
  if (error) toast(`Couldn't send ${kindLabel}: ` + error.message, "err");
  else if (spoilerNextMessage) {
    spoilerNextMessage = false;
    $("spoiler-btn").classList.remove("active");
    $("spoiler-btn").setAttribute("aria-pressed", "false");
  }
}

/* ---------------- polls (channel votes, live results) ---------------- */
let pollSub = null;

function ensurePollSub() {
  if (pollSub || !supabase || !session) return;
  pollSub = supabase.channel("polls-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, (p) => {
      const id = (p.new && p.new.poll_id) ?? (p.old && p.old.poll_id);
      if (id) refreshPoll(id);
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "polls" }, (p) => {
      document.querySelectorAll(`[data-poll-card="${p.old.id}"]`).forEach((n) => {
        n.innerHTML = "";
        n.appendChild(el("div", "📊 Poll removed.", "muted small"));
      });
    })
    .subscribe();
}

async function createPollModal() {
  if (!activeChannel || view.type !== "channel") return;
  if (profile.is_muted) { toast("You are muted.", "err"); return; }
  const overlay = $("modal-overlay"), card = $("modal-card"), title = $("modal-title"), body = $("modal-body");
  const ok = $("modal-ok"), cancel = $("modal-cancel");
  card.classList.remove("profile-card-modal", "profile-editor-modal", "profile-settings-modal", "event-wizard-modal");
  card.classList.add("poll-composer-modal");
  title.classList.remove("hidden"); title.textContent = "Create a Poll";
  body.replaceChildren(); body.className = "poll-composer-body";
  $("modal-input").classList.add("hidden"); $("modal-textarea").classList.add("hidden"); $("modal-err").classList.add("hidden");
  overlay.querySelectorAll(".modal-extra-btn").forEach((node) => node.remove());
  ok.textContent = "Post"; ok.disabled = false; ok.classList.remove("danger"); cancel.textContent = "Cancel";
  const question = document.createElement("input"); question.className = "poll-question-input"; question.maxLength = 300; question.placeholder = "What question do you want to ask?";
  const qcount = el("div", "0 / 300", "poll-char-count");
  question.oninput = () => { qcount.textContent = `${question.value.length} / 300`; };
  body.appendChild(el("label", "Question", "poll-composer-label")); body.append(question, qcount);
  body.appendChild(el("label", "Answers", "poll-composer-label"));
  const answers = el("div", null, "poll-answer-editor");
  const values = ["", ""];
  const paintAnswers = () => {
    answers.replaceChildren();
    values.forEach((value, index) => {
      const row = el("div", null, "poll-answer-row");
      const input = document.createElement("input"); input.maxLength = 80; input.placeholder = `Answer ${index + 1}`; input.value = value;
      input.oninput = () => { values[index] = input.value; };
      row.appendChild(icon("smile")); row.appendChild(input);
      if (values.length > 2) {
        const remove = iconBtn("trash", "poll-remove-answer", "Remove answer");
        remove.onclick = () => { values.splice(index, 1); paintAnswers(); };
        row.appendChild(remove);
      }
      answers.appendChild(row);
    });
  };
  paintAnswers(); body.appendChild(answers);
  const add = el("button", "+ Add another answer", "btn-secondary poll-add-answer"); add.type = "button";
  add.onclick = () => { if (values.length >= 10) { toast("Polls can have up to 10 answers.", "err"); return; } values.push(""); paintAnswers(); };
  body.appendChild(add);
  const duration = document.createElement("select"); duration.className = "poll-duration";
  for (const [value, label] of [["1", "1 hour"], ["4", "4 hours"], ["8", "8 hours"], ["24", "24 hours"], ["72", "3 days"]]) { const option = el("option", label); option.value = value; duration.appendChild(option); }
  duration.value = "24";
  body.appendChild(el("label", "Duration", "poll-composer-label")); body.appendChild(duration);
  const multiLabel = el("label", null, "poll-multiple-row");
  const multi = document.createElement("input"); multi.type = "checkbox";
  multiLabel.append(multi, el("span", "Allow Multiple Answers")); body.appendChild(multiLabel);
  overlay.classList.remove("hidden"); question.focus();
  const close = () => { overlay.classList.add("hidden"); card.classList.remove("poll-composer-modal"); ok.onclick = cancel.onclick = overlay.onclick = null; body.className = "muted small"; };
  cancel.onclick = close; overlay.onclick = (event) => { if (event.target === overlay) close(); };
  ok.onclick = async () => {
    const q = question.value.trim();
    const options = values.map((value) => value.trim()).filter(Boolean);
    if (!q) { toast("Enter a poll question.", "err"); question.focus(); return; }
    if (options.length < 2) { toast("Add at least two answers.", "err"); return; }
    if (new Set(options.map((value) => value.toLowerCase())).size !== options.length) { toast("Poll answers must be unique.", "err"); return; }
    ok.disabled = true;
    const closesAt = new Date(Date.now() + Number(duration.value) * 3600_000).toISOString();
    const { data: poll, error } = await supabase.from("polls")
      .insert({ channel_id: activeChannel.id, creator_id: session.user.id, question: q, options, closes_at: closesAt, allow_multiple: multi.checked })
      .select("id").single();
    if (error || !poll) { ok.disabled = false; toast("Couldn't create poll: " + (error && error.message) + " (apply the latest schema)", "err"); return; }
    const { error: messageError } = await supabase.from("messages").insert({ channel_id: activeChannel.id, user_id: session.user.id, content: `[poll:${poll.id}] ${q}`.slice(0, 500) });
    close();
    if (messageError) toast("Poll saved but didn't post: " + messageError.message, "err");
  };
}

async function renderPollCard(container, pollId) {
  container.innerHTML = "";
  const { data: poll } = await supabase.from("polls").select("*").eq("id", pollId).single();
  if (!poll || !Array.isArray(poll.options)) {
    container.appendChild(el("div", "📊 Poll unavailable.", "muted small"));
    return;
  }
  container.classList.toggle("multiple", !!poll.allow_multiple);
  container.appendChild(el("div", "📊 " + poll.question, "poll-question"));
  if (poll.allow_multiple) container.appendChild(el("div", "Select one or more answers", "poll-multi-hint muted small"));
  const optsBox = el("div", null, "poll-opts");
  container.appendChild(optsBox);
  const foot = el("div", null, "muted small poll-foot");
  container.appendChild(foot);
  if (canMod() || (session && poll.creator_id === session.user.id)) {
    const rm = el("button", "Remove poll", "mini-btn");
    rm.type = "button";
    rm.onclick = async () => {
      const yes = await showModal({ title: "Remove poll?", body: "Votes are discarded too.", okText: "Remove", danger: true });
      if (yes !== true) return;
      const { error } = await supabase.from("polls").delete().eq("id", poll.id);
      if (error) toast("Couldn't remove poll: " + error.message, "err");
    };
    container.appendChild(rm);
  }
  await paintPollVotes(poll, container);
}

async function paintPollVotes(poll, scope) {
  const nodes = (scope || document).querySelectorAll(`[data-poll-card="${poll.id}"]`);
  if (!nodes.length) return;
  const { data } = await supabase.from("poll_votes").select("user_id,option_idx")
    .eq("poll_id", poll.id).limit(2000);
  const counts = new Array(poll.options.length).fill(0);
  const mine = new Set();
  for (const v of data || []) {
    if (v.option_idx >= 0 && v.option_idx < counts.length) counts[v.option_idx]++;
    if (session && v.user_id === session.user.id) mine.add(v.option_idx);
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const closed = new Date(poll.closes_at).getTime() < Date.now();
  for (const node of nodes) {
    const box = node.querySelector(".poll-opts");
    const foot = node.querySelector(".poll-foot");
    if (!box) continue;
    box.innerHTML = "";
    poll.options.forEach((raw, i) => {
      const pct = total ? Math.round((counts[i] / total) * 100) : 0;
      const btn = el("button", null, "poll-opt" + (mine.has(i) ? " mine" : "") + (poll.allow_multiple ? " poll-multi-opt" : ""));
      btn.type = "button";
      btn.disabled = closed;
      const bar = el("div", null, "poll-bar");
      const fill = el("div", null, "poll-fill");
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      btn.appendChild(el("span", String(raw).slice(0, 80), "poll-label"));
      btn.appendChild(el("span", `${pct}% · ${counts[i]}`, "poll-pct"));
      btn.appendChild(bar);
      if (!closed) btn.onclick = () => castVote(poll.id, i, !!poll.allow_multiple);
      else btn.title = "Poll closed";
      box.appendChild(btn);
    });
    if (foot) {
      const left = Math.max(0, new Date(poll.closes_at).getTime() - Date.now());
      const hrs = Math.floor(left / 36e5), days = Math.floor(hrs / 24);
      foot.textContent = `${total} vote${total === 1 ? "" : "s"}` + (closed ? " · closed"
        : days ? ` · closes in ${days}d` : hrs ? ` · closes in ${hrs}h` : " · closing soon");
    }
  }
}

async function castVote(pollId, idx, allowMultiple = false) {
  if (!session) return;
  if (allowMultiple) {
    const { data: existing } = await supabase.from("poll_votes").select("option_idx").eq("poll_id", pollId).eq("user_id", session.user.id).eq("option_idx", idx).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", session.user.id).eq("option_idx", idx);
      if (error) { toast("Couldn't remove vote: " + error.message, "err"); return; }
    } else {
      const { error } = await supabase.from("poll_votes").insert({ poll_id: pollId, user_id: session.user.id, option_idx: idx });
      if (error) { toast("Couldn't vote: " + error.message, "err"); return; }
    }
  } else {
    await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", session.user.id);
    const { error } = await supabase.from("poll_votes").insert({ poll_id: pollId, user_id: session.user.id, option_idx: idx });
    if (error) { toast("Couldn't vote: " + error.message, "err"); return; }
  }
  refreshPoll(pollId);
}

function refreshPoll(id) {
  document.querySelectorAll(`[data-poll-card="${id}"]`).forEach((n) => renderPollCard(n, id));
}

/* ---------------- server explore ---------------- */
async function openExplore() {
  const overlay = $("modal-overlay");
  $("modal-title").textContent = "Explore servers";
  const body = $("modal-body");
  body.replaceChildren();
  body.className = "discover-body";
  const card = $("modal-card");
  card.classList.add("discover-modal");
  overlay.querySelectorAll(".modal-extra-btn").forEach((b) => b.remove());
  $("modal-input").classList.add("hidden");
  const ta = $("modal-textarea");
  if (ta) ta.classList.add("hidden");
  $("modal-err").classList.add("hidden");
  const ok = $("modal-ok"), cancel = $("modal-cancel");
  ok.textContent = "Close";
  ok.classList.remove("danger");
  const hero = el("section", null, "discover-hero");
  hero.appendChild(el("div", "DISCOVER PING", "discover-kicker"));
  hero.appendChild(el("h2", "Find your community"));
  hero.appendChild(el("p", "Explore public servers for games, music, learning, and everything in between."));
  const searchWrap = el("label", null, "discover-search");
  searchWrap.appendChild(icon("search"));
  const search = el("input"); search.type = "search"; search.maxLength = 50; search.placeholder = "Search public servers"; search.setAttribute("aria-label", "Search public servers");
  searchWrap.appendChild(search);
  hero.appendChild(searchWrap);
  body.appendChild(hero);
  const cats = el("nav", null, "discover-categories");
  const list = el("div", null, "discover-grid");
  body.append(cats, list);
  overlay.classList.remove("hidden");
  const done = () => {
    overlay.classList.add("hidden");
    ok.onclick = cancel.onclick = overlay.onclick = null;
    body.className = "muted small";
    card.classList.remove("discover-modal");
  };
  cancel.onclick = done;
  overlay.onclick = (e) => { if (e.target === overlay) done(); };
  ok.onclick = done;
  const [{ data: srvs }, { data: chs }] = await Promise.all([
    supabase.from("servers").select("id,name,description,icon_url,banner_url,icon_color,visibility,discovery_category,created_at").eq("visibility", "public").order("id").limit(100),
    supabase.from("channels").select("server_id").limit(1000)
  ]);
  const counts = new Map();
  for (const c of chs || []) counts.set(c.server_id, (counts.get(c.server_id) || 0) + 1);
  const publicServers = srvs || [];
  let selectedCategory = "All";
  const renderCards = () => {
    cats.replaceChildren();
    const categories = ["All", ...new Set(publicServers.map((server) => server.discovery_category || "Community"))];
    for (const category of categories) {
      const button = el("button", category, "discover-category" + (selectedCategory === category ? " active" : ""));
      button.type = "button";
      button.onclick = () => { selectedCategory = category; renderCards(); };
      cats.appendChild(button);
    }
    list.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const matches = publicServers.filter((server) => {
      const catMatch = selectedCategory === "All" || (server.discovery_category || "Community") === selectedCategory;
      const queryMatch = !query || `${server.name} ${server.description || ""} ${server.discovery_category || ""}`.toLowerCase().includes(query);
      return catMatch && queryMatch;
    });
    if (!matches.length) { list.appendChild(el("div", "No public servers match. Try another category or search.", "empty-note")); return; }
    for (const server of matches) {
      const item = el("article", null, "discover-card");
      const cover = el("div", null, "discover-cover");
      if (server.banner_url && isSafeImg(server.banner_url)) cover.style.backgroundImage = `url("${server.banner_url.replace(/"/g, "")}")`;
      else cover.style.background = server.icon_color || "linear-gradient(135deg,#5865f2,#8b5cf6,#ec4899)";
      if (server.icon_url && isSafeImg(server.icon_url)) {
        const image = document.createElement("img"); image.src = server.icon_url; image.alt = ""; image.className = "discover-icon"; cover.appendChild(image);
      } else cover.appendChild(el("span", server.name.slice(0, 1).toUpperCase(), "discover-icon-fallback"));
      item.appendChild(cover);
      const details = el("div", null, "discover-card-body");
      details.appendChild(el("div", server.name, "discover-name"));
      details.appendChild(el("span", server.discovery_category || "Community", "discover-category-pill"));
      details.appendChild(el("p", server.description || "A public Ping community. Join the conversation.", "discover-description"));
      details.appendChild(el("div", `${counts.get(server.id) || 0} channels${myMemberships.has(server.id) ? " · Joined" : " · Public"}`, "discover-meta"));
      const join = el("button", myMemberships.has(server.id) ? "Open Server" : "Join Server", "btn-primary discover-join");
      join.type = "button";
      join.onclick = async () => {
        done();
        if (!myMemberships.has(server.id)) {
          const joined = await joinViaInvite(server.id, null);
          if (!joined) return;
        }
        view = { type: "channel" };
        activeServer = servers.find((candidate) => candidate.id === server.id) || server;
        if (!servers.find((candidate) => candidate.id === server.id)) servers.push(activeServer);
        renderServerRail();
        await loadChannels();
      };
      details.appendChild(join);
      item.appendChild(details);
      list.appendChild(item);
    }
  };
  search.oninput = renderCards;
  renderCards();
}

/* ---------------- group DMs (private multi-person threads) ---------------- */
let gdmChannel = null;
const gdmUnread = new Map(); // threadId -> count
const gdmTypingKey = (id) => "g:" + id;

function ensureGroupSub() {
  if (gdmChannel || !supabase || !session) return;
  gdmChannel = supabase.channel("my-groups")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_group_messages" }, (payload) => {
      const d = payload.new;
      const key = gdmTypingKey(d.thread_id);
      const isCurrent = view.type === "gdm" && view.thread === d.thread_id;
      if (isCurrent) {
        appendMessage({ id: d.id, user_id: d.sender_id, content: d.content, created_at: d.created_at }, true);
      }
      if (d.sender_id !== session.user.id) {
        if (!isCurrentThreadGdm(d.thread_id)) {
          gdmUnread.set(d.thread_id, (gdmUnread.get(d.thread_id) || 0) + 1);
          paintDmUnread();
        }
        if (uiSettings.dmNotifications && (!isCurrentThreadGdm(d.thread_id) || document.hidden || !document.hasFocus())) {
          const sender = users.find((x) => x.id === d.sender_id);
          const preview = String(d.content || "");
          showMessageNotification("New group message from " + (sender ? sender.username : "someone"),
            preview.startsWith("[spoiler]") || preview.includes("||") ? "Sent a spoiler" : preview.slice(0, 120), "group-" + d.thread_id,
            { toastWhenVisible: !document.hidden });
        }
      }
      if (view.type === "dm" && !view.uid) renderDmList(false);
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "dm_group_messages" }, (payload) => {
      const node = document.querySelector(`.msg[data-mid="${payload.old.id}"]`);
      if (node) node.remove();
    })
    .subscribe();
}
function isCurrentThreadGdm(threadId) {
  return view.type === "gdm" && view.thread === threadId;
}

async function myGroupThreads() {
  const { data: mem } = await supabase.from("dm_group_members").select("thread_id").eq("user_id", session.user.id).limit(200);
  const ids = (mem || []).map((r) => r.thread_id);
  if (!ids.length) return [];
  const { data: threads } = await supabase.from("dm_groups").select("*").in("id", ids).order("id", { ascending: false }).limit(100);
  return threads || [];
}

async function renderGroupSection(list) {
  const threads = await myGroupThreads();
  list.appendChild(el("div", "GROUPS" + (threads.length ? ` — ${threads.length}` : ""), "chan-group"));
  for (const t of threads) {
    const { data: members } = await supabase.from("dm_group_members").select("user_id").eq("thread_id", t.id).limit(20);
    const memberUsers = (members || [])
      .map((m) => users.find((x) => x.id === m.user_id))
      .filter((u) => u && u.id !== session.user.id);
    const names = memberUsers.map((u) => u.username);
    const unread = gdmUnread.get(t.id) || 0;
    const row = el("div", null, "dm-thread-row");
    const av = el("button", null, "dm-avatar-button");
    av.type = "button";
    av.setAttribute("aria-label", "Open group " + t.name);
    const stack = el("span", null, "avatar-stack");
    const shown = memberUsers.slice(0, 3);
    if (t.icon_url && isSafeImg(t.icon_url)) {
      const image = document.createElement("img"); image.src = t.icon_url; image.alt = t.name; image.className = "dm-group-icon";
      stack.appendChild(image);
    } else {
      if (!shown.length) stack.appendChild(el("span", "👥", "avatar group-avatar"));
      for (const u of shown) {
        const a = avatarNode(u.username, u.avatar_emoji, u.equipped || {}, u.avatar_url);
        a.classList.add("stacked-mini");
        stack.appendChild(a);
      }
      if (memberUsers.length > 3) stack.appendChild(el("span", "+" + (memberUsers.length - 3), "stack-more"));
    }
    av.appendChild(stack);
    av.onclick = () => openGroupDM(t.id);
    const b = el("button", null, "chan dm-thread dm-thread-copy" + (view.thread === t.id ? " active" : "") + (unread ? " unread" : ""));
    b.type = "button";
    const meta = el("span");
    meta.appendChild(el("div", t.name, "dm-name"));
    meta.appendChild(el("div", (names.slice(0, 3).join(", ") || "empty group") + (names.length > 3 ? ` +${names.length - 3}` : ""), "muted small"));
    b.appendChild(meta);
    if (unread) b.appendChild(el("span", unread > 99 ? "99+" : String(unread), "dm-unread"));
    b.onclick = () => openGroupDM(t.id);
    const leave = el("button", "✕", "mini-btn");
    leave.type = "button";
    leave.title = "Leave group";
    leave.onclick = (ev) => { ev.stopPropagation(); leaveGroup(t.id, t.name); };
    row.append(av, b, leave);
    list.appendChild(row);
  }
  const add = el("button", "+ New group", "chan chan-add");
  add.type = "button";
  add.onclick = newGroupModal;
  list.appendChild(add);
}

async function newGroupModal() {
  await refreshUsers(true);
  const wallet = await myWallet();
  const maxMembers = wallet.nitroActive ? 20 : 10;
  const res = await showModal({
    title: "New group DM",
    body: `Group name plus usernames, one per line. ${maxMembers} members max${wallet.nitroActive ? " with Boost" : " (up to 20 with active Boost)"}.`,
    input: true, placeholder: "Group name", maxLength: 40, okText: "Next",
    textarea: true, textareaPlaceholder: "alice\nbob"
  });
  if (!res || typeof res !== "object") return;
  const name = String(res.value || "").trim().slice(0, 40);
  const names = [...new Set(String(res.area || "").split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean))];
  if (!name) { toast("Give the group a name.", "err"); return; }
  if (!names.length) { toast("Add at least one person.", "err"); return; }
  if (names.length + 1 > maxMembers) { toast(`This group is limited to ${maxMembers} members${wallet.nitroActive ? "" : " without Boost"}.`, "err"); return; }
  const uids = [];
  for (const n of names) {
    const u = users.find((x) => x.username.toLowerCase() === n.toLowerCase());
    if (!u) { toast("No user called " + n, "err"); return; }
    if (u.id === session.user.id) { toast("You're already in.", "err"); return; }
    if (!uids.includes(u.id)) uids.push(u.id);
  }
  const { data: threadId, error } = await supabase.rpc("ping_create_group_dm", { p_name: name, p_user_ids: uids });
  if (error || !threadId) { toast("Couldn't create group: " + (error && error.message), "err"); return; }
  openGroupDM(threadId);
}

async function openGroupDM(threadId) {
  setMobileNav(false);
  view = { type: "gdm", thread: threadId };
  showView("chat-view");
  document.body.classList.add("dm-home");
  $("dm-search-wrap").classList.remove("hidden");
  $("extra-nav").classList.remove("hidden");
  gdmUnread.delete(threadId);
  paintDmUnread();
  activeServer = null;
  activeChannel = null;
  document.querySelectorAll(".server-banner").forEach((node) => node.remove());
  loadServerEmoji();
  if (msgChannel) { await supabase.removeChannel(msgChannel); msgChannel = null; }
  ensureDmSub();
  ensureGroupSub();
  renderServerRail();
  $("server-header").textContent = "Direct Messages";
  await renderDmList(true);
  const { data: thread } = await supabase.from("dm_groups").select("*").eq("id", threadId).single();
  if (!thread) { toast("That group is gone.", "err"); enterHome(); return; }
  const { data: members } = await supabase.from("dm_group_members").select("user_id").eq("thread_id", threadId).limit(20);
  const names = (members || [])
    .map((m) => users.find((x) => x.id === m.user_id))
    .filter(Boolean).map((u) => u.username);
  $("channel-hash").textContent = "👥";
  const headerAvatar = $("dm-header-avatar");
  const groupAvatar = el("span", null, "avatar group-avatar");
  if (thread.icon_url && isSafeImg(thread.icon_url)) {
    const image = document.createElement("img"); image.src = thread.icon_url; image.alt = thread.name; image.className = "group-avatar-image";
    groupAvatar.replaceChildren(image);
  } else groupAvatar.textContent = "👥";
  headerAvatar.replaceChildren(groupAvatar);
  headerAvatar.classList.remove("hidden");
  headerAvatar.removeAttribute("role");
  headerAvatar.removeAttribute("tabindex");
  headerAvatar.removeAttribute("aria-label");
  headerAvatar.onclick = null;
  headerAvatar.onkeydown = null;
  $("channel-name").textContent = thread.name;
  $("channel-name").classList.remove("profile-trigger");
  $("channel-name").removeAttribute("role");
  $("channel-name").removeAttribute("tabindex");
  $("channel-name").removeAttribute("aria-label");
  $("channel-name").onclick = () => openGroupMembers(threadId, thread.name);
  $("channel-name").style.cursor = "pointer";
  $("channel-name").title = "View members";
  $("channel-topic").textContent = names.join(", ") || "empty group";
  $("message-input").placeholder = "Message " + thread.name;
  paintAnnounceBtn();
  const box = $("messages");
  box.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  lastRenderDay = ""; lastRenderUid = ""; lastRenderTs = 0;
  msgCache.clear();
  reactionMap.clear();
  const { data } = await supabase.from("dm_group_messages").select("*")
    .eq("thread_id", threadId).order("id").limit(100);
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

async function openGroupMembers(threadId, threadName) {
  const [{ data: members }, { data: group }] = await Promise.all([
    supabase.from("dm_group_members").select("user_id").eq("thread_id", threadId).limit(20),
    supabase.from("dm_groups").select("id,name,icon_url,member_limit").eq("id", threadId).single()
  ]);
  const overlay = $("modal-overlay");
  $("modal-title").textContent = threadName + " — members";
  const body = $("modal-body");
  body.replaceChildren();
  body.className = "";
  overlay.querySelectorAll(".modal-extra-btn").forEach((b) => b.remove());
  $("modal-input").classList.add("hidden");
  const ta = $("modal-textarea");
  if (ta) ta.classList.add("hidden");
  $("modal-err").classList.add("hidden");
  const ok = $("modal-ok"), cancel = $("modal-cancel");
  ok.textContent = "Close";
  ok.classList.remove("danger");
  body.appendChild(el("div", `${(members || []).length} of ${(group && group.member_limit) || 10} members`, "muted small"));
  const editGroup = el("button", "Edit Group", "btn-secondary");
  editGroup.type = "button";
  editGroup.onclick = () => editGroupInfo(threadId, (group && group.name) || threadName);
  body.appendChild(editGroup);
  const iconButton = el("button", "Upload Group Icon · 512×512, max 2 MB", "btn-secondary");
  iconButton.type = "button";
  iconButton.onclick = () => { overlay.classList.add("hidden"); uploadGroupIcon(threadId); };
  body.appendChild(iconButton);
  if (group && group.icon_url) {
    const clearIcon = el("button", "Remove Icon", "btn-secondary");
    clearIcon.type = "button";
    clearIcon.onclick = async () => {
      const { error } = await supabase.from("dm_groups").update({ icon_url: null }).eq("id", threadId);
      if (error) { toast("Couldn't remove group icon: " + error.message, "err"); return; }
      toast("Group icon removed.", "ok");
      openGroupDM(threadId);
    };
    body.appendChild(clearIcon);
  }
  for (const m of members || []) {
    const u = users.find((x) => x.id === m.user_id);
    const row = el("div", null, "dm-thread-row");
    row.appendChild(avatarNode(u ? u.username : "?", u && u.avatar_emoji, (u && u.equipped) || {}, u && u.avatar_url));
    row.appendChild(el("span", u ? u.username : "unknown"));
    body.appendChild(row);
  }
  const add = el("button", "+ Add member", "btn-secondary");
  add.type = "button";
  add.style.marginTop = "10px";
  add.onclick = async () => {
    if ((members || []).length >= 20) { toast("This group is full (20 members max).", "err"); return; }
    const name = await showModal({ title: "Add to group", body: "Enter their exact username.", input: true, placeholder: "username", okText: "Add" });
    if (!name) return;
    await refreshUsers(true);
    const u = users.find((x) => x.username.toLowerCase() === String(name).toLowerCase());
    if (!u) { toast("No user called " + name, "err"); return; }
    const { error } = await supabase.rpc("ping_add_group_dm_members", { p_thread_id: threadId, p_user_ids: [u.id] });
    if (error) toast("Couldn't add: " + error.message, "err");
    else { toast(u.username + " added.", "ok"); openGroupDM(threadId); }
  };
  body.appendChild(add);
  overlay.classList.remove("hidden");
  const done = () => {
    overlay.classList.add("hidden");
    ok.onclick = cancel.onclick = overlay.onclick = null;
    body.className = "muted small";
  };
  cancel.onclick = done;
  overlay.onclick = (e) => { if (e.target === overlay) done(); };
  ok.onclick = done;
}

async function editGroupInfo(threadId, currentName) {
  const name = await showModal({ title: "Edit group name", body: "Everyone in this group can change its name.", input: true, initial: currentName, placeholder: "Group name", maxLength: 40, okText: "Save" });
  if (name === null || !String(name).trim()) return;
  const { error } = await supabase.from("dm_groups").update({ name: String(name).trim().slice(0, 40) }).eq("id", threadId);
  if (error) { toast("Couldn't rename group: " + error.message, "err"); return; }
  toast("Group name updated.", "ok");
  openGroupDM(threadId);
}
async function uploadGroupIcon(threadId) {
  const pick = document.createElement("input");
  pick.type = "file"; pick.accept = "image/*";
  pick.onchange = async () => {
    const file = pick.files && pick.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) { toast("Choose an image up to 2 MB.", "err"); return; }
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 48) || "group-icon";
      const path = `group-icons/${threadId}/${Date.now()}_${safe}`;
      const { error: uploadError } = await supabase.storage.from("chat-uploads").upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      const { error } = await supabase.from("dm_groups").update({ icon_url: data.publicUrl }).eq("id", threadId);
      if (error) throw error;
      toast("Group icon updated.", "ok");
      openGroupDM(threadId);
    } catch (error) { toast("Couldn't upload group icon: " + storageErrorMessage(error), "err"); }
  };
  pick.click();
}

async function leaveGroup(threadId, threadName) {
  const yes = await showModal({ title: "Leave " + threadName + "?", body: "You can be re-added later.", okText: "Leave", danger: true });
  if (yes !== true) return;
  const { error } = await supabase.from("dm_group_members").delete().eq("thread_id", threadId).eq("user_id", session.user.id);
  if (error) { toast("Couldn't leave: " + error.message, "err"); return; }
  if (view.type === "gdm" && view.thread === threadId) enterHome();
  else renderDmList(false);
}

/* ---------------- server events + RSVPs ---------------- */
let eventSub = null;
function ensureEventSub() {
  if (eventSub || !supabase || !session) return;
  eventSub = supabase.channel("events-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "server_events" }, () => {
      if (!document.getElementById("events-view").classList.contains("hidden") && activeServer) renderEvents();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, () => {
      if (!document.getElementById("events-view").classList.contains("hidden") && activeServer) renderEvents();
    })
    .subscribe();
}
function canManageEvents() {
  return !!activeServer && (canManageServer(activeServer) || (profile && (profile.role === "admin" || profile.role === "mod")));
}
async function openEvents() {
  if (!activeServer || view.type !== "channel") return;
  showView("events-view");
  $("events-server").textContent = "in " + activeServer.name;
  await renderEvents();
}
async function createEventWizard() {
  if (!activeServer || !canManageEvents()) return;
  const overlay = $("modal-overlay"), card = $("modal-card"), title = $("modal-title"), body = $("modal-body");
  const ok = $("modal-ok"), cancel = $("modal-cancel");
  card.classList.add("event-wizard-modal");
  title.classList.remove("hidden");
  title.textContent = "Create Event";
  body.replaceChildren();
  body.className = "event-wizard-body";
  $("modal-input").classList.add("hidden");
  $("modal-textarea").classList.add("hidden");
  $("modal-err").classList.add("hidden");
  overlay.querySelectorAll(".modal-extra-btn").forEach((button) => button.remove());
  cancel.textContent = "Cancel";
  ok.textContent = "Next";
  ok.disabled = false;
  ok.classList.remove("danger");
  let step = 0, locationType = "voice", coverUrl = "";
  const state = { title: "", description: "", location: "", channelId: "", start: "", end: "", frequency: "once" };
  const inLocalInput = (date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };
  const startDate = new Date(Date.now() + 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  state.start = inLocalInput(startDate);
  state.end = inLocalInput(endDate);
  const close = () => {
    overlay.classList.add("hidden");
    card.classList.remove("event-wizard-modal");
    title.classList.remove("hidden");
    body.className = "muted small";
    ok.onclick = cancel.onclick = overlay.onclick = null;
    ok.disabled = false;
  };
  const progress = () => {
    const bar = el("div", null, "event-wizard-progress");
    ["Location", "Event Info", "Review"].forEach((label, i) => {
      const stepNode = el("div", null, "event-wizard-step" + (i === step ? " active" : i < step ? " done" : ""));
      const line = el("span", null, "event-wizard-line");
      line.style.width = "100%";
      stepNode.appendChild(line);
      stepNode.appendChild(el("span", label));
      bar.appendChild(stepNode);
    });
    return bar;
  };
  const field = (labelText, input) => {
    const label = el("label", null, "event-wizard-field");
    label.appendChild(el("span", labelText));
    label.appendChild(input);
    return label;
  };
  const paint = () => {
    body.replaceChildren(progress());
    if (step === 0) {
      body.appendChild(el("h2", "Where is your event?"));
      body.appendChild(el("p", "Choose a voice channel or add a location/link.", "muted small"));
      const voiceCard = el("button", null, "event-location-choice" + (locationType === "voice" ? " selected" : ""));
      voiceCard.type = "button";
      voiceCard.append(el("span", "◖", "event-location-icon"), el("span", "Voice Channel", "event-location-name"), el("span", "Hang out with voice, video and screen share.", "muted small"));
      voiceCard.onclick = () => { locationType = "voice"; paint(); };
      const otherCard = el("button", null, "event-location-choice" + (locationType === "other" ? " selected" : ""));
      otherCard.type = "button";
      otherCard.append(el("span", "⌖", "event-location-icon"), el("span", "Somewhere Else", "event-location-name"), el("span", "Text channel, external link or in-person location.", "muted small"));
      otherCard.onclick = () => { locationType = "other"; paint(); };
      body.append(voiceCard, otherCard);
      if (locationType === "voice") {
        const select = document.createElement("select");
        select.className = "event-wizard-input";
        select.appendChild(el("option", "Select a voice channel"));
        select.options[0].value = "";
        for (const channel of channels.filter((item) => item.kind === "voice")) {
          const option = el("option", channel.name); option.value = String(channel.id); select.appendChild(option);
        }
        select.value = state.channelId;
        select.onchange = () => { state.channelId = select.value; };
        body.appendChild(field("Select a channel", select));
      } else {
        const input = document.createElement("input"); input.className = "event-wizard-input"; input.maxLength = 160; input.placeholder = "Add a location, link or something."; input.value = state.location;
        input.oninput = () => { state.location = input.value; };
        body.appendChild(field("Enter a location", input));
      }
    } else if (step === 1) {
      body.appendChild(el("h2", "What's your event about?"));
      body.appendChild(el("p", "Add the details so people know what to expect.", "muted small"));
      const eventTitle = document.createElement("input"); eventTitle.className = "event-wizard-input"; eventTitle.maxLength = 80; eventTitle.placeholder = "What's your event?"; eventTitle.value = state.title;
      eventTitle.oninput = () => { state.title = eventTitle.value; };
      body.appendChild(field("Event Topic *", eventTitle));
      const dates = el("div", null, "event-date-grid");
      const start = document.createElement("input"); start.type = "datetime-local"; start.className = "event-wizard-input"; start.value = state.start; start.oninput = () => { state.start = start.value; };
      const end = document.createElement("input"); end.type = "datetime-local"; end.className = "event-wizard-input"; end.value = state.end; end.oninput = () => { state.end = end.value; };
      dates.append(field("Start date & time *", start), field("End date & time *", end));
      body.appendChild(dates);
      const frequency = document.createElement("select"); frequency.className = "event-wizard-input";
      for (const [value, label] of [["once", "Does not repeat"], ["weekly", "Weekly"], ["biweekly", "Every other week"], ["monthly", "Monthly"], ["yearly", "Annually"]]) { const o = el("option", label); o.value = value; frequency.appendChild(o); }
      frequency.value = state.frequency; frequency.onchange = () => { state.frequency = frequency.value; };
      body.appendChild(field("Event Frequency", frequency));
      const desc = document.createElement("textarea"); desc.className = "event-wizard-input"; desc.maxLength = 500; desc.rows = 3; desc.placeholder = "Tell people a little more about your event."; desc.value = state.description; desc.oninput = () => { state.description = desc.value; };
      body.appendChild(field("Description", desc));
      const coverRow = el("div", null, "event-cover-upload-row");
      coverRow.appendChild(el("div", "Cover image · recommended 800 × 320 px · PNG/JPG/GIF · max 3 MB", "muted small"));
      if (coverUrl && isSafeImg(coverUrl)) { const img = document.createElement("img"); img.src = coverUrl; img.alt = "Event cover preview"; coverRow.appendChild(img); }
      const upload = el("button", coverUrl ? "Change cover" : "Upload cover image", "btn-secondary"); upload.type = "button";
      upload.onclick = () => {
        const pick = document.createElement("input"); pick.type = "file"; pick.accept = "image/png,image/jpeg,image/gif,image/webp";
        pick.onchange = async () => {
          const file = pick.files && pick.files[0]; if (!file) return;
          if (!file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) { toast("Cover images must be images under 3 MB.", "err"); return; }
          upload.disabled = true; upload.textContent = "Uploading…";
          try {
            const path = `event-covers/${activeServer.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 48)}`;
            const { error } = await supabase.storage.from("chat-uploads").upload(path, file);
            if (error) throw error;
            coverUrl = supabase.storage.from("chat-uploads").getPublicUrl(path).data.publicUrl;
            paint();
          } catch (error) { toast("Cover upload failed: " + storageErrorMessage(error), "err"); }
          finally { upload.disabled = false; }
        };
        pick.click();
      };
      coverRow.appendChild(upload); body.appendChild(coverRow);
    } else {
      body.appendChild(el("h2", "Review your event"));
      body.appendChild(el("p", "Check everything before you publish.", "muted small"));
      const review = el("div", null, "event-review-card");
      if (coverUrl && isSafeImg(coverUrl)) { const img = document.createElement("img"); img.src = coverUrl; img.alt = ""; review.appendChild(img); }
      review.appendChild(el("div", state.title, "event-title"));
      const where = locationType === "voice"
        ? (channels.find((channel) => String(channel.id) === state.channelId)?.name || "Voice channel")
        : state.location;
      review.appendChild(el("div", `${where} · ${new Date(state.start).toLocaleString()}`, "muted small"));
      review.appendChild(el("div", state.description || "No description", "muted small"));
      review.appendChild(el("div", state.frequency === "once" ? "Does not repeat" : `Repeats ${state.frequency}`, "event-frequency"));
      body.appendChild(review);
    }
  };
  const back = el("button", "Back", "btn-secondary event-wizard-back hidden");
  back.type = "button";
  ok.parentElement.insertBefore(back, cancel);
  back.onclick = () => {
    if (step > 0) {
      step--;
      back.classList.toggle("hidden", step === 0);
      ok.textContent = step === 2 ? "Create Event" : "Next";
      paint();
    }
  };
  const finish = () => { overlay.classList.add("hidden"); card.classList.remove("event-wizard-modal"); back.remove(); body.className = "muted small"; ok.onclick = cancel.onclick = overlay.onclick = null; };
  card.classList.add("event-wizard-modal");
  overlay.classList.remove("hidden");
  cancel.textContent = "Cancel"; cancel.onclick = finish;
  overlay.onclick = (event) => { if (event.target === overlay) finish(); };
  ok.textContent = "Next"; ok.onclick = async () => {
    if (step === 0) {
      if (locationType === "voice" && !state.channelId) { toast("Select a voice channel.", "err"); return; }
      if (locationType === "other" && !state.location.trim()) { toast("Enter a location or link.", "err"); return; }
      step = 1; back.classList.remove("hidden"); paint(); return;
    }
    if (step === 1) {
      if (!state.title.trim()) { toast("Enter an event topic.", "err"); return; }
      const start = new Date(state.start), end = new Date(state.end);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) { toast("Choose a valid end time after the start time.", "err"); return; }
      step = 2; ok.textContent = "Create Event"; paint(); return;
    }
    ok.disabled = true;
    const startsAt = new Date(state.start).toISOString(), endsAt = new Date(state.end).toISOString();
    const { error } = await supabase.from("server_events").insert({
      server_id: activeServer.id, title: state.title.trim().slice(0, 80), description: state.description.trim().slice(0, 500),
      starts_at: startsAt, ends_at: endsAt, created_by: session.user.id,
      location_type: locationType, location: locationType === "voice" ? (channels.find((channel) => String(channel.id) === state.channelId)?.name || "Voice") : state.location.trim(),
      channel_id: locationType === "voice" ? Number(state.channelId) : null, frequency: state.frequency, cover_url: coverUrl || null
    });
    if (error) { ok.disabled = false; toast("Couldn't create event: " + error.message + " (run the latest schema)", "err"); return; }
    finish();
    toast("Event created.", "ok");
    renderEvents();
  };
  paint();
}
function eventCountdown(startsAt) {
  const ms = new Date(startsAt).getTime() - Date.now();
  if (ms <= 0) return "Started";
  const m = Math.floor(ms / 6e4), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `in ${d}d ${h % 24}h`;
  if (h > 0) return `in ${h}h ${m % 60}m`;
  return `in ${Math.max(1, m)}m`;
}
async function renderEvents() {
  const list = $("events-list"), form = $("events-create");
  list.innerHTML = "";
  form.innerHTML = "";
  if (!activeServer) return;
  if (canManageEvents()) {
    const card = el("div", null, "event-create");
    card.appendChild(el("div", "Plan something together", "event-create-title"));
    card.appendChild(el("p", "Create a scheduled event and let members RSVP.", "muted small"));
    const create = el("button", "＋ Create Event", "btn-primary");
    create.type = "button";
    create.onclick = createEventWizard;
    card.appendChild(create);
    form.appendChild(card);
  }
  const { data: events } = await supabase.from("server_events").select("*")
    .eq("server_id", activeServer.id).order("starts_at").limit(50);
  const ids = (events || []).map((e) => e.id);
  let rsvps = [];
  if (ids.length) {
    const r = await supabase.from("event_rsvps").select("event_id,user_id,status").in("event_id", ids).limit(2000);
    rsvps = r.data || [];
  }
  const now = Date.now();
  const upcoming = (events || []).filter((e) => new Date(e.starts_at).getTime() >= now - 36e5);
  const past = (events || []).filter((e) => new Date(e.starts_at).getTime() < now - 36e5).reverse();
  if (!events || !events.length) {
    list.appendChild(el("div", "No events yet.", "empty-note"));
    return;
  }
  for (const e of [...upcoming, ...past]) {
    const mine = rsvps.find((r) => r.event_id === e.id && session && r.user_id === session.user.id);
    const going = rsvps.filter((r) => r.event_id === e.id && r.status === "going").length;
    const interested = rsvps.filter((r) => r.event_id === e.id && r.status === "interested").length;
    const card = el("div", null, "event-card");
    if (e.cover_url && isSafeImg(e.cover_url)) {
      const cover = document.createElement("img"); cover.src = e.cover_url; cover.alt = ""; cover.className = "event-cover"; cover.loading = "lazy"; card.appendChild(cover);
    }
    const head = el("div", null, "event-head");
    head.appendChild(el("div", e.title, "event-title"));
    head.appendChild(el("div", eventCountdown(e.starts_at) + " · " + fmtTime(e.starts_at), "muted small"));
    card.appendChild(head);
    if (e.location) card.appendChild(el("div", (e.location_type === "voice" ? "🔊 " : "📍 ") + e.location, "event-location muted small"));
    if (e.frequency && e.frequency !== "once") card.appendChild(el("span", e.frequency, "event-frequency"));
    if (e.description) card.appendChild(el("div", e.description, "event-desc"));
    const row = el("div", null, "event-rsvp-row");
    const gBtn = el("button", `Going · ${going}`, "mini-btn" + (mine && mine.status === "going" ? " good" : ""));
    gBtn.type = "button";
    gBtn.onclick = () => rsvpEvent(e.id, mine && mine.status === "going" ? null : "going");
    const iBtn = el("button", `Interested · ${interested}`, "mini-btn" + (mine && mine.status === "interested" ? " good" : ""));
    iBtn.type = "button";
    iBtn.onclick = () => rsvpEvent(e.id, mine && mine.status === "interested" ? null : "interested");
    row.append(gBtn, iBtn);
    if (canManageEvents()) {
      const del = el("button", "Delete", "mini-btn danger");
      del.type = "button";
      del.onclick = async () => {
        const yes = await showModal({ title: "Delete event?", body: "RSVPs go with it.", okText: "Delete", danger: true });
        if (yes !== true) return;
        const { error } = await supabase.from("server_events").delete().eq("id", e.id);
        if (error) toast("Couldn't delete: " + error.message, "err");
        else renderEvents();
      };
      row.appendChild(del);
    }
    card.appendChild(row);
    list.appendChild(card);
  }
}
async function rsvpEvent(eventId, status) {
  if (!session) return;
  await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", session.user.id);
  if (status) {
    const { error } = await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: session.user.id, status });
    if (error) { toast("Couldn't RSVP: " + error.message, "err"); return; }
  }
  renderEvents();
}

/* Custom server emoji: loaded per server, rendered as :name: via richInline. */
const serverEmoji = new Map(); // name -> image_url
async function loadServerEmoji() {
  serverEmoji.clear();
  const box = document.querySelector(".server-emote-box");
  if (box) { box.innerHTML = ""; box.classList.add("hidden"); }
  if (!activeServer || view.type !== "channel") return;
  const { data } = await supabase.from("server_emoji").select("name,image_url")
    .eq("server_id", activeServer.id).limit(100);
  for (const r of data || []) {
    if (/^[a-z0-9_]{2,24}$/.test(r.name) && typeof r.image_url === "string" && r.image_url.startsWith("https://"))
      serverEmoji.set(r.name, r.image_url);
  }
  if (!box || !serverEmoji.size) return;
  box.classList.remove("hidden");
  box.appendChild(el("div", `${activeServer.name} emoji — type :name:`, "server-emote-title"));
  for (const [name, url] of serverEmoji) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = `:${name}:`;
    img.title = `:${name}:`;
    img.loading = "lazy";
    img.className = "em custom-emote";
    img.onclick = () => {
      const inp = $("message-input");
      inp.value += `:${name}:`;
      inp.focus();
    };
    box.appendChild(img);
  }
  if (canManageServer(activeServer)) {
    const up = el("button", "+ Upload emoji", "mini-btn");
    up.type = "button";
    up.onclick = uploadServerEmoji;
    box.appendChild(up);
  }
  loadServerStickers();
}
async function uploadServerEmoji() {
  const lvl = serverBoostLevel(activeServer.id);
  const cap = lvl >= 3 ? 50 : lvl >= 2 ? 25 : lvl >= 1 ? 15 : 10;
  if (serverEmoji.size >= cap) { toast(`Emoji slots full (${cap}). Boost to Level ${lvl >= 3 ? 3 : lvl + 1} for more.`, "err"); return; }
  const name = await showModal({ title: "Add server emoji", body: "Short name, lowercase letters/numbers/underscores.", input: true, placeholder: "name", okText: "Next" });
  if (!name || !/^[a-z0-9_]{2,24}$/.test(name)) {
    if (name) toast("Bad emoji name.", "err");
    return;
  }
  const pick = document.createElement("input");
  pick.type = "file";
  pick.accept = "image/*";
  pick.onchange = async () => {
    const f = pick.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 1024 * 1024) { toast("Images only, max 1 MB.", "err"); return; }
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
      const path = `emoji/${activeServer.id}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, f);
      if (error) throw error;
      const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("server_emoji")
        .insert({ server_id: activeServer.id, name, image_url: data.publicUrl, created_by: session.user.id });
      if (dbErr) throw dbErr;
      toast(`:${name}: added.`, "ok");
      loadServerEmoji();
    } catch (err) {
      toast("Emoji upload failed: " + (err.message || err), "err");
    }
  };
  pick.click();
}

/* Stickers: larger per-server images sent as [sticker:<id>] messages. */
const serverStickers = new Map(); // id -> { name, image_url }
async function loadServerStickers() {
  serverStickers.clear();
  if (!activeServer || view.type !== "channel") return;
  try {
    const { data } = await supabase.from("server_stickers").select("id,name,image_url")
      .eq("server_id", activeServer.id).limit(60);
    for (const r of data || []) {
      if (r && typeof r.image_url === "string" && r.image_url.startsWith("https://"))
        serverStickers.set(+r.id, { name: r.name, image_url: r.image_url });
    }
  } catch { /* v24 table missing — stickers unavailable until upgrade */ }
  const box = document.querySelector(".server-emote-box");
  if (!box || !serverStickers.size) return;
  box.classList.remove("hidden");
  box.appendChild(el("div", `${activeServer.name} stickers — tap to send`, "server-emote-title"));
  for (const [id, st] of serverStickers) {
    const img = document.createElement("img");
    img.src = st.image_url;
    img.alt = `:${st.name}:`;
    img.title = `:${st.name}: (send sticker)`;
    img.loading = "lazy";
    img.className = "em sticker-thumb";
    img.onclick = () => sendSticker(id);
    box.appendChild(img);
  }
  if (canManageServer(activeServer)) {
    const up = el("button", "+ Upload sticker", "mini-btn");
    up.type = "button";
    up.onclick = uploadServerSticker;
    box.appendChild(up);
  }
}
async function sendSticker(id) {
  if (!serverStickers.has(id)) return;
  const prefix = spoilerNextMessage ? "[spoiler]" : "";
  await sendMessageContent(prefix + `[sticker:${id}]`, "sticker");
}
async function uploadServerSticker() {
  const lvl = serverBoostLevel(activeServer.id);
  const cap = lvl >= 3 ? 30 : lvl >= 2 ? 15 : 5;
  if (serverStickers.size >= cap) { toast(`Sticker slots full (${cap}). Boost to Level ${lvl >= 2 ? 3 : 2} for more.`, "err"); return; }
  const name = await showModal({ title: "Add server sticker", body: "Short name, lowercase letters/numbers/underscores.", input: true, placeholder: "name", okText: "Next" });
  if (!name || !/^[a-z0-9_]{2,24}$/.test(name)) {
    if (name) toast("Bad sticker name.", "err");
    return;
  }
  const pick = document.createElement("input");
  pick.type = "file";
  pick.accept = "image/*";
  pick.onchange = async () => {
    const f = pick.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 2 * 1024 * 1024) { toast("Images only, max 2 MB.", "err"); return; }
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
      const path = `stickers/${activeServer.id}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, f);
      if (error) throw error;
      const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("server_stickers")
        .insert({ server_id: activeServer.id, name, image_url: data.publicUrl, created_by: session.user.id });
      if (dbErr) throw dbErr;
      toast(`:${name}: sticker added.`, "ok");
      loadServerEmoji();
    } catch (err) {
      toast("Sticker upload failed: " + (err.message || err), "err");
    }
  };
  pick.click();
}

/* Discord-style picture crop: zoom slider + drag to reposition. Pure CSS
   transform, so GIFs keep animating. Saved into equipped.avatarCrop. */
function openAvatarCrop(url) {
  const overlay = $("modal-overlay");
  $("modal-title").textContent = "Adjust picture";
  const body = $("modal-body");
  body.replaceChildren();
  body.className = "";
  overlay.querySelectorAll(".modal-extra-btn").forEach((b) => b.remove());
  $("modal-input").classList.add("hidden");
  const ta = $("modal-textarea");
  if (ta) ta.classList.add("hidden");
  $("modal-err").classList.add("hidden");
  const ok = $("modal-ok"), cancel = $("modal-cancel");
  ok.textContent = "Save crop";
  ok.classList.remove("danger");

  const cur = (profile.equipped && profile.equipped.avatarCrop) || {};
  const crop = {
    z: Math.min(3, Math.max(1, Number(cur.z) || 1)),
    cx: Math.min(1, Math.max(0, Number(cur.cx) ?? 0.5)),
    cy: Math.min(1, Math.max(0, Number(cur.cy) ?? 0.5))
  };
  if (!Number.isFinite(crop.cx)) crop.cx = 0.5;
  if (!Number.isFinite(crop.cy)) crop.cy = 0.5;

  const stage = el("div", null, "crop-stage");
  const frame = el("div", null, "avatar crop-frame");
  const img = document.createElement("img");
  img.src = url;
  img.alt = "Crop preview";
  img.draggable = false;
  frame.appendChild(img);
  stage.appendChild(frame);
  stage.appendChild(el("div", "Drag to reposition · slider to zoom", "muted small crop-hint"));
  const zoomRow = el("div", null, "crop-zoom-row");
  zoomRow.appendChild(el("span", "Zoom", "muted small"));
  const zoom = document.createElement("input");
  zoom.type = "range";
  zoom.min = "1";
  zoom.max = "3";
  zoom.step = "0.05";
  zoom.value = String(crop.z);
  zoom.setAttribute("aria-label", "Crop zoom");
  zoomRow.appendChild(zoom);
  body.append(stage, zoomRow);

  const paint = () => applyAvatarCrop(img, crop);
  paint();
  zoom.oninput = () => { crop.z = Number(zoom.value); paint(); };
  let dragging = false;
  const point = (ev) => {
    const r = frame.getBoundingClientRect();
    crop.cx = Math.min(1, Math.max(0, (ev.clientX - r.left) / Math.max(1, r.width)));
    crop.cy = Math.min(1, Math.max(0, (ev.clientY - r.top) / Math.max(1, r.height)));
    paint();
  };
  frame.style.cursor = "grab";
  frame.onpointerdown = (ev) => { dragging = true; frame.setPointerCapture(ev.pointerId); point(ev); };
  frame.onpointermove = (ev) => { if (dragging) point(ev); };
  frame.onpointerup = () => { dragging = false; };

  overlay.classList.remove("hidden");
  const done = (saved) => {
    overlay.classList.add("hidden");
    ok.onclick = cancel.onclick = overlay.onclick = null;
    body.className = "muted small";
    if (saved) {
      const eq = { ...(profile.equipped || {}), avatarCrop: { z: crop.z, cx: crop.cx, cy: crop.cy } };
      supabase.from("profiles").update({ equipped: eq }).eq("id", profile.id).then(({ error }) => {
        if (error) { toast("Couldn't save crop: " + error.message, "err"); return; }
        profile.equipped = eq;
        const u = users.find((x) => x.id === profile.id);
        if (u) u.equipped = eq;
        paintUserPanelAvatar();
        refreshUsers(true);
        toast("Picture crop saved.", "ok");
      });
    }
  };
  cancel.onclick = () => done(false);
  overlay.onclick = (e) => { if (e.target === overlay) done(false); };
  ok.onclick = () => done(true);
}

/* Single-URL messages get a lightweight embed card (favicon + domain).
   No fetching happens here — just safe DOM built from the URL string. */
function buildLinkEmbed(body) {
  const text = String(body || "").trim();
  if (!/^https?:\/\/\S+$/i.test(text) || /\s/.test(text)) return null;
  let url;
  try { url = new URL(text); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isSafeImg(text)) return null; // images render as images, not cards
  const card = el("a", null, "link-embed");
  card.href = url.toString();
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  const icon = document.createElement("img");
  icon.className = "link-embed-icon";
  icon.alt = "";
  icon.loading = "lazy";
  icon.src = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(url.hostname) + "&sz=64";
  icon.onerror = () => icon.remove();
  card.appendChild(icon);
  const meta = el("span", null, "link-embed-meta");
  meta.appendChild(el("span", url.hostname.replace(/^www\./, ""), "link-embed-domain"));
  meta.appendChild(el("span", text.length > 60 ? text.slice(0, 60) + "…" : text, "link-embed-url muted small"));
  card.appendChild(meta);
  return card;
}

/* ---------------- direct messages (private, never on dashboard) ---------------- */
function ensureDmSub() {
  if (dmChannel || !supabase) return;
  dmChannel = supabase.channel("my-dms")
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (!payload || !payload.user || !payload.thread) return;
      if (profile && payload.user === profile.username) return;
      if (!dmTyping.has(payload.thread)) dmTyping.set(payload.thread, new Map());
      dmTyping.get(payload.thread).set(payload.user, Date.now());
      const mine = view.type === "dm" ? view.uid : view.type === "gdm" ? gdmTypingKey(view.thread) : null;
      if (mine && mine === payload.thread) renderTyping();
    })
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
          const rawPreview = String(d.content || "");
          const preview = rawPreview.startsWith("[spoiler]") || rawPreview.includes("||") ? "Sent a spoiler"
            : rawPreview.startsWith("[img]") ? "Sent an image" : rawPreview.startsWith("[file]") ? "Sent a file" : rawPreview;
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
  showView("chat-view");
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
  document.querySelectorAll(".server-banner").forEach((n) => n.remove());
  loadServerEmoji();
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

let dmHomeFilter = "all"; // 'all' | 'friends'
let cachedCoins = 0;
function renderHomeNav(list) {
  const nav = el("div", null, "home-nav");
  const row = (iconName, label, opts = {}) => {
    const b = el("button", null, "chan home-nav-row" + (opts.active ? " active" : ""));
    b.type = "button";
    const ic = el("span", null, "home-nav-icon");
    ic.appendChild(icon(iconName));
    b.appendChild(ic);
    b.appendChild(el("span", label, "home-nav-label"));
    if (opts.badge) {
      const pill = el("span", opts.badge, "home-nav-badge");
      b.appendChild(pill);
    }
    if (opts.pill) {
      const p = el("span", opts.pill, "home-nav-pill");
      b.appendChild(p);
    }
    b.onclick = opts.onClick;
    return b;
  };
  const incoming = friendships.filter((r) => r.status === "pending" && r.to_user === session.user.id).length;
  nav.appendChild(row("users", "Friends", {
    active: false,
    badge: incoming > 0 ? (incoming > 99 ? "99+" : String(incoming)) : null,
    onClick: () => openFriends("all")
  }));
  const nitroOn = !!(profile.equipped && (profile.equipped.boost || profile.equipped.nitro));
  nav.appendChild(row("rocket", "Boost", {
    pill: nitroOn ? "BOOST" : null,
    onClick: () => openNitro()
  }));
  const shopRow = row("cart", "Shop", { onClick: () => openShop() });
  const coin = el("span", `${cachedCoins} 🪙`, "coin-pill");
  coin.id = "coin-balance";
  shopRow.appendChild(coin);
  nav.appendChild(shopRow);
  nav.appendChild(row("swords", "Quests", { onClick: () => openQuests() }));
  nav.appendChild(row("gamepad", "Games & Apps", { onClick: () => openGames() }));
  list.appendChild(nav);
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
      avatarButton.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}, u.avatar_url));
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
  renderHomeNav(list);
  if (dmHomeFilter === "friends") {
    const back = el("button", "← All conversations", "chan chan-add");
    back.type = "button";
    back.onclick = () => { dmHomeFilter = "all"; renderDmList(false); };
    list.appendChild(back);
    renderFriendsSection(list);
    return;
  }
  await renderGroupSection(list);
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
    avatarButton.appendChild(avatarNode(name, u && u.avatar_emoji, (u && u.equipped) || {}, u && u.avatar_url));
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

/* ---------------- friends (requests + list, no read receipts) ---------------- */
let friendships = [];
let friendSub = null;
/* server memberships for the signed-in user (server_id set) */
let myMemberships = new Set();
async function loadMemberships() {
  myMemberships = new Set();
  if (!session) return;
  const { data } = await supabase.from("server_members").select("server_id").eq("user_id", session.user.id).limit(500);
  for (const r of data || []) myMemberships.add(r.server_id);
}
function isMember(serverId) {
  return myMemberships.has(serverId);
}

function friendStatus(uid) {
  if (!session || uid === session.user.id) return "self";
  const row = friendships.find((r) => r.from_user === uid || r.to_user === uid);
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.from_user === session.user.id ? "pending-out" : "pending-in";
}
function friendIds() {
  const s = new Set();
  if (!session) return s;
  for (const r of friendships) {
    if (r.status !== "accepted") continue;
    s.add(r.from_user === session.user.id ? r.to_user : r.from_user);
  }
  return s;
}
function memberRoleColor(uid) {
  if (!activeServer || !serverRoleAssignments.length) return null;
  const roleIds = serverRoleAssignments.filter((a) => a.user_id === uid).map((a) => a.role_id);
  for (const rid of roleIds) {
    const role = serverRoleRows.find((r) => r.id === rid);
    if (role && role.color) return role.color;
  }
  return null;
}
/* Blocked users: load once, refresh on block/unblock, filter their messages. */
let blockedIds = new Set();
async function loadBlocks() {
  if (!session) return;
  try {
    const { data } = await supabase.from("user_blocks").select("blocked_user_id").eq("user_id", session.user.id);
    blockedIds = new Set((data || []).map((r) => r.blocked_user_id));
  } catch { blockedIds = new Set(); }
}
function isBlocked(uid) { return blockedIds.has(uid); }
async function toggleBlockUser(uid) {
  if (!session || uid === session.user.id) return;
  const u = users.find((x) => x.id === uid);
  const name = u ? u.username : "this user";
  if (isBlocked(uid)) {
    const { error } = await supabase.from("user_blocks").delete().eq("user_id", session.user.id).eq("blocked_user_id", uid);
    if (error) { toast("Couldn't unblock: " + error.message, "err"); return; }
    blockedIds.delete(uid);
    toast("Unblocked " + name + ".", "ok");
  } else {
    const yes = await showModal({ title: "Block " + name + "?", body: "You won't see their messages. They won't know you blocked them.", okText: "Block", danger: true });
    if (yes !== true) return;
    const { error } = await supabase.from("user_blocks").insert({ user_id: session.user.id, blocked_user_id: uid });
    if (error) { toast("Couldn't block: " + error.message, "err"); return; }
    blockedIds.add(uid);
    toast("Blocked " + name + ".", "ok");
  }
  if (view.type === "dm" && !view.uid) renderDmList(false);
  if (view.type === "dm" && view.uid === uid) openDM(uid);
  refreshFriendsView();
}
async function loadFriendships() {
  if (!session) return;
  const { data, error } = await supabase.from("friend_requests").select("*")
    .or(`from_user.eq.${session.user.id},to_user.eq.${session.user.id}`).limit(500);
  if (!error) friendships = data || [];
}
function ensureFriendSub() {
  if (friendSub || !supabase || !session) return;
  friendSub = supabase.channel("my-friends")
    .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, async (payload) => {
      await loadFriendships();
      if (payload.eventType === "INSERT" && payload.new && payload.new.to_user === session.user.id) {
        const u = users.find((x) => x.id === payload.new.from_user);
        toast(`Friend request from ${u ? u.username : "someone"}.`);
      }
      if (view.type === "dm" && !view.uid) renderDmList(false);
      refreshFriendsView();
    })
    .subscribe();
}
async function sendFriendRequestTo(uid) {
  if (!session || uid === session.user.id) return;
  const existing = friendships.find((r) => r.from_user === uid || r.to_user === uid);
  if (existing) {
    if (existing.status === "accepted") { toast("You're already friends.", "err"); return; }
    if (existing.from_user === session.user.id) { toast("Request already sent.", "err"); return; }
    return answerFriendRequest(existing.id, true); // they asked us → accept
  }
  const { error } = await supabase.from("friend_requests").insert({ from_user: session.user.id, to_user: uid });
  if (error) toast("Couldn't send request: " + error.message, "err");
  else {
    toast("Friend request sent.", "ok");
    await loadFriendships();
    if (view.type === "dm" && !view.uid) renderDmList(false);
    refreshFriendsView();
  }
}
async function answerFriendRequest(id, accept) {
  const { error } = accept
    ? await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", id)
    : await supabase.from("friend_requests").delete().eq("id", id);
  if (error) { toast("Couldn't update request: " + error.message, "err"); return; }
  await loadFriendships();
  if (view.type === "dm" && !view.uid) renderDmList(false);
  refreshFriendsView();
}
async function removeFriend(uid) {
  const row = friendships.find((r) => (r.from_user === uid || r.to_user === uid) && r.status === "accepted");
  if (!row) return;
  const u = users.find((x) => x.id === uid);
  const yes = await showModal({
    title: "Remove friend?",
    body: `Remove ${u ? u.username : "this user"} from your friends? You can re-add them later.`,
    okText: "Remove", danger: true
  });
  if (yes !== true) return;
  const { error } = await supabase.from("friend_requests").delete().eq("id", row.id);
  if (error) { toast("Couldn't remove friend: " + error.message, "err"); return; }
  await loadFriendships();
  if (view.type === "dm" && !view.uid) renderDmList(false);
  refreshFriendsView();
}
async function addFriendModal() {
  await refreshUsers(true);
  const name = await showModal({ title: "Add friend", body: "Enter their exact username.", input: true, placeholder: "username", okText: "Send request" });
  if (!name) return;
  const u = users.find((x) => x.username.toLowerCase() === name.toLowerCase());
  if (!u) { toast("No user called " + name, "err"); return; }
  sendFriendRequestTo(u.id);
}
function renderFriendsSection(list) {
  const friends = [...friendIds()]
    .map((id) => users.find((x) => x.id === id))
    .filter(Boolean)
    .sort((a, b) => a.username.localeCompare(b.username));
  const incoming = friendships.filter((r) => r.status === "pending" && r.to_user === session.user.id);
  list.appendChild(el("div", "FRIENDS" + (friends.length ? ` — ${friends.length}` : ""), "chan-group"));
  for (const u of friends) {
    const row = el("div", null, "dm-thread-row");
    const avatarButton = el("button", null, "dm-avatar-button");
    avatarButton.type = "button";
    avatarButton.setAttribute("aria-label", "View " + u.username + "'s profile");
    avatarButton.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}, u.avatar_url));
    avatarButton.onclick = () => openProfile(u.id);
    const b = el("button", null, "chan dm-thread dm-thread-copy");
    b.type = "button";
    const meta = el("span");
    meta.appendChild(el("div", u.username, "dm-name"));
    const presence = presenceStatusForUser(u);
    meta.appendChild(el("div", presence !== "offline" ? presenceLabel(presence) : "offline", "muted small"));
    b.appendChild(meta);
    b.onclick = () => openDM(u.id);
    const rm = el("button", "✕", "mini-btn");
    rm.type = "button";
    rm.title = "Remove friend";
    rm.onclick = (ev) => { ev.stopPropagation(); removeFriend(u.id); };
    row.append(avatarButton, b, rm);
    list.appendChild(row);
  }
  if (!friends.length) list.appendChild(el("div", "No friends yet — add someone below.", "muted small"));
  if (incoming.length) {
    list.appendChild(el("div", `REQUESTS — ${incoming.length}`, "chan-group"));
    for (const r of incoming) {
      const u = users.find((x) => x.id === r.from_user);
      const row = el("div", null, "dm-thread-row");
      const meta = el("span");
      meta.appendChild(el("div", u ? u.username : "unknown", "dm-name"));
      meta.appendChild(el("div", "wants to be friends", "muted small"));
      row.appendChild(meta);
      const ok = el("button", "Accept", "mini-btn good");
      ok.type = "button";
      ok.onclick = () => answerFriendRequest(r.id, true);
      const no = el("button", "Decline", "mini-btn");
      no.type = "button";
      no.onclick = () => answerFriendRequest(r.id, false);
      row.append(ok, no);
      list.appendChild(row);
    }
  }
  const add = el("button", "+ Add friend", "chan chan-add");
  add.type = "button";
  add.onclick = addFriendModal;
  list.appendChild(add);
}

/* Discord-style Friends page: Online / All / Pending tabs, search, and an
   Active Now sidebar. Re-renders on friendship changes. */
let friendsTab = "online";
function refreshFriendsView() {
  if ($("friends-view") && !$("friends-view").classList.contains("hidden")) openFriends(friendsTab, true);
}
async function openFriends(tab = "online", keepSearch = false) {
  friendsTab = tab;
  setMobileNav(false);
  await loadFriendships();
  if (!users.length) await refreshUsers(true);
  showView("friends-view");
  const incoming = friendships.filter((r) => r.status === "pending" && r.to_user === session.user.id);
  const tabs = $("friends-tabs");
  tabs.replaceChildren();
  tabs.appendChild(el("span", "Friends", "friends-title"));
  const mkTab = (key, label, badge) => {
    const b = el("button", null, "friends-tab" + (friendsTab === key ? " active" : ""));
    b.type = "button";
    b.appendChild(el("span", label));
    if (badge) b.appendChild(el("span", String(badge), "friends-tab-badge"));
    b.onclick = () => openFriends(key, true);
    return b;
  };
  tabs.append(mkTab("online", "Online"), mkTab("all", "All"),
    mkTab("pending", "Pending", incoming.length || null));
  const addF = el("button", "Add Friend", "btn-primary friends-add");
  addF.type = "button";
  addF.onclick = addFriendModal;
  tabs.appendChild(addF);
  const search = $("friends-search");
  if (!keepSearch) search.value = "";
  search.oninput = () => paintFriendsList();
  paintFriendsList();
  paintActiveNow();
}
function friendUserList(ids) {
  return ids.map((id) => users.find((x) => x.id === id)).filter(Boolean)
    .sort((a, b) => a.username.localeCompare(b.username));
}
function paintFriendsList() {
  const list = $("friends-list");
  list.replaceChildren();
  const q = $("friends-search").value.trim().toLowerCase();
  const match = (u) => !q || u.username.toLowerCase().includes(q);
  const accepted = friendUserList([...friendIds()]).filter(match);
  const incoming = friendships
    .filter((r) => r.status === "pending" && r.to_user === session.user.id)
    .map((r) => ({ req: r, u: users.find((x) => x.id === r.from_user) }))
    .filter(({ u }) => u && match(u));
  const sent = friendships
    .filter((r) => r.status === "pending" && r.from_user === session.user.id)
    .map((r) => ({ req: r, u: users.find((x) => x.id === r.to_user) }))
    .filter(({ u }) => u && match(u));
  const personRow = (u, statusText, actions) => {
    const row = el("div", null, "friend-row");
    const av = el("button", null, "dm-avatar-button");
    av.type = "button";
    av.setAttribute("aria-label", "View " + u.username + "'s profile");
    av.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}, u.avatar_url));
    av.onclick = () => openProfile(u.id);
    const meta = el("button", null, "friend-meta");
    meta.type = "button";
    meta.appendChild(el("div", u.username, "dm-name"));
    meta.appendChild(el("div", statusText, "muted small"));
    meta.onclick = () => openDM(u.id);
    meta.title = "Message " + u.username;
    row.append(av, meta);
    const acts = el("div", null, "friend-actions");
    for (const [iconName, label, fn] of actions) {
      const b = iconBtn(iconName, "icon-btn friend-act", label);
      b.onclick = (ev) => { ev.stopPropagation(); fn(); };
      acts.appendChild(b);
    }
    row.appendChild(acts);
    return row;
  };
  const statusOf = (u) => {
    const p = presenceStatusForUser(u);
    const custom = (u.custom_status || "").trim().slice(0, 60);
    if (p !== "offline") return custom || presenceLabel(p);
    return "offline";
  };
  if (friendsTab === "pending") {
    list.appendChild(el("div", `RECEIVED — ${incoming.length}`, "chan-group"));
    if (!incoming.length) list.appendChild(el("div", "No incoming requests.", "empty-note"));
    for (const { req, u } of incoming) {
      list.appendChild(personRow(u, "wants to be friends", [
        ["check", "Accept", () => answerFriendRequest(req.id, true)],
        ["x", "Decline", () => answerFriendRequest(req.id, false)]
      ]));
    }
    list.appendChild(el("div", `SENT — ${sent.length}`, "chan-group"));
    if (!sent.length) list.appendChild(el("div", "No sent requests.", "empty-note"));
    for (const { req, u } of sent) {
      list.appendChild(personRow(u, "request sent", [["x", "Cancel request", () => answerFriendRequest(req.id, false)]]));
    }
    return;
  }
  const shown = friendsTab === "online" ? accepted.filter((u) => presenceStatusForUser(u) !== "offline") : accepted;
  list.appendChild(el("div", `${friendsTab === "online" ? "ONLINE" : "ALL FRIENDS"} — ${shown.length}`, "chan-group"));
  if (!shown.length) {
    list.appendChild(el("div", friendsTab === "online" ? "No friends online right now." : "No friends yet — add someone with Add Friend.", "empty-note"));
  }
  for (const u of shown) {
    list.appendChild(personRow(u, statusOf(u), [
      ["chat", "Message", () => openDM(u.id)],
      ["user", "Profile", () => openProfile(u.id)],
      ["x", "Remove friend", () => removeFriend(u.id)]
    ]));
  }
}
function paintActiveNow() {
  const box = $("friends-active");
  box.replaceChildren();
  const online = friendUserList([...friendIds()])
    .filter((u) => presenceStatusForUser(u) !== "offline")
    .slice(0, 20);
  if (!online.length) {
    box.appendChild(el("div", "When friends are online, they show up here.", "muted small"));
    return;
  }
  for (const u of online) {
    const card = el("button", null, "active-card");
    card.type = "button";
    card.onclick = () => openDM(u.id);
    card.title = "Message " + u.username;
    card.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}, u.avatar_url));
    const meta = el("span");
    meta.appendChild(el("div", u.username, "dm-name"));
    const custom = (u.custom_status || "").trim().slice(0, 60);
    meta.appendChild(el("div", custom || presenceLabel(presenceStatusForUser(u)), "muted small"));
    card.appendChild(meta);
    box.appendChild(card);
  }
}

async function openDM(uid) {
  if (uid === session.user.id) return;
  setMobileNav(false);
  view = { type: "dm", uid };
  showView("chat-view");
  document.body.classList.add("dm-home");
  $("dm-search-wrap").classList.remove("hidden");
  $("extra-nav").classList.remove("hidden");
  $("dm-search").value = "";
  peopleDirectoryOpen = false;
  dmUnread.delete(uid);
  paintDmUnread();
  activeServer = null;
  activeChannel = null;
  document.querySelectorAll(".server-banner").forEach((n) => n.remove());
  loadServerEmoji();
  if (msgChannel) { await supabase.removeChannel(msgChannel); msgChannel = null; }
  ensureDmSub();
  renderServerRail();
  $("server-header").textContent = "Direct Messages";
  await renderDmList(true);
  const u = users.find((x) => x.id === uid);
  const name = u ? u.username : "unknown";
  $("channel-hash").textContent = "";
  const headerAvatar = $("dm-header-avatar");
  headerAvatar.replaceChildren(avatarNode(name, u && u.avatar_emoji, (u && u.equipped) || {}, u && u.avatar_url));
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
let voiceId = null, voiceCh = null, localStream = null, screenStream = null;
let voiceInputDeviceId = "", voiceOutputDeviceId = "", callInboxChannel = null, remoteMiniDismissed = false;
let voiceDeviceListenerInstalled = false;
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
    const audio = voiceInputDeviceId ? { deviceId: { exact: voiceInputDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    localStream = await navigator.mediaDevices.getUserMedia({ audio });
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
  await populateVoiceDevices();
  renderVoiceGrid();
  startMeter();
}

async function populateVoiceDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  if (!voiceDeviceListenerInstalled && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", populateVoiceDevices);
    voiceDeviceListenerInstalled = true;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const input = $("voice-input-select"), output = $("voice-output-select");
    if (!input || !output) return;
    output.disabled = !(window.HTMLMediaElement && HTMLMediaElement.prototype && HTMLMediaElement.prototype.setSinkId);
    output.title = output.disabled ? "This browser does not support selecting an audio output." : "Choose where call audio plays.";
    const fill = (select, kind, selected) => {
      const label = kind === "audioinput" ? "Microphone" : "Speaker";
      select.replaceChildren(new Option("System default " + label.toLowerCase(), ""));
      devices.filter((device) => device.kind === kind).forEach((device, i) => {
        select.add(new Option(device.label || `${label} ${i + 1}`, device.deviceId));
      });
      select.value = selected;
    };
    fill(input, "audioinput", voiceInputDeviceId);
    fill(output, "audiooutput", voiceOutputDeviceId);
  } catch { /* device labels may be unavailable before permission */ }
}

async function selectVoiceInput(deviceId) {
  voiceInputDeviceId = deviceId || "";
  if (!voiceId) return;
  try {
    const constraints = voiceInputDeviceId
      ? { deviceId: { exact: voiceInputDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    const next = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    const nextTrack = next.getAudioTracks()[0];
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    localStream = next;
    voiceMuted = false;
    for (const [peerId, entry] of voicePcs) {
      const transceiver = entry.pc.getTransceivers().find((item) => item.receiver && item.receiver.track && item.receiver.track.kind === "audio");
      const sender = transceiver ? transceiver.sender : entry.pc.getSenders().find((item) => item.track && item.track.kind === "audio");
      if (sender) {
        const renegotiate = !!transceiver && transceiver.direction !== "sendrecv";
        await sender.replaceTrack(nextTrack);
        if (transceiver) transceiver.direction = "sendrecv";
        if (renegotiate) await renegotiatePeer(peerId, entry);
      }
      else {
        entry.pc.addTrack(nextTrack, next);
        await renegotiatePeer(peerId, entry);
      }
    }
    await updateVoicePresence();
    paintVoiceButtons();
    toast("Microphone changed.", "ok");
  } catch (error) {
    toast("Couldn't switch microphone: " + (error.message || error), "err");
  }
}

async function selectVoiceOutput(deviceId) {
  voiceOutputDeviceId = deviceId || "";
  for (const [, entry] of voicePcs) {
    const audio = entry.audio;
    if (audio && typeof audio.setSinkId === "function") {
      try { await audio.setSinkId(voiceOutputDeviceId); } catch (error) { toast("Couldn't switch speaker: " + error.message, "err"); }
    }
  }
}

async function updateVoicePresence() {
  if (!voiceCh) return;
  try {
    await voiceCh.track({ username: profile.username, muted: voiceMuted || !localStream, deafened: voiceDeaf, noMic: !localStream, screen: !!screenStream });
  } catch { /* next presence sync will reflect state */ }
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
  if (voicePcs.has(peerId) || !voiceCh) return;
  try {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    voicePcs.set(peerId, { pc, audio: null, video: null });
    wirePc(peerId, pc);
    if (localStream) for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
    else pc.addTransceiver("audio", { direction: "recvonly" });
    if (screenStream) for (const track of screenStream.getTracks()) pc.addTrack(track, screenStream);
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
    if (!entry) { entry = { pc, audio: null, video: null }; voicePcs.set(peerId, entry); }
    if (ev.track.kind === "video") {
      let video = document.querySelector(`.voice-screen[data-peer="${peerId}"]`);
      if (!video) {
        video = document.createElement("video");
        video.className = "voice-screen";
        video.dataset.peer = peerId;
        video.autoplay = true;
        video.playsInline = true;
        const card = document.querySelector(`.voice-card[data-peer="${peerId}"]`);
        if (card) card.prepend(video);
      }
      video.srcObject = ev.streams[0] || new MediaStream([ev.track]);
      entry.video = video;
      remoteMiniDismissed = false;
      updateScreenMini();
      ev.track.onended = () => { video.remove(); entry.video = null; remoteMiniDismissed = false; updateScreenMini(); };
      return;
    }
    if (!entry.audio) {
      const a = document.createElement("audio");
      a.autoplay = true;
      a.muted = voiceDeaf;
      document.body.appendChild(a);
      entry.audio = a;
    }
    entry.audio.srcObject = ev.streams[0];
    if (voiceOutputDeviceId && typeof entry.audio.setSinkId === "function") entry.audio.setSinkId(voiceOutputDeviceId).catch(() => {});
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
      // Deterministic offerer: lower user ID initiates, preventing offer glare.
      if (session.user.id < p.from) ensureOffer(p.from);
      return;
    }
    const entry = voicePcs.get(p.from);
    if (p.kind === "offer") {
      let pc = entry && entry.pc;
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
        voicePcs.set(p.from, { pc, audio: null, video: null });
        wirePc(p.from, pc);
        if (localStream) for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
        else pc.addTransceiver("audio", { direction: "recvonly" });
        if (screenStream) for (const track of screenStream.getTracks()) pc.addTrack(track, screenStream);
      }
      if (pc.signalingState === "have-local-offer") await pc.setLocalDescription({ type: "rollback" });
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

function updateScreenMini() {
  const mini = $("screen-mini"), video = $("screen-mini-video");
  if (!mini || !video) return;
  const remoteEntry = [...voicePcs.values()].find((entry) => entry.video && entry.video.srcObject);
  const stream = screenStream || (!remoteMiniDismissed && remoteEntry && remoteEntry.video.srcObject) || null;
  // The dedicated voice view already has large tiles; dock the active share
  // when the user navigates to another page.
  const modalOpen = !$("modal-overlay").classList.contains("hidden");
  const dock = !!stream && ($("voice-view").classList.contains("hidden") || modalOpen);
  mini.classList.toggle("hidden", !dock);
  $("voice-view")?.classList.toggle("is-sharing", !!stream);
  const label = mini.querySelector(".screen-mini-bar span");
  if (label) label.textContent = screenStream ? "Sharing your screen" : "Screen share preview";
  if (stream && video.srcObject !== stream) video.srcObject = stream;
  if (!stream) video.srcObject = null;
}
async function toggleVoiceFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("voice-view").requestFullscreen();
  } catch { toast("Fullscreen isn't available in this browser.", "err"); }
}

async function toggleScreenShare() {
  if (screenStream) return stopScreenShare();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    toast("Screen sharing needs a browser that supports display capture.", "err");
    return;
  }
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 20 }, audio: false });
    const track = screenStream.getVideoTracks()[0];
    if (!track) { screenStream = null; return; }
    track.onended = () => { if (screenStream) stopScreenShare(); };
    for (const [peerId, entry] of voicePcs) {
      entry.pc.addTrack(track, screenStream);
      await renegotiatePeer(peerId, entry);
    }
    if (voiceCh) await updateVoicePresence();
    $("voice-share").classList.add("active");
    $("voice-share").title = "Stop screen sharing";
    renderVoiceGrid();
    updateScreenMini();
  } catch (error) {
    screenStream = null;
    if (error && error.name !== "NotAllowedError") toast("Couldn't start screen share: " + (error.message || error), "err");
  }
}

async function stopScreenShare() {
  const stream = screenStream;
  if (!stream) return;
  screenStream = null;
  for (const [, entry] of voicePcs) {
    for (const sender of entry.pc.getSenders()) {
      if (sender.track && sender.track.kind === "video") {
        try { entry.pc.removeTrack(sender); } catch { /* peer may be closing */ }
      }
    }
  }
  stream.getTracks().forEach((track) => track.stop());
  for (const [peerId, entry] of voicePcs) await renegotiatePeer(peerId, entry);
  $("voice-share")?.classList.remove("active");
  if ($("voice-share")) $("voice-share").title = "Share your screen";
  if ($("screen-mini-video")) $("screen-mini-video").srcObject = null;
  if (voiceCh) await updateVoicePresence();
  renderVoiceGrid();
  updateScreenMini();
}
function closeScreenMini() {
  if (screenStream) { stopScreenShare(); return; }
  remoteMiniDismissed = true;
  updateScreenMini();
}

async function leaveVoice(silent) {
  const leftId = voiceId;
  if (voiceCh) {
    // Untrack first so presence 'leave' propagates immediately; otherwise
    // the roster keeps showing us until the presence entry times out.
    try { await voiceCh.untrack(); } catch { /* not tracked */ }
    try { await supabase.removeChannel(voiceCh); } catch { /* gone */ }
    voiceCh = null;
  }
  for (const [, e] of voicePcs) {
    try { e.pc.close(); } catch { /* closed */ }
    if (e.audio) e.audio.remove();
    if (e.video) e.video.remove();
  }
  voicePcs.clear();
  peerConn.clear();
  peerLevels.clear();
  stopMeter();
  if (screenStream) await stopScreenShare();
  if (localStream) { for (const t of localStream.getTracks()) t.stop(); localStream = null; }
  voiceId = null;
  restoreCallChat();
  updateVoiceDock("chat-view");
  remoteMiniDismissed = false;
  updateScreenMini();
  if (leftId != null) {
    // Drop the cached roster so our own UI stops listing us immediately.
    delete voiceRosters[leftId];
    paintRosters();
    renderVoiceGrid();
  }
  if (!silent) {
    showView("chat-view");
    toast("Left voice.");
  }
}

function paintVoiceButtons() {
  const vm = $("voice-mute"), vd = $("voice-deafen");
  vm.replaceChildren(icon(voiceMuted ? "micOff" : "mic"));
  vm.classList.toggle("off", voiceMuted);
  vd.replaceChildren(icon("phones"));
  vd.classList.toggle("off", voiceDeaf);
  const share = $("voice-share");
  if (share) share.classList.toggle("active", !!screenStream);
}
/* One-time swap of static emoji chrome (headers, composer, voice) to SVG. */
function paintStaticChrome() {
  const map = {
    "announce-btn": "speaker", "polls-btn": "chart", "events-btn": "calendar",
    "invite-btn": "share", "pins-btn": "pin", "saved-btn": "star",
    "search-btn": "search", "members-toggle": "users", "mobile-nav-btn": "menu",
    "emoji-btn": "smile", "sticker-btn": "sticker", "spoiler-btn": "eyeOff", "upload-btn": "clip", "voice-leave": "logout",
    "explore-btn": "compass", "dashboard-btn": "crown", "settings-btn": "gear",
    "logout-btn": "logout", "gift-btn": "gift", "call-btn": "phone"
  };
  for (const [id, name] of Object.entries(map)) {
    const n = document.getElementById(id);
    if (n && !n.querySelector("svg")) n.replaceChildren(icon(name));
  }
  document.querySelectorAll(".auth-logo").forEach((n) => {
    if (!n.querySelector("svg")) n.replaceChildren(icon("chat"));
  });
}

async function renegotiatePeer(peerId, entry) {
  if (!voiceCh || !entry || !entry.pc || entry.pc.signalingState !== "stable") return;
  try {
    const offer = await entry.pc.createOffer();
    await entry.pc.setLocalDescription(offer);
    await voiceCh.send({ type: "broadcast", event: "signal", payload: { kind: "offer", from: session.user.id, to: peerId, sdp: offer } });
  } catch (error) { console.warn("Voice renegotiation failed", error); }
}

function renderVoiceGrid() {
  const grid = $("voice-grid");
  grid.innerHTML = "";
  const states = (voiceId && voiceRosters[voiceId]) || [];
  if (!states.length) {
    grid.appendChild(el("div", "Connecting…", "muted"));
  }
  if (screenStream) {
    const share = el("div", null, "voice-share-tile local-share");
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = screenStream;
    share.appendChild(video);
    share.appendChild(el("div", "Your screen", "voice-share-label"));
    grid.appendChild(share);
  }
  for (const st of states) {
    const u = users.find((x) => x.id === st.id);
    const card = el("div", null, "voice-card");
    card.dataset.peer = st.id;
    const info = peerConn.get(st.id);
    if ((peerLevels.get(st.id) || 0) > 0.08) card.classList.add("speaking");
    card.appendChild(avatarNode(st.username || (u && u.username) || "?", u && u.avatar_emoji, (u && u.equipped) || {}, u && u.avatar_url));
    const voiceName = el("div", null, "voice-name-line");
    voiceName.appendChild(el("span", (st.username || "?") + (st.id === session.user.id ? " (you)" : ""), "voice-name2"));
    const badge = roleBadge(u && u.role);
    if (badge) voiceName.appendChild(badge);
    if (u) appendSpecialBadgeStrip(voiceName, u.id, { limit: 2 });
    card.appendChild(voiceName);
    const media = voicePcs.get(st.id);
    if (media && media.video) card.appendChild(media.video);
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
      row.appendChild(avatarNode(st.username || "?", u && u.avatar_emoji, (u && u.equipped) || {}, u && u.avatar_url));
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
    const canManageCosmetics = profile && ["admin", "mod"].includes(profile.role);
    $("shop-admin-section").classList.toggle("hidden", !canManageCosmetics);
    if (canManageCosmetics) renderShopAdmin();

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

async function uploadCosmeticArt(kind, onUploaded) {
  const pick = document.createElement("input");
  pick.type = "file";
  pick.accept = "image/png,image/jpeg,image/gif,image/webp";
  pick.onchange = async () => {
    const file = pick.files && pick.files[0];
    if (!file) return;
    const largeArt = kind === "effect" || kind === "banner";
    const limit = largeArt ? 3 * 1024 * 1024 : 2 * 1024 * 1024;
    if (!file.type.startsWith("image/")) { toast("Choose a PNG, JPG, GIF, or WebP image.", "err"); return; }
    if (file.size > limit) { toast(`This ${kind} upload exceeds ${kind === "effect" ? "3 MB" : "2 MB"}.`, "err"); return; }
    try {
      const dimensions = await new Promise((resolve) => {
        const image = new Image();
        const blobUrl = URL.createObjectURL(file);
        image.onload = () => { resolve(`${image.naturalWidth}×${image.naturalHeight}`); URL.revokeObjectURL(blobUrl); };
        image.onerror = () => { resolve("dimensions unavailable"); URL.revokeObjectURL(blobUrl); };
        image.src = blobUrl;
      });
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 48) || "cosmetic";
      const path = `cosmetics/${session.user.id}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      onUploaded(data.publicUrl);
      const guidance = kind === "frame" ? "Recommended transparent frame: 512×512."
        : kind === "nameplate" ? "Recommended nameplate: 900×240."
          : kind === "banner" ? "Recommended banner: 1200×400."
            : "Recommended profile effect: 960×540.";
      toast(`Uploaded ${dimensions}. ${guidance}`, "ok");
    } catch (error) { toast("Cosmetic upload failed: " + storageErrorMessage(error), "err"); }
  };
  pick.click();
}

/* Admin/mod shop manager: uploadable profile frames and effects. */
async function renderShopAdmin() {
  const list = $("shop-admin-list");
  list.replaceChildren(el("p", "Loading shop items…", "muted small"));
  const { data, error } = await supabase.from("shop_items").select("*").order("cost");
  list.replaceChildren();
  if (error) {
    list.appendChild(el("p", "Couldn't load shop items (run the v21 schema block): " + error.message, "report-empty"));
    return;
  }
  for (const item of data || []) {
    const row = el("div", null, "shop-admin-row");
    const info = el("div");
    info.appendChild(el("div", `${item.active ? "" : "[hidden] "}${item.name} · ${item.id}`, "shop-admin-name"));
    info.appendChild(el("div",
      `${item.kind}${item.nitro_required ? " · boost-only" : ""} · ${item.cost} 🪙${item.value ? " · " + item.value : ""}${item.description ? " — " + item.description : ""}`,
      "muted small"));
    row.appendChild(info);
    const controls = el("div", null, "shop-admin-controls");
    const art = el("button", item.image_url ? "Replace art" : "Upload art", "mini-btn");
    art.type = "button";
    art.onclick = () => uploadCosmeticArt(item.kind, async (image_url) => {
      const { error: artError } = await supabase.from("shop_items").update({ image_url }).eq("id", item.id);
      if (artError) { toast("Couldn't save art URL: " + artError.message, "err"); return; }
      await loadShopItems();
      renderShopAdmin();
    });
    const cost = el("input");
    cost.type = "number"; cost.min = "0"; cost.max = "1000000"; cost.value = item.cost;
    cost.title = "Cost in coins";
    cost.setAttribute("aria-label", "Cost for " + item.name);
    const toggle = el("button", item.active ? "Hide" : "Show", "mini-btn");
    toggle.type = "button";
    toggle.title = item.active ? "Hide from shop" : "Show in shop";
    const save = el("button", "Save", "mini-btn good");
    save.type = "button";
    save.onclick = async () => {
      const nextCost = Math.max(0, Math.min(1000000, parseInt(cost.value, 10) || 0));
      const { error: upErr } = await supabase.from("shop_items")
        .update({ cost: nextCost }).eq("id", item.id);
      if (upErr) { toast("Couldn't save item: " + upErr.message, "err"); return; }
      toast("Saved " + item.name + ".", "ok");
      renderShopAdmin();
    };
    toggle.onclick = async () => {
      const { error: tErr } = await supabase.from("shop_items").update({ active: !item.active }).eq("id", item.id);
      if (tErr) { toast("Couldn't toggle item: " + tErr.message, "err"); return; }
      renderShopAdmin();
    };
    const del = el("button", "Delete", "mini-btn danger");
    del.type = "button";
    del.onclick = async () => {
      const yes = await showModal({ title: "Delete " + item.name + "?", body: "Members who already bought it keep their ledger entries.", okText: "Delete", danger: true });
      if (yes !== true) return;
      const { error: dErr } = await supabase.from("shop_items").delete().eq("id", item.id);
      if (dErr) { toast("Couldn't delete item: " + dErr.message, "err"); return; }
      renderShopAdmin();
    };
    controls.append(art, cost, toggle, save, del);
    row.appendChild(controls);
    list.appendChild(row);
  }
  if (!(data || []).length) list.appendChild(el("p", "No shop items yet — add the first one below.", "empty-note"));
  const artUpload = $("shop-art-upload");
  artUpload.onclick = () => uploadCosmeticArt($("shop-kind").value, (url) => { $("shop-art-url").value = url; });
  const addBtn = $("shop-add");
  addBtn.onclick = async () => {
    const id = $("shop-id").value.trim().toLowerCase();
    const name = $("shop-name").value.trim();
    const description = $("shop-desc").value.trim().slice(0, 120);
    const cost = Math.max(0, Math.min(1000000, parseInt($("shop-cost").value, 10) || 0));
    const kind = $("shop-kind").value;
    const value = $("shop-value").value.trim().slice(0, 20) || null;
    const nitro_required = $("shop-nitro").checked;
    const active = $("shop-active").checked;
    const image_url = $("shop-art-url").value.trim() || null;
    if (!/^[a-z0-9-]+$/.test(id)) { toast("ID must be lowercase letters, numbers, dashes.", "err"); return; }
    if (!name) { toast("Give the item a name.", "err"); return; }
    if (kind === "color" && value && !/^#[0-9a-f]{6}$/i.test(value)) { toast("Color value must be a hex like #00aff4.", "err"); return; }
    const { error: insErr } = await supabase.from("shop_items")
      .insert({ id, name: name.slice(0, 60), description, cost, kind, value, nitro_required, active, image_url });
    if (insErr) { toast("Couldn't add item: " + insErr.message, "err"); return; }
    $("shop-id").value = ""; $("shop-name").value = ""; $("shop-desc").value = "";
    $("shop-cost").value = ""; $("shop-value").value = ""; $("shop-art-url").value = "";
    $("shop-nitro").checked = false; $("shop-active").checked = true;
    toast("Added " + name + " to the shop.", "ok");
    renderShopAdmin();
  };
}

function populateCurrencyMembers() {  const select = $("grant-currency-user");
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
      nameBtn.appendChild(avatarNode(u.username, u.avatar_emoji, u.equipped || {}, u.avatar_url));
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
      button.appendChild(badgeArtwork(item.id) || el("span", item.icon, "admin-badge-icon"));
      button.appendChild(el("span", item.label, "admin-badge-label"));
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
  try {
    const prefill = sessionStorage.getItem("ping-prefill-email");
    if (prefill) {
      sessionStorage.removeItem("ping-prefill-email");
      const emailField = $("auth-email");
      if (emailField && !emailField.value) emailField.value = prefill;
    }
  } catch { /* private mode */ }
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
