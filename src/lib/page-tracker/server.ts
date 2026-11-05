/**
 * Page Tracker — server-side helpers shared by the server actions.
 * (Not a "use server" module: nothing here is callable from the client.)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import type { Prisma } from "@prisma/client";
import type { Actor, Decision } from "./policy";
import {
  KANBAN_DRAGGABLE,
  canEditWorkItem,
  pickColumnForStatus,
  statusForColumnName,
  validateOwnerTransition,
} from "./policy";
import type { Role, Workstream, WorkItemStatus } from "./constants";

export type Result<T> = { success: true; data: T } | { success: false; error: string };

export type Tx = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface SessionActor extends Actor {
  displayName: string;
}

/** The acting user ALWAYS comes from the authenticated session — never the client. */
export async function requireActor(): Promise<SessionActor> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return {
    id: session.user.id,
    role: session.user.role as Role,
    displayName: session.user.displayName ?? session.user.username ?? "Someone",
  };
}

export const fail = (error: string): { success: false; error: string } => ({ success: false, error });
export const done = <T>(data: T): { success: true; data: T } => ({ success: true, data });

/** Converts a policy Decision into an action Result when denied. */
export const denied = (d: Decision) => (d.ok ? null : fail(d.error));

export class ActionError extends Error {}

/** Turns thrown errors into Results; ActionError messages are user-facing. */
export function toResult(error: unknown, label: string): { success: false; error: string } {
  if (error instanceof ActionError) return fail(error.message);
  if (error instanceof Error && error.message === "Unauthorized") return fail("Unauthorized");
  console.error(`${label} error:`, error);
  return fail("Something went wrong — please try again");
}

export const STALE_MESSAGE =
  "This work item was changed by someone else. Reload to see the latest version and try again.";

// ── Audit ───────────────────────────────────────────────────────────────────

export async function writeAudit(
  tx: Tx,
  p: {
    actorId: string;
    action: string;
    pageId?: string | null;
    workItemId?: string | null;
    bugId?: string | null;
    summary?: string | null;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    reason?: string | null;
    isOverride?: boolean;
  }
) {
  await tx.trackerAudit.create({
    data: {
      actorId: p.actorId,
      action: p.action,
      pageId: p.pageId ?? null,
      workItemId: p.workItemId ?? null,
      bugId: p.bugId ?? null,
      summary: p.summary ?? null,
      before: p.before,
      after: p.after,
      reason: p.reason ?? null,
      isOverride: p.isOverride ?? false,
    },
  });
}

// ── Notifications (fail-soft: never block the workflow) ─────────────────────

export async function notify(p: {
  userIds: (string | null | undefined)[];
  actorId: string;
  type: string;
  title: string;
  body?: string;
  link: string;
}) {
  try {
    const ids = Array.from(new Set(p.userIds.filter((x): x is string => !!x && x !== p.actorId)));
    if (ids.length === 0) return;
    const rows = ids.map((userId) => ({
      userId,
      actorId: p.actorId,
      type: p.type,
      title: p.title,
      body: p.body ?? null,
    }));
    try {
      await prisma.notification.createMany({ data: rows.map((r) => ({ ...r, link: p.link })) });
    } catch (e) {
      if (!isMissingSchema(e)) throw e;
      await prisma.notification.createMany({ data: rows }); // pre-migration: no link column yet
    }
  } catch (error) {
    console.error("tracker notify (non-blocking):", error);
  }
}

export const itemLink = (pageId: string, workItemId: string) =>
  `/page-tracker/${pageId}?item=${workItemId}`;

// ── Users ───────────────────────────────────────────────────────────────────

/** Assignees/bug owners must be active, non-admin accounts (admin never gets work). */
export async function assertAssignable(userId: string, what = "assignee") {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, role: true },
  });
  if (!u || !u.isActive) throw new ActionError(`The selected ${what} is not an active team member`);
  if (u.role === "ADMIN") throw new ActionError(`Cannot assign work to the admin account`);
  return u;
}

/** Reviewers/owners must be active; admins ARE allowed to review. */
export async function assertActiveUser(userId: string, what = "user") {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, role: true },
  });
  if (!u || !u.isActive) throw new ActionError(`The selected ${what} is not an active team member`);
  return u;
}

