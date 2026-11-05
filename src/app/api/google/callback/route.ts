import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptValue } from "@/lib/encryption";
import { emailFromIdToken, exchangeCode, friendlyGoogleError, googleConfig, redirectUri } from "@/lib/meetings/google";

export const dynamic = "force-dynamic";

const REQUIRED_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function done(origin: string, query: string) {
  const res = NextResponse.redirect(new URL(`/meetings?${query}`, origin));
  res.cookies.set("iflow_google_state", "", { path: "/api/google", maxAge: 0 });
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", origin));
  if (session.user.role !== "ADMIN") return done(origin, "error=admin_only");

  const cfg = googleConfig();
  if (!cfg) return done(origin, "error=not_configured");

  if (url.searchParams.get("error")) return done(origin, "error=denied"); // user pressed Cancel on Google's screen

  // Verify state (constant-time) against the cookie set in /connect.
  const state = url.searchParams.get("state") ?? "";
  const cookie = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith("iflow_google_state="))?.split("=")[1] ?? "";
  const ok = state.length > 0 && state.length === cookie.length && crypto.timingSafeEqual(Buffer.from(state), Buffer.from(cookie));
  if (!ok) return done(origin, "error=bad_state");

  const code = url.searchParams.get("code");
  if (!code) return done(origin, "error=no_code");

  try {
    const tokens = await exchangeCode(cfg, code, redirectUri(origin));
    if (!tokens.scope?.includes(REQUIRED_SCOPE)) return done(origin, "error=missing_scope");

    const email = emailFromIdToken(tokens.id_token);
    if (!email) return done(origin, "error=no_email");

    const existing = await prisma.googleConnection.findUnique({ where: { id: "workspace" } });
    // Google only returns a refresh token when consent is shown; keep the old one if it didn't.
    if (!tokens.refresh_token && !existing) return done(origin, "error=no_refresh_token");
    const refreshTokenEnc = tokens.refresh_token ? encryptValue(tokens.refresh_token) : existing!.refreshTokenEnc;

    await prisma.googleConnection.upsert({
      where: { id: "workspace" },
      create: {
        id: "workspace",
        email,
        refreshTokenEnc,
        scope: tokens.scope,
        connectedById: session.user.id,
      },
      update: {
        email,
        refreshTokenEnc,
        scope: tokens.scope,
        status: "ACTIVE",
        lastError: null,
        connectedById: session.user.id,
        connectedAt: new Date(),
        // Switching Google accounts invalidates the calendar choice.
        ...(existing && existing.email !== email ? { calendarId: "primary", calendarName: null } : {}),
      },
    });
    return done(origin, "connected=1");
  } catch (e) {
    console.error("Google OAuth callback failed:", e);
    return done(origin, `error=${encodeURIComponent(friendlyGoogleError(e).slice(0, 120))}`);
  }
}
