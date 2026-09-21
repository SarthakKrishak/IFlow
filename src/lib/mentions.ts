/**
 * Extract @username mentions from a comment body.
 * Matches @username tokens (letters, numbers, underscore, 3-20 chars)
 * and resolves them against a user list (username or displayName).
 */

// A mention starts at string start or after whitespace / ( / > / quote
const BOUNDARY = String.raw`(?:^|[\s(>"'])`;

export function extractMentionedUserIds(
  body: string,
  users: { id: string; username?: string; displayName: string }[],
  excludeUserId?: string
): string[] {
  // Boundary-aware so emails (foo@bar.com) and code don't trigger mentions
  const tokens = Array.from(body.matchAll(new RegExp(`${BOUNDARY}@([a-z0-9_]{3,20})`, "gi"))).map((m) =>
    m[1].toLowerCase()
  );
  if (tokens.length === 0) return [];

  const unique = Array.from(new Set(tokens));
  const found: string[] = [];

  for (const token of unique) {
    const match = users.find(
      (u) =>
        u.username?.toLowerCase() === token ||
        u.displayName.toLowerCase().replace(/\s+/g, "") === token ||
        u.displayName.toLowerCase().replace(/\s+/g, "_") === token
    );
    if (match && match.id !== excludeUserId && !found.includes(match.id)) {
      found.push(match.id);
    }
  }
  return found;
}

/** Render comment body with @mentions highlighted (returns React-safe parts). */
export function splitBodyByMentions(
  body: string
): { text: string; isMention: boolean }[] {
  const splitter = new RegExp(`(${BOUNDARY}@[a-z0-9_]{3,20})`, "gi");
  const tester = new RegExp(`${BOUNDARY}@[a-z0-9_]{3,20}$`, "i");
  const parts = body.split(splitter);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ text: p, isMention: tester.test(p) }));
}
