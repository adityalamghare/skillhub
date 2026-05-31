import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

function parseEmailList(envVar: string | undefined) {
  return (envVar ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  callbacks: {
    async signIn({ user, profile }) {
      // Email can live on profile (OAuth raw) or the derived user object.
      const rawEmail = profile?.email ?? user?.email ?? "";

      // Read env vars at call time (not module load) so Vercel picks up runtime values.
      const allowedDomain = process.env.ALLOWED_DOMAIN ?? "freshworks.com";
      const allowedGuestEmails = parseEmailList(process.env.ALLOWED_GUEST_EMAILS);
      const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);

      const normalizedEmail = rawEmail.trim().toLowerCase();
      const domainAllowed = !!normalizedEmail && allowedDomain
        ? normalizedEmail.endsWith(`@${allowedDomain}`)
        : false;
      const guestAllowed = allowedGuestEmails.includes(normalizedEmail);

      console.log(JSON.stringify({
        event: "signIn_attempt",
        normalizedEmail,
        profileEmail: profile?.email ?? null,
        userEmail: user?.email ?? null,
        domainAllowed,
        guestAllowed,
        allowedGuestEmails,
      }));

      if (!normalizedEmail) return false;
      if (!domainAllowed && !guestAllowed) {
        return false;
      }

      const isAdmin = adminEmails.includes(normalizedEmail);
      const displayName = profile?.name ?? user?.name ?? normalizedEmail;
      const avatar =
        (profile as { picture?: string } | undefined)?.picture ?? user?.image ?? null;

      await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: { name: displayName, avatar, isAdmin },
        create: { email: normalizedEmail, name: displayName, avatar, isAdmin },
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
