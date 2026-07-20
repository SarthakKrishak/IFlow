import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BCRYPT_COST = 12;
const TEMP_PASSWORD = "iflow123";

const DEFAULT_COLUMNS = [
  { name: "Backlog", order: 0 },
  { name: "To Do", order: 1 },
  { name: "In Progress", order: 2 },
  { name: "In Review", order: 3 },
  { name: "Done", order: 4 },
];

async function main() {
  console.log("🌱 Seeding database...");

  const hash = await bcrypt.hash(TEMP_PASSWORD, BCRYPT_COST);

  // ── Projects ─────────────────────────────────────────────────────────────
  const unidealsProject = await prisma.project.upsert({
    where: { slug: "unideals" },
    update: {},
    create: {
      name: "Unideals",
      slug: "unideals",
      description: "Main workflow tracking for Unideals platform",
    },
  });
  console.log(`  ✓ Project: ${unidealsProject.name}`);

  // ── Users ──────────────────────────────────────────────────────────────
  const usersData = [
    {
      username: "admin",
      displayName: "Imaginum Admin",
      role: "ADMIN" as const,
      department: "GENERAL" as const,
      avatarColor: "#5B5FEF",
    },
    {
      username: "sarthak",
      displayName: "Sarthak Krishak",
      role: "MEMBER" as const,
      department: "DEV" as const,
      avatarColor: "#4B4FE0",
    },
    {
      username: "kamal",
      displayName: "Kamal Sinha",
      role: "MEMBER" as const,
      department: "DEV" as const,
      avatarColor: "#7C85F5",
    },
    {
      username: "aditya",
      displayName: "Aditya Narayan",
      role: "MEMBER" as const,
      department: "DEV" as const,
      avatarColor: "#9B59B6",
    },
    {
      username: "anurag",
      displayName: "Anurag Adarsh",
      role: "MEMBER" as const,
      department: "DESIGN" as const,
      avatarColor: "#EC6A52",
    },
  ];

  const users: Record<string, { id: string }> = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        passwordHash: hash,
        displayName: u.displayName,
        role: u.role,
        department: u.department,
        avatarColor: u.avatarColor,
        mustChangePassword: true,
      },
    });
    users[u.username] = user;
    console.log(`  ✓ User: ${u.username}`);
  }

  // ── Labels ─────────────────────────────────────────────────────────────
  const labelsData = [
    { name: "Bug", color: "#D1495B" },
    { name: "Feature", color: "#5B5FEF" },
    { name: "Urgent", color: "#D9713C" },
    { name: "Content", color: "#1EAE7C" },
    { name: "Design Review", color: "#9B59B6" },
  ];

  const labels: Record<string, { id: string }> = {};
  for (const l of labelsData) {
    const label = await prisma.label.upsert({
      where: { name: l.name },
      update: { color: l.color },
      create: l,
    });
    labels[l.name] = label;
    console.log(`  ✓ Label: ${l.name}`);
  }

  // ── Boards + Columns + Sample Tickets ──────────────────────────────────
  const boardsData = [
    { name: "Dev Board", slug: "dev-board", department: "DEV" as const },
    { name: "Design Board", slug: "design-board", department: "DESIGN" as const },
  ];

  for (const boardData of boardsData) {
    const allUserIds = Object.values(users).map((u) => ({ id: u.id }));
    const board = await prisma.board.upsert({
      where: { slug: boardData.slug },
      update: { 
        projectId: unidealsProject.id,
        members: { set: allUserIds }
      },
      create: {
        name: boardData.name,
        slug: boardData.slug,
        department: boardData.department,
        projectId: unidealsProject.id,
        columns: { create: DEFAULT_COLUMNS },
        members: { connect: allUserIds }
      },
      include: { columns: true },
    });
    console.log(`  ✓ Board: ${board.name}`);

    const colMap = Object.fromEntries(board.columns.map((c: { name: string; id: string; boardId: string; order: number; wipLimit: number | null }) => [c.name, c]));

    const isDevBoard = boardData.slug === "dev-board";
    
    // Select assignees randomly for diversity
    const getAssignee = () => {
      if (isDevBoard) {
        const devs = [users["sarthak"], users["kamal"], users["aditya"]];
        return devs[Math.floor(Math.random() * devs.length)];
      }
      return users["anurag"];
    };

    const dept = boardData.department;
    const adminId = users["admin"].id;
    const now = new Date();
    const pastDate = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const ticketsToCreate = [
      {
        title: `Set up ${board.name} workflow`,
        column: "Backlog",
        priority: "MEDIUM" as const,
        order: 0,
        assigneeId: null,
        completedAt: null,
        dueDate: null,
      },
      {
        title: `First ${board.name} milestone`,
        column: "To Do",
        priority: "HIGH" as const,
        order: 0,
        assigneeId: getAssignee().id,
        completedAt: null,
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        title: `Review ${board.name} deliverables`,
        column: "In Progress",
        priority: "HIGH" as const,
        order: 0,
        assigneeId: getAssignee().id,
        completedAt: null,
        dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        labelNames: ["Feature"],
      },
      {
        title: `Complete initial ${board.name} sprint`,
        column: "Done",
        priority: "MEDIUM" as const,
        order: 0,
        assigneeId: getAssignee().id,
        completedAt: pastDate(5),
        dueDate: pastDate(4), // Completed before due date (On-Time!)
        labelNames: isDevBoard ? ["Bug"] : ["Design Review"],
      },
      {
        title: `Late task example`,
        column: "Done",
        priority: "MEDIUM" as const,
        order: 1,
        assigneeId: getAssignee().id,
        completedAt: pastDate(1),
        dueDate: pastDate(3), // Completed after due date (Late!)
        labelNames: ["Feature"],
      },
    ];

    for (const t of ticketsToCreate) {
      const col = colMap[t.column];
      if (!col) continue;

      const existing = await prisma.ticket.findFirst({
        where: { title: t.title, boardId: board.id },
      });
      if (existing) continue;

      const ticket = await prisma.ticket.create({
        data: {
          boardId: board.id,
          columnId: col.id,
          title: t.title,
          priority: t.priority,
          department: dept,
          order: t.order,
          assigneeId: t.assigneeId,
          createdById: adminId,
          completedAt: t.completedAt,
          dueDate: t.dueDate,
          lastActivityAt: now,
          ...(t.labelNames
            ? {
                labels: {
                  connect: t.labelNames
                    .filter((ln) => labels[ln])
                    .map((ln) => ({ id: labels[ln].id })),
                },
              }
            : {}),
        },
      });

      await prisma.activityLog.create({
        data: {
          ticketId: ticket.id,
          userId: adminId,
          action: "CREATED",
          createdAt: pastDate(10),
        },
      });

      if (t.assigneeId) {
        await prisma.activityLog.create({
          data: {
            ticketId: ticket.id,
            userId: adminId,
            action: "ASSIGNED",
            toValue: t.assigneeId,
            createdAt: pastDate(9),
          },
        });
      }

      if (t.column === "In Progress" || t.column === "Done") {
        await prisma.activityLog.create({
          data: {
            ticketId: ticket.id,
            userId: t.assigneeId ?? adminId,
            action: "MOVED",
            fromValue: "To Do",
            toValue: t.column,
            createdAt: pastDate(7),
          },
        });
      }

      if (t.completedAt) {
        await prisma.activityLog.create({
          data: {
            ticketId: ticket.id,
            userId: t.assigneeId ?? adminId,
            action: "MOVED",
            fromValue: "In Progress",
            toValue: "Done",
            createdAt: pastDate(5),
          },
        });
      }

      console.log(`    ✓ Ticket: ${t.title} [${t.column}]`);
    }
  }

  console.log("\n✅ Seeding complete!");
  console.log(`\nDefault accounts (all use temp password: ${TEMP_PASSWORD})`);
  console.log("Username   | Role   | Dept");
  console.log("-----------|--------|----------");
  usersData.forEach((u) => {
    console.log(`${u.username.padEnd(10)} | ${u.role.padEnd(6)} | ${u.department}`);
  });
  console.log("\n⚠️  All users must change their password on first login.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
