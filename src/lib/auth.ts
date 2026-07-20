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

        const user = await prisma.user.findUnique({ where: { username } });

        if (!user || !user.isActive) {
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
      // Refresh mustChangePassword from DB
      if (token.id && !user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { mustChangePassword: true, isActive: true },
        });
        if (!dbUser?.isActive) return null as unknown as typeof token;
        token.mustChangePassword = dbUser?.mustChangePassword ?? false;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
});
