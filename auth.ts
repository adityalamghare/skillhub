import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

function parseEmailList(envVar: string | undefined) {
  return (envVar ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email) return false;

      // Read env vars at call time (not module load) so Vercel picks up runtime values.
      const allowedDomain = process.env.ALLOWED_DOMAIN ?? "freshworks.com";
      const allowedGuestEmails = parseEmailList(process.env.ALLOWED_GUEST_EMAILS);
      const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);

      const normalizedEmail = profile.email.trim().toLowerCase();
      const domainAllowed = allowedDomain && normalizedEmail.endsWith(`@${allowedDomain}`);
      const guestAllowed = allowedGuestEmails.includes(normalizedEmail);

      console.log(JSON.stringify({
        event: "signIn_attempt",
        normalizedEmail,
        domainAllowed,
        guestAllowed,
        allowedGuestEmails,
      }));

      if (!domainAllowed && !guestAllowed) {
        return false;
      }

      const isAdmin = adminEmails.includes(normalizedEmail);

      await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {
          name: profile.name ?? normalizedEmail,
          avatar: (profile as { picture?: string }).picture ?? null,
          isAdmin,
        },
        create: {
          email: normalizedEmail,
          name: profile.name ?? normalizedEmail,
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
