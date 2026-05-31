import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

// GET  /api/tokens — list current user's PATs (no raw token returned)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await prisma.personalAccessToken.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tokens });
}

// POST /api/tokens — create a new PAT
// Body: { name: string }
// Returns the raw token ONCE (never again)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const existing = await prisma.personalAccessToken.count({ where: { userId: session.user.id } });
  if (existing >= 10) return NextResponse.json({ error: "Maximum 10 tokens per user" }, { status: 400 });

  const rawToken = `shpat_${randomBytes(32).toString("hex")}`;
  const tokenHash = hashToken(rawToken);

  const token = await prisma.personalAccessToken.create({
    data: { userId: session.user.id, name: name.trim(), tokenHash },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json({ token: { ...token, rawToken } }, { status: 201 });
}

// DELETE /api/tokens/[id] handled in /api/tokens/[id]/route.ts
