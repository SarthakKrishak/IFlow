import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { buildAuthUrl, googleConfig, redirectUri } from "@/lib/meetings/google";

export const dynamic = "force-dynamic";

/** Starts the Google consent flow. Admin only. */
export async function GET(req: Request) {
  const session = await auth();
  const origin = new URL(req.url).origin;
  if (!session?.user) return NextResponse.redirect(new URL("/login", origin));
  if (session.user.role !== "ADMIN") return NextResponse.redirect(new URL("/meetings?error=admin_only", origin));

  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(new URL("/meetings?error=not_configured", origin));

  // CSRF protection: random state, bound to this browser by an httpOnly cookie.
  const state = crypto.randomBytes(32).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(cfg, redirectUri(origin), state));
  res.cookies.set("iflow_google_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
