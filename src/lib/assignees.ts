import { prisma } from "@/lib/prisma";

export interface ExtraAssigneeUser {
  id: string;
  displayName: string;
  avatarColor: string;
}

/**
 * Fetch multi-assignees for a batch of tickets.
 * Fail-soft: returns an empty map if the additive `TicketAssignee` table
 * hasn't been migrated yet, so boards keep rendering exactly as before.
 */
export async function getExtraAssigneesMap(
  ticketIds: string[]
): Promise<Map<string, ExtraAssigneeUser[]>> {
  const empty = new Map<string, ExtraAssigneeUser[]>();
  if (ticketIds.length === 0) return empty;
  try {
    const rows = await prisma.ticketAssignee.findMany({
      where: { ticketId: { in: ticketIds } },
      include: { user: { select: { id: true, displayName: true, avatarColor: true } } },
      orderBy: { createdAt: "asc" },
    });
    const map = new Map<string, ExtraAssigneeUser[]>();
    for (const r of rows) {
      const list = map.get(r.ticketId) ?? [];
      list.push(r.user);
      map.set(r.ticketId, list);
    }
    return map;
  } catch (error) {
    console.error("getExtraAssigneesMap fallback (non-blocking):", error);
    return empty;
  }
}
