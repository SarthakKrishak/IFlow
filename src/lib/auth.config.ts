import type { NextAuthConfig } from "next-auth";

/**
 * Auth config for Edge Runtime (middleware).
 * Does NOT include the Credentials provider (which uses bcryptjs/Node.js APIs).
 * The full credentials auth is in src/lib/auth.ts.
 */
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isPublic = pathname === "/login";
      const isChangePassword = pathname === "/change-password";

      if (isPublic) {
        // If logged in and doesn't need to change password, redirect to dashboard
        if (isLoggedIn && !auth?.user?.mustChangePassword) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        const url = new URL("/login", nextUrl);
        url.searchParams.set("callbackUrl", pathname);
        return Response.redirect(url);
      }

      // Must change password
      if (auth?.user?.mustChangePassword && !isChangePassword) {
        return Response.redirect(new URL("/change-password", nextUrl));
      }

      // Allow manual password changes even if mustChangePassword is false

      return true;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.displayName = token.displayName as string;
        // @ts-ignore
        session.user.role = token.role;
        // @ts-ignore
        session.user.department = token.department;
        session.user.avatarColor = token.avatarColor as string;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
};
