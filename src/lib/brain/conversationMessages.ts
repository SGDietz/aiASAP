export type ConversationMessage = {
  role: string;
  content: string;
};

/**
 * Append the accepted user message exactly once. The client may already include
 * the current turn as the final history row, so the server must not duplicate it.
 */
export function buildConversationMessages(
  systemContent: string,
  history: ConversationMessage[],
  currentUserMessage: string,
): ConversationMessage[] {
  const historyAlreadyEndsWithCurrentUser =
    history.at(-1)?.role === "user" &&
    history.at(-1)?.content.trim() === currentUserMessage.trim();

  return [
    { role: "system", content: systemContent },
    ...history,
    ...(historyAlreadyEndsWithCurrentUser
      ? []
      : [{ role: "user", content: currentUserMessage }]),
  ];
}
