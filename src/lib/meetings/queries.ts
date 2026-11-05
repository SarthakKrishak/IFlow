import { prisma } from "@/lib/prisma";
import { googleConfig, redirectUri } from "./google";

export async function getMeetingsPageData(projectId: string, origin: string) {
  const [meetings, users, emails, conn] = await Promise.all([
    prisma.meeting.findMany({
      where: { projectId },
      orderBy: { startUtc: "desc" },
      take: 300,
      include: {
        attendees: { orderBy: { email: "asc" } },
        exceptions: true,
        createdBy: { select: { displayName: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, avatarColor: true, role: true, department: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.memberEmail.findMany({ select: { userId: true, email: true } }),
    prisma.googleConnection.findUnique({
      // Never select the refresh token for anything that reaches the client.
      where: { id: "workspace" },
      select: { email: true, calendarId: true, calendarName: true, status: true, lastError: true, connectedAt: true },
    }),
  ]);

  const emailOf = new Map(emails.map((e) => [e.userId, e.email]));
  return {
    meetings,
    members: users.map((u) => ({ ...u, email: emailOf.get(u.id) ?? null })),
    connection: {
      configured: !!googleConfig(),
      redirectUri: redirectUri(origin),
      connected: !!conn,
      email: conn?.email ?? null,
      calendarId: conn?.calendarId ?? null,
      calendarName: conn?.calendarName ?? null,
      status: conn?.status ?? null,
      lastError: conn?.lastError ?? null,
    },
  };
}

export type MeetingsPageData = Awaited<ReturnType<typeof getMeetingsPageData>>;
export type MeetingRow = MeetingsPageData["meetings"][number];
export type MemberRow = MeetingsPageData["members"][number];
export type ConnectionInfo = MeetingsPageData["connection"];
