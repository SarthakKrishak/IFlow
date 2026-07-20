"use server";

import { cookies } from "next/headers";

export async function setProjectCookie(projectId: string) {
  const cookieStore = await cookies();
  cookieStore.set("iflow_active_project", projectId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}
