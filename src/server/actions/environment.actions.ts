"use server";

import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/queries";
import { revalidatePath } from "next/cache";
import { encryptValue, decryptValue } from "@/lib/encryption";

// Utility to verify admin status
async function verifyAdmin() {
  const session = await getCachedSession();
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "ADMIN") throw new Error("Forbidden: Admin only");
  return session.user;
}

// Utility to verify environment access
async function verifyAccess(environmentId: string) {
  const session = await getCachedSession();
  if (!session?.user) throw new Error("Unauthorized");
  
  if (session.user.role === "ADMIN") return session.user;
  
  const env = await prisma.environment.findUnique({
    where: { id: environmentId },
    include: { allowedUsers: { select: { id: true } } }
  });
  
  if (!env) throw new Error("Environment not found");
  
  const hasAccess = env.allowedUsers.some(u => u.id === session.user!.id);
  if (!hasAccess) throw new Error("Forbidden: You do not have access to this environment");
  
  return session.user;
}

async function verifyWriteAccess(environmentId: string) {
  const session = await getCachedSession();
  if (!session?.user) throw new Error("Unauthorized");
  
  if (session.user.role === "ADMIN") return session.user;
  
  const env = await prisma.environment.findUnique({
    where: { id: environmentId },
    include: { writeUsers: { select: { id: true } } }
  });
  
  if (!env) throw new Error("Environment not found");
  
  const hasAccess = env.writeUsers.some(u => u.id === session.user!.id);
  if (!hasAccess) throw new Error("Forbidden: You do not have write access to this environment");
  
  return session.user;
}

export async function getEnvironments() {
  const session = await getCachedSession();
  if (!session?.user) return [];
  
  // Everyone sees all environments, but we track if they have access
  const envs = await prisma.environment.findMany({
    include: {
      createdBy: { select: { id: true, displayName: true, avatarColor: true } },
      project: { select: { name: true } },
      allowedUsers: { select: { id: true, displayName: true, avatarColor: true } },
      writeUsers: { select: { id: true, displayName: true, avatarColor: true } },
      _count: { select: { variables: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  
  return envs.map(env => {
    const hasAccess = session.user!.role === "ADMIN" || env.allowedUsers.some(u => u.id === session.user!.id);
    const hasWriteAccess = session.user!.role === "ADMIN" || env.writeUsers.some(u => u.id === session.user!.id);
    return { 
      ...env, 
      createdAt: env.createdAt.toISOString(),
      hasAccess,
      hasWriteAccess
    };
  });
}

export async function createEnvironment(data: { name: string, projectId: string, allowedUserIds: string[], writeUserIds?: string[] }) {
  const user = await verifyAdmin();
  
  const env = await prisma.environment.create({
    data: {
      name: data.name,
      projectId: data.projectId,
      createdById: user.id,
      allowedUsers: {
        connect: data.allowedUserIds.map(id => ({ id }))
      },
      writeUsers: {
        connect: (data.writeUserIds || []).map(id => ({ id }))
      }
    }
  });
  
  revalidatePath("/environments");
  return env;
}

export async function getEnvironmentVariables(environmentId: string) {
  await verifyAccess(environmentId);
  
  const variables = await prisma.environmentVariable.findMany({
    where: { environmentId },
    orderBy: { key: "asc" }
  });
  
  // Decrypt values before sending to client
  return variables.map(v => ({
    ...v,
    value: decryptValue(v.value)
  }));
}

export async function saveEnvironmentVariable(environmentId: string, key: string, value: string) {
  await verifyWriteAccess(environmentId);
  
  const encryptedValue = encryptValue(value);
  
  const variable = await prisma.environmentVariable.upsert({
    where: { environmentId_key: { environmentId, key } },
    update: { value: encryptedValue },
    create: { environmentId, key, value: encryptedValue }
  });
  
  revalidatePath(`/environments/${environmentId}`);
  return variable;
}

export async function deleteEnvironmentVariable(id: string, environmentId: string) {
  await verifyWriteAccess(environmentId);
  
  await prisma.environmentVariable.delete({
    where: { id }
  });
  
  revalidatePath(`/environments/${environmentId}`);
}

export async function deleteEnvironment(id: string) {
  await verifyAdmin();
  
  await prisma.environment.delete({
    where: { id }
  });
  
  revalidatePath("/environments");
}

export async function updateEnvironmentAccess(id: string, allowedUserIds: string[], writeUserIds: string[] = []) {
  await verifyAdmin();
  await prisma.environment.update({
    where: { id },
    data: {
      allowedUsers: {
        set: [],
        connect: allowedUserIds.map(userId => ({ id: userId }))
      },
      writeUsers: {
        set: [],
        connect: writeUserIds.map(userId => ({ id: userId }))
      }
    }
  });
  revalidatePath('/environments');
}

export async function saveMultipleEnvironmentVariables(environmentId: string, variables: { key: string, value: string }[]) {
  await verifyWriteAccess(environmentId);
  const results = [];
  for (const { key, value } of variables) {
    const encryptedValue = encryptValue(value);
    const variable = await prisma.environmentVariable.upsert({
      where: { environmentId_key: { environmentId, key } },
      update: { value: encryptedValue },
      create: { environmentId, key, value: encryptedValue }
    });
    results.push(variable);
  }
  revalidatePath('/environments/' + environmentId);
  return results;
}
