import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExtraAssigneesMap } from "@/lib/assignees";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      assignee: { select: { id: true, displayName: true, avatarColor: true } },
      createdBy: { select: { id: true, displayName: true, avatarColor: true } },
      labels: { select: { id: true, name: true, color: true } },
      column: true,
      board: { select: { id: true, name: true } },
      comments: {
        include: {
          author: { select: { id: true, displayName: true, avatarColor: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      activityLogs: {
        include: {
          user: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Attach multi-assignees additively (fail-soft until migration is applied).
  const extrasMap = await getExtraAssigneesMap([ticket.id]);

  return NextResponse.json({
    ...ticket,
    extraAssignees: (extrasMap.get(ticket.id) ?? []).map((user) => ({ user })),
  });
}
