export const ADMIN_COMMANDS = Object.freeze([
  { name: "mute", usage: "<username>", description: "Stop a member from sending messages." },
  { name: "unmute", usage: "<username>", description: "Restore a member's ability to chat." },
  { name: "ban", usage: "<username>", description: "Block a member from using Ping." },
  { name: "unban", usage: "<username>", description: "Restore a banned member's access." },
  { name: "coins", usage: "<username> <amount>", description: "Grant virtual Ping coins." },
  { name: "item", usage: "<username> <item-id>", description: "Give a member a shop item." },
  { name: "badge", usage: "<username> <badge-id>", description: "Award a profile badge." },
  { name: "role", usage: "<username> <member|mod>", description: "Set a member or moderator role." }
]);

export function getAdminCommandMatches(input) {
  if (typeof input !== "string" || !input.startsWith("/")) return [];
  const query = input.slice(1);
  if (/\s/.test(query)) return [];
  const term = query.toLowerCase();
  return ADMIN_COMMANDS.filter((command) => command.name.startsWith(term));
}

export function parseAdminCommand(input) {
  const match = /^\/([a-z][a-z0-9_-]*)(?:\s+([\s\S]*))?$/i.exec(String(input || "").trim());
  if (!match) return null;
  const name = match[1].toLowerCase();
  return {
    command: ADMIN_COMMANDS.find((item) => item.name === name) || null,
    name,
    args: (match[2] || "").trim()
  };
}
