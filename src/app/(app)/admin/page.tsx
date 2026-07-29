import { getCachedSession } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AdminClient } from "./AdminClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin - IFlow" };

export default async function AdminPage() {
  const session = await getCachedSession();
  if (!session?.user) return null;
  if (session.user.role !== "ADMIN") redirect("/overview");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      department: true,
      avatarColor: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });

  return <AdminClient users={users} currentUserId={session.user.id} />;
}
