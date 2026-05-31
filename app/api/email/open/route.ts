/**
 * Email open tracking pixel.
 * Embed in FeaturedSkillEmail as: <img src="${appUrl}/api/email/open?f=${featureId}" width="1" height="1" />
 * Returns a 1×1 transparent GIF and logs the email_open event.
 */

import { NextRequest, NextResponse } from "next/server";

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: NextRequest) {
  const featureId = req.nextUrl.searchParams.get("f") ?? "unknown";
  console.log(JSON.stringify({ event: "email_open", featureId }));

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
