import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe config: no Prisma, no Node-only imports.
// Used by middleware/proxy for session checks only.
// Full auth.ts extends this with DB callbacks.
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request }) {
      // Allow /api/health unauthenticated so the incident-bridge heartbeat
      // can hit the real route handler (which throws on the break branch).
      if (request.nextUrl.pathname === "/api/health") return true;
      return !!auth?.user;
    },
  },
};
