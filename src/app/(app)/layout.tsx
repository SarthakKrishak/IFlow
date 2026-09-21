import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/shared/Sidebar";
import { TopNav } from "@/components/shared/TopNav";
import { getCachedSession, getCachedActiveProject, getCachedUsers } from "@/lib/queries";

import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { TopLoader } from "@/components/shared/TopLoader";



export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCachedSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  const activeProject = await getCachedActiveProject();

  if (!activeProject) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <div className="p-10 text-text-primary">No projects found. Please run seed script.</div>
      </ThemeProvider>
    );
  }

  const [projects, boards, users] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.board.findMany({
      where: { projectId: activeProject.id },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "asc" },
    }),
    getCachedUsers(),
  ]);

  // Matches my-tasks page semantics: primary OR multi-assignee, and any
  // non-done column (case-insensitive), so the badge never undercounts.
  // Falls back to the legacy single-assignee count pre-migration.
  let myTasksCount = 0;
  try {
    myTasksCount = await prisma.ticket.count({
      where: {
        OR: [
          { assigneeId: session.user.id },
          { extraAssignees: { some: { userId: session.user.id } } },
        ],
        NOT: [
          { column: { name: { contains: "done", mode: "insensitive" } } },
          { column: { name: { contains: "complet", mode: "insensitive" } } },
        ],
      }
    });
  } catch (error) {
    console.error("myTasksCount fallback (non-blocking):", error);
    myTasksCount = await prisma.ticket.count({
      where: {
        assigneeId: session.user.id,
        column: { name: { notIn: ["Done", "Completed"] } }
      }
    });
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange themes={['light', 'dark', 'ocean', 'dracula', 'monokai', 'onedark', 'forest', 'sunset']}>
      <TopLoader />
      <div className="flex h-screen overflow-hidden bg-surface-base">
        <Sidebar
          isAdmin={session.user.role === "ADMIN"}
          isManager={session.user.role === "MANAGER"}
          projects={projects}
          activeProject={activeProject}
          boards={boards}
          users={users}
          myTasksCount={myTasksCount}
        />
        <main className="flex-1 flex flex-col min-w-0 bg-surface-base h-screen overflow-hidden">
          <TopNav 
            displayName={session.user.displayName}
            avatarColor={session.user.avatarColor}
            isAdmin={session.user.role === "ADMIN"}
            projects={projects}
            activeProject={activeProject}
            teamMembersCount={users.length}
          />
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
