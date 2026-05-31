import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { parseSkillFile, buildSourceKey, type SkillOrigin } from "@/lib/importUtils";
import { generateDescription } from "@/lib/ai";
import { ToolType } from "@/app/generated/prisma/client";

// ---------------------------------------------------------------------------
// Auth helper — accepts NextAuth session OR Bearer PAT
// ---------------------------------------------------------------------------
async function resolveUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const raw = authHeader.slice(7).trim();
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const pat = await prisma.personalAccessToken.findUnique({
      where: { tokenHash },
      select: { userId: true, id: true },
    });
    if (!pat) return null;
    await prisma.personalAccessToken.update({
      where: { id: pat.id },
      data: { lastUsedAt: new Date() },
    });
    return pat.userId;
  }

  const session = await auth();
  return session?.user?.id ?? null;
}

// ---------------------------------------------------------------------------
// POST /api/import
// Body: { files: Array<{ origin, relativePath, content, toolType? }> }
// Returns: { results: Array<{ relativePath, status, skillId }> }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { files?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json({ error: "files array is required" }, { status: 400 });
  }
  if (body.files.length > 200) {
    return NextResponse.json({ error: "Maximum 200 files per import" }, { status: 400 });
  }

  type FileInput = { origin: SkillOrigin; relativePath: string; content: string; toolType?: string };

  const results: { relativePath: string; status: string; skillId: string }[] = [];

  try {
  for (const rawFile of body.files) {
    const file = rawFile as FileInput;
    if (
      typeof file.origin !== "string" ||
      typeof file.relativePath !== "string" ||
      typeof file.content !== "string"
    ) {
      results.push({ relativePath: String((rawFile as Record<string, unknown>).relativePath ?? "?"), status: "error:invalid_shape", skillId: "" });
      continue;
    }

    const parsed = parseSkillFile(file.content, file.origin, file.relativePath);
    if (typeof file.toolType === "string") {
      if (!["Claude", "Cursor", "Both"].includes(file.toolType)) {
        results.push({ relativePath: file.relativePath, status: "error:invalid_tool_type", skillId: "" });
        continue;
      }
      parsed.toolType = file.toolType as ToolType;
    }
    const sourceKey = buildSourceKey(userId, file.origin, file.relativePath);

    // Look up existing skill by sourceKey
    const existing = await prisma.skill.findUnique({
      where: { authorId_sourceKey: { authorId: userId, sourceKey } },
      select: { id: true, contentHash: true, toolType: true },
    });

    if (existing) {
      if (existing.contentHash === parsed.contentHash && existing.toolType === parsed.toolType) {
        results.push({ relativePath: file.relativePath, status: "unchanged", skillId: existing.id });
        continue;
      }
      // Updated — overwrite in place
      const updated = await prisma.skill.update({
        where: { id: existing.id },
        data: {
          title: parsed.title,
          description: parsed.description || undefined,
          content: parsed.content,
          toolType: parsed.toolType as ToolType,
          tags: parsed.tags,
          contentHash: parsed.contentHash,
        },
      });
      results.push({ relativePath: file.relativePath, status: "updated", skillId: updated.id });
    } else {
      // New — generate AI description if missing
      let description = parsed.description;
      if (!description) {
        try {
          description = await generateDescription(parsed.content);
        } catch {
          description = "";
        }
      }
      const created = await prisma.skill.create({
        data: {
          title: parsed.title,
          description,
          content: parsed.content,
          toolType: parsed.toolType as ToolType,
          tags: parsed.tags,
          authorId: userId,
          sourceKey,
          contentHash: parsed.contentHash,
        },
      });
      console.log(JSON.stringify({ event: "skill_submit", skillId: created.id, userId, source: "bulk_import" }));
      results.push({ relativePath: file.relativePath, status: "new", skillId: created.id });
    }
  }
  } catch (err) {
    console.error("import route error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ results });
}