// ── Kanban mirror ───────────────────────────────────────────────────────────

const DEPT: Record<Workstream, "DESIGN" | "DEV"> = {
  DESIGN: "DESIGN",
  DEVELOPMENT: "DEV",
  TESTING: "DEV",
};

/** Creates the mirror card (breadcrumb in the description). Returns its id. */
export async function createMirrorTicket(
  tx: Tx,
  p: {
    boardId: string;
    projectId: string;
    creatorId: string;
    pageName: string;
    workstream: Workstream;
    title: string;
    assigneeId: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate: Date | null;
    pageId: string;
  }
): Promise<string> {
  const board = await tx.board.findUnique({
    where: { id: p.boardId },
    include: { columns: { orderBy: { order: "asc" } } },
  });
  if (!board || board.projectId !== p.projectId) {
    throw new ActionError("That board does not belong to the active project");
  }
  const col = pickColumnForStatus(board.columns, "NOT_STARTED");
  if (!col) throw new ActionError("That board has no columns");
  const max = await tx.ticket.aggregate({ where: { columnId: col.id }, _max: { order: true } });
  const t = await tx.ticket.create({
    data: {
      boardId: board.id,
      columnId: col.id,
      title: p.title,
      description: `Page Tracker › ${p.pageName} › ${p.workstream[0]}${p.workstream.slice(1).toLowerCase()}\nManaged in Page Tracker: /page-tracker/${p.pageId}`,
      priority: p.priority,
      department: DEPT[p.workstream],
      order: (max._max.order ?? -1) + 1,
      assigneeId: p.assigneeId,
      createdById: p.creatorId,
      dueDate: p.dueDate,
    },
  });
  await tx.activityLog.create({
    data: { ticketId: t.id, userId: p.creatorId, action: "CREATED" },
  });
  return t.id;
}

/** Mirrors owner-visible fields (status → column, assignee, title, due date). */
export async function syncMirrorTicket(
  tx: Tx,
  ticketId: string | null | undefined,
  actorId: string,
  next: {
    status?: WorkItemStatus;
    assigneeId?: string;
    title?: string;
    dueDate?: Date | null;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }
) {
  if (!ticketId) return;
  const ticket = await tx.ticket.findUnique({
    where: { id: ticketId },
    include: { column: { select: { name: true } }, board: { include: { columns: true } } },
  });
  if (!ticket) return;

  const data: Prisma.TicketUpdateInput = {};
  if (next.assigneeId !== undefined) data.assignee = { connect: { id: next.assigneeId } };
  if (next.title !== undefined) data.title = next.title;
  if (next.dueDate !== undefined) data.dueDate = next.dueDate;
  if (next.priority !== undefined) data.priority = next.priority;

  let moved: { from: string; to: string } | null = null;
  if (next.status) {
    const target = pickColumnForStatus(ticket.board.columns, next.status);
    if (target && target.id !== ticket.columnId) {
      const max = await tx.ticket.aggregate({ where: { columnId: target.id }, _max: { order: true } });
      data.column = { connect: { id: target.id } };
      data.order = (max._max.order ?? -1) + 1;
      const isDone = /done|complet/i.test(target.name);
      const wasDone = /done|complet/i.test(ticket.column.name);
      if (isDone && !wasDone) data.completedAt = new Date();
      if (!isDone && wasDone) data.completedAt = null;
      moved = { from: ticket.column.name, to: target.name };
    }
  }
  if (Object.keys(data).length === 0) return;
  // Bump activity so other open boards pick the change up via the live fingerprint.
  data.lastActivityAt = new Date();
  await tx.ticket.update({ where: { id: ticketId }, data });
  if (moved) {
    await logActivity(tx, {
      ticketId,
      userId: actorId,
      action: "MOVED",
      fromValue: moved.from,
      toValue: moved.to,
    });
  }
}

export { prisma };

/** Defensive parse of a Json column into evidence entries. */
export function toEvidence(v: unknown): import("./constants").EvidenceEntry[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (e): e is import("./constants").EvidenceEntry =>
      !!e && typeof e === "object" && typeof (e as { url?: unknown }).url === "string" && typeof (e as { type?: unknown }).type === "string"
  );
}

