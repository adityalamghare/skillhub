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

  // Log event (fire-and-forget)
  console.log(JSON.stringify({ event: "skill_submit", skillId: skill.id, userId: session.user.id }));

  revalidatePath("/");
  redirect(`/skill/${skill.id}`);
}
