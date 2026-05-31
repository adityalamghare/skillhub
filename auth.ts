import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

const allowedDomain = process.env.ALLOWED_DOMAIN ?? "";
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email) return false;

      // Hard domain restriction — enforced server-side (hd param is only a hint).
      if (allowedDomain && !profile.email.endsWith(`@${allowedDomain}`)) {
        return false;
      }

      const isAdmin = adminEmails.includes(profile.email);

      await prisma.user.upsert({
        where: { email: profile.email },
        update: {
          name: profile.name ?? profile.email,
          avatar: (profile as { picture?: string }).picture ?? null,
          isAdmin,
        },
        create: {
          email: profile.email,
          name: profile.name ?? profile.email,
          avatar: (profile as { picture?: string }).picture ?? null,
          isAdmin,
        },
      });

      return true;
    },

    async jwt({ token, trigger }) {
      if (trigger === "signIn" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, isAdmin: true, department: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.isAdmin = dbUser.isAdmin;
          token.department = dbUser.department;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      if (token.isAdmin !== undefined)
        session.user.isAdmin = token.isAdmin as boolean;
      if (token.department !== undefined)
        session.user.department = (token.department as string) ?? null;
      return session;
    },
  },
});
