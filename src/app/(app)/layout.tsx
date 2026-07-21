import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/shared/Sidebar";
import { TopNav } from "@/components/shared/TopNav";
import { getActiveProject } from "@/lib/project";
import { getCachedUsers } from "@/lib/queries";

export const dynamic = "force-dynamic";


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  const activeProject = await getActiveProject();
  
  if (!activeProject) {
     return <div className="p-10 text-text-primary">No projects found. Please run seed script.</div>;
  }

  const [projects, boards, users] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.board.findMany({
      where: { projectId: activeProject.id },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "asc" },
    }),
    getCachedUsers()
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <Sidebar
        isAdmin={session.user.role === "ADMIN"}
        isManager={session.user.role === "MANAGER"}
        projects={projects}
        activeProject={activeProject}
        boards={boards}
        users={users}
        displayName={session.user.displayName}
        avatarColor={session.user.avatarColor}
      />
      <main className="flex-1 flex flex-col min-w-0 bg-surface-base h-screen overflow-hidden">
        <TopNav />
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
