import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import type { Role, Department } from "@prisma/client";

// Simple in-memory login rate limiter (reset on server restart, fine for 5–7 users)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 60 * 1000; // 1 minute

function checkRateLimit(username: string): { allowed: boolean } {
  const now = Date.now();
  const entry = loginAttempts.get(username);
  if (entry && entry.lockedUntil > now) {
    return { allowed: false };
  }
  if (entry && entry.lockedUntil <= now) {
    loginAttempts.delete(username);
  }
  return { allowed: true };
}

function recordFailedAttempt(username: string) {
  const now = Date.now();
  const entry = loginAttempts.get(username) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  loginAttempts.set(username, entry);
}

function clearAttempts(username: string) {
  loginAttempts.delete(username);
}

type ProfileRow = {
  mustChangePassword: boolean;
  isActive: boolean;
  role: Role;
  department: Department;
  avatarColor: string;
  displayName: string;
};
const PROFILE_TTL_MS = 30_000;
// Stored on globalThis: Next compiles each route into its own bundle (and HMR
// reloads modules), so a plain module-level Map would be duplicated and never hit.
const g = globalThis as unknown as {
  __iflowProfileCache?: Map<string, { at: number; value: ProfileRow | null }>;
  __iflowProfileInflight?: Map<string, Promise<ProfileRow | null>>;
};
const profileCache = (g.__iflowProfileCache ??= new Map());
const profileInflight = (g.__iflowProfileInflight ??= new Map());

async function getProfile(id: string): Promise<ProfileRow | null> {
  const hit = profileCache.get(id);
  // Never trust a cached "must change password" — it flips right after the user changes it.
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS && !hit.value?.mustChangePassword) return hit.value;
  // Collapse concurrent lookups (layout + page + actions render together).
  const pending = profileInflight.get(id);
  if (pending) return pending;
  const p = prisma.user
    .findUnique({
      where: { id },
      select: { mustChangePassword: true, isActive: true, role: true, department: true, avatarColor: true, displayName: true },
    })
    .then((value) => {
      profileCache.set(id, { at: Date.now(), value });
      if (profileCache.size > 500) profileCache.delete(profileCache.keys().next().value as string);
      return value;
    })
    .finally(() => profileInflight.delete(id));
  profileInflight.set(id, p);
  return p;
}

/** Drop a user's cached profile (call after password/role/active changes). */
export function invalidateProfile(id: string) {
  profileCache.delete(id);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const username = String(credentials.username).toLowerCase();
        const password = String(credentials.password);

        if (!checkRateLimit(username).allowed) return null;

        try {
          const user = await prisma.user.findUnique({ where: { username } });

          if (!user) {
            recordFailedAttempt(username);
            return null;
          }

          if (!user.isActive) {
            recordFailedAttempt(username);
            return null;
          }

          const passwordMatch = await bcrypt.compare(password, user.passwordHash);

          if (!passwordMatch) {
            recordFailedAttempt(username);
            return null;
          }

          clearAttempts(username);

          return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            department: user.department,
            avatarColor: user.avatarColor,
            mustChangePassword: user.mustChangePassword,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
    updateAge: 60 * 60,
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.username = (user as { username: string }).username;
        token.displayName = (user as { displayName: string }).displayName;
        token.role = (user as { role: Role }).role;
        token.department = (user as { department: Department }).department;
        token.avatarColor = (user as { avatarColor: string }).avatarColor;
        token.mustChangePassword = (user as { mustChangePassword: boolean }).mustChangePassword;
      }
      // Refresh mutable profile fields from DB periodically.
      // auth() runs on EVERY page render and server action, so the lookup is
      // cached in-process for a short TTL (a deactivation or role change takes
      // effect within PROFILE_TTL_MS instead of costing a DB round-trip per call).
      if (token.id && !user) {
        try {
          const dbUser = await getProfile(token.id as string);
          if (!dbUser?.isActive) return null as unknown as typeof token;
          token.mustChangePassword = dbUser?.mustChangePassword ?? false;
          if (dbUser) {
            token.role = dbUser.role;
            token.department = dbUser.department;
            token.avatarColor = dbUser.avatarColor;
            token.displayName = dbUser.displayName;
          }
        } catch {
          // Silently continue with cached token data on DB errors
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
});
