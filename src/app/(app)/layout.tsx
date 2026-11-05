import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/shared/Sidebar";
import { TopNav } from "@/components/shared/TopNav";
import { getCachedSession, getCachedActiveProject, getCachedUsers } from "@/lib/queries";
import { getHeavyCachedProjects, getHeavyCachedBoards } from "@/lib/cached";
import { getPendingReviewCount } from "@/lib/page-tracker/queries";

import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { TopLoader } from "@/components/shared/TopLoader";
import { MobileTabBar } from "@/components/shared/MobileTabBar";
import { AppBootLoader, BOOT_SCRIPT } from "@/components/shared/AppBootLoader";



export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Session (JWT verify) and active project (cookie read) are independent —
  // run together instead of waterfalling.
  const [session, activeProject] = await Promise.all([
    getCachedSession(),
    getCachedActiveProject(),
  ]);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  if (!activeProject) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <div className="p-10 text-text-primary">No projects found. Please run seed script.</div>
      </ThemeProvider>
    );
  }

  // Reference data comes from the cross-request cache (memory-fast);
  // only the personal task count hits the DB per render.
  const [projects, allBoards, users] = await Promise.all([
    getHeavyCachedProjects(),
    getHeavyCachedBoards(),
    getCachedUsers(),
  ]);
  const boards = allBoards
    .filter((b) => b.projectId === activeProject.id)
    .map(({ id, name, slug }) => ({ id, name, slug }));

  // Matches my-tasks page semantics: primary OR multi-assignee, and any
  // non-done column (case-insensitive), so the badge never undercounts.
  // Falls back to the legacy single-assignee count pre-migration.
  // Independent of the task count — start it now so both run concurrently.
  const pendingReviewsPromise = getPendingReviewCount(session.user.id);
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

  // Page Tracker reviews waiting on me (fail-soft before the migration).
  const pendingReviews = await pendingReviewsPromise;

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange themes={['light', 'dark', 'ocean', 'dracula', 'monokai', 'onedark', 'forest', 'sunset']}>
      <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      <AppBootLoader />
      <TopLoader />
      <div className="flex h-[100dvh] overflow-hidden bg-surface-base">
        <Sidebar
          isAdmin={session.user.role === "ADMIN"}
          isManager={session.user.role === "MANAGER"}
          projects={projects}
          activeProject={activeProject}
          boards={boards}
          users={users}
          myTasksCount={myTasksCount}
          pendingReviews={pendingReviews}
        />
        <main className="flex-1 flex flex-col min-w-0 bg-background h-[100dvh] overflow-hidden lg:h-[calc(100dvh-1rem)] lg:my-2 lg:mr-2 lg:rounded-xl lg:border lg:border-surface-border lg:shadow-card">
          <TopNav 
            displayName={session.user.displayName}
            avatarColor={session.user.avatarColor}
            isAdmin={session.user.role === "ADMIN"}
            projects={projects}
            activeProject={activeProject}
            teamMembersCount={users.length}
            boards={boards.map(({ id, name }) => ({ id, name }))}
          />
          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain relative flex flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </div>
        </main>
        <MobileTabBar myTasksCount={myTasksCount} pendingReviews={pendingReviews} />
      </div>
    </ThemeProvider>
  );
}
