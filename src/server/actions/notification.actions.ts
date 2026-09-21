"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  ticketId: string | null;
  commentId: string | null;
  isRead: boolean;
  createdAt: Date;
  actor: { id: string; displayName: string; avatarColor: string } | null;
}

/** Latest notifications for the current user (scrollable dropdown source). */
export async function getNotifications(input?: {
  limit?: number;
}): Promise<Result<{ items: NotificationItem[]; unreadCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const limit = Math.min(Math.max(input?.limit ?? 30, 1), 100);

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        include: {
          actor: { select: { id: true, displayName: true, avatarColor: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      }),
    ]);

    return { success: true, data: { items, unreadCount } };
  } catch (error) {
    // Table may not exist until the additive migration is applied — fail soft
    // so the navbar never breaks for the team.
    console.error("getNotifications error:", error);
    return { success: true, data: { items: [], unreadCount: 0 } };
  }
}

export async function markNotificationRead(input: {
  notificationId: string;
}): Promise<Result<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    await prisma.notification.updateMany({
      where: { id: input.notificationId, userId: session.user.id },
      data: { isRead: true },
    });
    return { success: true, data: undefined };
  } catch (error) {
    console.error("markNotificationRead error:", error);
    return { success: false, error: "Failed to mark notification" };
  }
}

export async function markAllNotificationsRead(): Promise<Result<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });
    return { success: true, data: undefined };
  } catch (error) {
    console.error("markAllNotificationsRead error:", error);
    return { success: false, error: "Failed to mark notifications" };
  }
}
