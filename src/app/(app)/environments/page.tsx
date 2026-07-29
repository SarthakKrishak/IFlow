import { getEnvironments } from "@/server/actions/environment.actions";
import { getCachedSession, getCachedUsers } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { EnvironmentsClient } from "./EnvironmentsClient";

export const metadata: Metadata = {
  title: "Environments - IFlow",
  description: "Manage project environments and secrets.",
};

export default async function EnvironmentsPage() {
  const session = await getCachedSession();
  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";
  const environments = await getEnvironments();
  const users = await getCachedUsers();
  
  // Map users to remove Date objects (createdAt, updatedAt) for Client Component props
  const safeUsers = users.map(u => ({
    id: u.id,
    displayName: u.displayName,
    avatarColor: u.avatarColor
  }));
  
  // We need projects for the creation dropdown
  const projects = await prisma.project.findMany({
    select: { id: true, name: true }
  });

  return (
    <EnvironmentsClient 
      environments={environments} 
      isAdmin={isAdmin} 
      users={safeUsers} 
      projects={projects} 
      currentUserId={session.user.id}
    />
  );
}
