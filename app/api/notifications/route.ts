import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getNotifications, markNotificationsSeen } from "@/lib/notifications";

// GET /api/notifications — current user's grouped notifications + unread count
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await getNotifications(session.user.id);
  return NextResponse.json(data);
}

// POST /api/notifications — mark all current notifications as seen
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await markNotificationsSeen(session.user.id);
  return NextResponse.json({ ok: true });
}
