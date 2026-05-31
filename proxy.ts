import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Proxy (middleware) uses only the Edge-safe config — no Prisma, no Node modules.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Exclude static assets AND the NextAuth API routes themselves —
  // otherwise the proxy intercepts /api/auth/callback/google mid-flow,
  // sees no session yet, and loops back to sign-in.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
