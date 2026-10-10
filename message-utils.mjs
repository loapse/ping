const replyPrefixPattern = new RegExp("^\\[" + String.fromCharCode(0x21a9) + "\\d+\\] ");

export function getMessageEditDraft(content) {
  const original = String(content ?? "");
  const replyPrefix = replyPrefixPattern.exec(original)?.[0] || "";
  const body = original.slice(replyPrefix.length);
  const announcement = body.startsWith("[ANN]");
  return {
    replyPrefix,
    announcement,
    text: announcement ? body.slice(5).trimStart() : body,
    maxLength: Math.max(1, 500 - replyPrefix.length - (announcement ? 5 : 0))
  };
}

export function composeEditedMessage(text, draft) {
  const cleanText = String(text ?? "").trim();
  if (!cleanText) throw new Error("A message can't be empty.");
  const content = draft.replyPrefix + (draft.announcement ? "[ANN]" : "") + cleanText;
  if (content.length > 500) throw new Error("Messages can be up to 500 characters.");
  return content;
}
