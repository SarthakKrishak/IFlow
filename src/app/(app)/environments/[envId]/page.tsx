import { getEnvironmentVariables } from "@/server/actions/environment.actions";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/queries";
import type { Metadata } from "next";
import { EnvironmentDetailClient } from "./EnvironmentDetailClient";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Environment Variables - IFlow",
};

export default async function EnvironmentDetailPage(props: { params: Promise<{ envId: string }> }) {
  const params = await props.params;
  const session = await getCachedSession();
  if (!session?.user) return null;

  // Verify access for page load
  const env = await prisma.environment.findUnique({
    where: { id: params.envId },
    include: { allowedUsers: { select: { id: true } }, project: { select: { name: true } } }
  });

  if (!env) {
    redirect("/environments");
  }

  const isAdmin = session.user.role === "ADMIN";
  const hasAccess = isAdmin || env.allowedUsers.some(u => u.id === session.user!.id);

  if (!hasAccess) {
    redirect("/environments");
  }

  const variables = await getEnvironmentVariables(params.envId);

  return (
    <EnvironmentDetailClient 
      environment={env}
      variables={variables}
      isAdmin={isAdmin}
    />
  );
}
