import type { Prisma, ActivityAction } from "@prisma/client";


type PrismaTransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Writes an ActivityLog row AND updates Ticket.lastActivityAt in the same transaction.
 * Must be called from inside every server action that touches a ticket.
 */
export async function logActivity(
  tx: PrismaTransactionClient,
  params: {
    ticketId: string;
    userId: string;
    action: ActivityAction;
    fromValue?: string;
    toValue?: string;
  }
): Promise<void> {
  const { ticketId, userId, action, fromValue, toValue } = params;

  await Promise.all([
    tx.activityLog.create({
      data: {
        ticketId,
        userId,
        action,
        fromValue,
        toValue,
      },
    }),
    tx.ticket.update({
      where: { id: ticketId },
      data: { lastActivityAt: new Date() },
    }),
  ]);
}
