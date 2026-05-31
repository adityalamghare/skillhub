/**
 * Email click tracking redirect.
 * Embed in FeaturedSkillEmail as: href="${appUrl}/api/email/click?f=${featureId}&u=${encodeURIComponent(targetUrl)}"
 * Logs email_click then redirects to the target URL.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const featureId = req.nextUrl.searchParams.get("f") ?? "unknown";
  const target    = req.nextUrl.searchParams.get("u") ?? "/";

  console.log(JSON.stringify({ event: "email_click", featureId, target }));

  // Only allow relative paths or same-origin URLs to prevent open redirects
  let redirectTo = "/";
  try {
    const url = new URL(target);
    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    if (url.origin === new URL(appUrl).origin) {
      redirectTo = url.pathname + url.search;
    }
  } catch {
    // target is a relative path
    if (target.startsWith("/")) redirectTo = target;
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
