import { Metadata } from "next";
import { GithubTracker } from "./GithubTracker";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCachedActiveProject } from "@/lib/queries";

export const metadata: Metadata = {
  title: "GitHub Tracker — IFlow",
  description: "Track GitHub repository statistics in real-time.",
};

export default async function GithubPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const project = await getCachedActiveProject();
  if (!project) return null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-surface-base">
      <GithubTracker 
        projectId={project.id} 
        initialRepo={project.githubRepo || ""} 
        isAdmin={session.user.role === "ADMIN"}
      />
    </div>
  );
}
