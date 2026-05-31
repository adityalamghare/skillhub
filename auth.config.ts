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
      authorization: { params: { hd: process.env.ALLOWED_DOMAIN } },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