/**
 * Loads a work item and runs the central owner-edit policy (assignee only,
 * acknowledged, not locked/closed/archived). Throws ActionError when denied.
 */
export async function loadItemForOwnerEdit(workItemId: string, actor: Actor) {
  const item = await prisma.workItem.findUnique({
    where: { id: workItemId },
    include: { page: { select: { id: true, name: true, ownerId: true, archivedAt: true } } },
  });
  if (!item) throw new ActionError("Work item not found");
  const d = canEditWorkItem(actor, item);
  if (!d.ok) throw new ActionError(d.error);
  if (item.page.archivedAt) throw new ActionError("This page is archived");
  return item;
}

// ── Kanban ownership guard ──────────────────────────────────────────────────

export const TRACKER_MANAGED_MESSAGE =
  "This card is managed in Page Tracker — change it from its work item there.";

/**
 * True when a Kanban ticket mirrors a Page Tracker work item. Fail-soft: if the
 * tracker tables aren't migrated yet the board keeps behaving exactly as before.
 */
export async function isTrackerManaged(ticketId: string): Promise<boolean> {
  try {
    return (await prisma.workItem.count({ where: { ticketId } })) > 0;
  } catch {
    return false;
  }
}

/**
 * Called inside the Kanban move transaction for a mirrored card. Only the
 * work item's assignee may drag it, and only along transitions the owner is
 * allowed to make (Not Started ⇄ In Progress, Blocked/Changes → In Progress).
 * Review and completion can only happen through the Page Tracker workflow.
 */
export async function applyLinkedMove(
  tx: Tx,
  actor: Actor,
  ticketId: string,
  fromColumnId: string,
  toColumn: { id: string; name: string }
) {
  let wi;
  try {
    wi = await tx.workItem.findUnique({ where: { ticketId } });
  } catch {
    return; // tracker tables missing — treat as an ordinary card
  }
  if (!wi || toColumn.id === fromColumnId) return;

  const target = statusForColumnName(toColumn.name);
  if (target === wi.status) return; // lateral move between equivalent columns

  const edit = canEditWorkItem(actor, wi);
  if (!edit.ok) throw new ActionError(edit.error);
  if (!target || !KANBAN_DRAGGABLE.includes(target)) {
    throw new ActionError(
      "This card is managed in Page Tracker — submit it for review there instead of moving it to this column."
    );
  }
  const t = validateOwnerTransition(wi.status, target);
  if (!t.ok) throw new ActionError(t.error);

  const res = await tx.workItem.updateMany({
    where: { id: wi.id, version: wi.version, assigneeId: actor.id, status: wi.status },
    data: { status: target, blockedReason: null, version: { increment: 1 } },
  });
  if (res.count !== 1) throw new ActionError(STALE_MESSAGE);
  await writeAudit(tx, {
    actorId: actor.id,
    action: "STATUS_CHANGED",
    pageId: wi.pageId,
    workItemId: wi.id,
    summary: "via Kanban board",
    before: { status: wi.status },
    after: { status: target },
  });
}

/** Links shown on Kanban cards (fail-soft). */
export async function getTrackerLinksForTickets(ticketIds: string[]) {
  const map = new Map<string, { workItemId: string; pageId: string; pageName: string; workstream: Workstream; status: WorkItemStatus }>();
  if (ticketIds.length === 0) return map;
  try {
    const rows = await prisma.workItem.findMany({
      where: { ticketId: { in: ticketIds } },
      select: {
        id: true,
        ticketId: true,
        workstream: true,
        status: true,
        pageId: true,
        page: { select: { name: true } },
      },
    });
    for (const r of rows) {
      if (r.ticketId)
        map.set(r.ticketId, {
          workItemId: r.id,
          pageId: r.pageId,
          pageName: r.page.name,
          workstream: r.workstream,
          status: r.status,
        });
    }
  } catch (error) {
    console.error("getTrackerLinksForTickets fallback (non-blocking):", error);
  }
  return map;
}

/** True when Prisma reports a missing table/column (migration not applied yet). */
export function isMissingSchema(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}
