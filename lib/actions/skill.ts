"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateDescription } from "@/lib/ai";
import { ToolType } from "@/app/generated/prisma/client";

// ---------------------------------------------------------------------------
// Generate AI description (called from client via server action)
// ---------------------------------------------------------------------------
export async function generateDescriptionAction(
  content: string
): Promise<{ description: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };
  if (!content.trim()) return { error: "Paste some skill content first." };

  try {
    const description = await generateDescription(content);
    return { description };
  } catch {
    return { error: "Failed to generate description. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Check for possible duplicates (soft warning — never blocks)
// ---------------------------------------------------------------------------
export async function checkDuplicatesAction(
  title: string
): Promise<{ id: string; title: string }[]> {
  if (!title.trim()) return [];
  return prisma.skill.findMany({
    where: { title: { contains: title.trim(), mode: "insensitive" } },
    select: { id: true, title: true },
    take: 3,
  });
}

// ---------------------------------------------------------------------------
// Submit a new skill
// ---------------------------------------------------------------------------
export async function submitSkillAction(formData: FormData): Promise<{ error: string } | never> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const toolType = (formData.get("toolType") as string | null) ?? "";
  const tagsRaw = (formData.get("tags") as string | null) ?? "";

  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Validation
  if (!title) return { error: "Title is required." };
  if (!content) return { error: "Skill content is required." };
  if (tags.length === 0) return { error: "At least one tag is required." };
  if (!["Claude", "Cursor", "Both"].includes(toolType))
    return { error: "Select a tool type." };

  const skill = await prisma.skill.create({
    data: {
      title,
      content,
      description,
      toolType: toolType as ToolType,
      tags,
      authorId: session.user.id,
    },
  });

  console.log(JSON.stringify({ event: "skill_submit", skillId: skill.id, userId: session.user.id }));

  revalidatePath("/");
  redirect(`/skill/${skill.id}`);
}

// ---------------------------------------------------------------------------
// Copy a skill (dedup per user; logs CopyEvent)
// ---------------------------------------------------------------------------
export async function copySkillAction(skillId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };

  try {
    await prisma.copyEvent.upsert({
      where: { skillId_userId: { skillId, userId: session.user.id } },
      create: { skillId, userId: session.user.id },
      update: {},
    });
  } catch {
    // Already exists — ignore
  }

  console.log(JSON.stringify({ event: "copy", skillId, userId: session.user.id }));
  revalidatePath(`/skill/${skillId}`);
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Toggle upvote (no self-vote)
// ---------------------------------------------------------------------------
export async function toggleVoteAction(skillId: string): Promise<{ ok: boolean; voted: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, voted: false, error: "Not signed in." };

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { authorId: true } });
  if (!skill) return { ok: false, voted: false, error: "Skill not found." };
  if (skill.authorId === session.user.id) return { ok: false, voted: false, error: "Cannot upvote your own skill." };

  const existing = await prisma.vote.findUnique({
    where: { skillId_userId: { skillId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.vote.delete({ where: { skillId_userId: { skillId, userId: session.user.id } } });
    console.log(JSON.stringify({ event: "upvote", skillId, userId: session.user.id, action: "remove" }));
    revalidatePath(`/skill/${skillId}`);
    return { ok: true, voted: false };
  } else {
    await prisma.vote.create({ data: { skillId, userId: session.user.id } });
    console.log(JSON.stringify({ event: "upvote", skillId, userId: session.user.id, action: "add" }));
    revalidatePath(`/skill/${skillId}`);
    return { ok: true, voted: true };
  }
}

// ---------------------------------------------------------------------------
// Add a comment (1-level threading via parentId)
// ---------------------------------------------------------------------------
export async function addCommentAction(
  skillId: string,
  body: string,
  parentId?: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };
  if (!body.trim()) return { ok: false, error: "Comment body is required." };

  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.skillId !== skillId) return { ok: false, error: "Invalid parent comment." };
    if (parent.parentId) return { ok: false, error: "Only one level of threading allowed." };
  }

  await prisma.comment.create({
    data: { skillId, userId: session.user.id, body: body.trim(), parentId: parentId ?? null },
  });

  console.log(JSON.stringify({ event: "comment", skillId, userId: session.user.id }));
  revalidatePath(`/skill/${skillId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Edit own comment
// ---------------------------------------------------------------------------
export async function editCommentAction(
  commentId: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };
  if (!body.trim()) return { ok: false, error: "Comment body is required." };

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true, skillId: true } });
  if (!comment) return { ok: false, error: "Comment not found." };
  if (comment.userId !== session.user.id) return { ok: false, error: "Not your comment." };

  await prisma.comment.update({
    where: { id: commentId },
    data: { body: body.trim(), editedAt: new Date() },
  });

  revalidatePath(`/skill/${comment.skillId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Delete own comment
// ---------------------------------------------------------------------------
export async function deleteCommentAction(commentId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };

  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true, skillId: true } });
  if (!comment) return { ok: false, error: "Comment not found." };
  if (comment.userId !== session.user.id) return { ok: false, error: "Not your comment." };

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath(`/skill/${comment.skillId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Edit own skill (author only)
// ---------------------------------------------------------------------------
export async function updateSkillAction(
  skillId: string,
  formData: FormData
): Promise<{ error: string } | never> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { authorId: true } });
  if (!skill) return { error: "Skill not found." };
  if (skill.authorId !== session.user.id) return { error: "Not your skill." };

  const title       = (formData.get("title") as string | null)?.trim() ?? "";
  const content     = (formData.get("content") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() ?? "";
  const toolType    = (formData.get("toolType") as string | null) ?? "";
  const tagsRaw     = (formData.get("tags") as string | null) ?? "";
  const tags        = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

  if (!title)              return { error: "Title is required." };
  if (!content)            return { error: "Skill content is required." };
  if (tags.length === 0)   return { error: "At least one tag is required." };
  if (!["Claude", "Cursor", "Both"].includes(toolType)) return { error: "Select a tool type." };

  await prisma.skill.update({
    where: { id: skillId },
    data: { title, content, description, toolType: toolType as ToolType, tags },
  });

  revalidatePath(`/skill/${skillId}`);
  revalidatePath("/explore");
  revalidatePath("/");
  redirect(`/skill/${skillId}`);
}
