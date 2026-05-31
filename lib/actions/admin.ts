"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setConfigValue, type ConfigKey } from "@/lib/config";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) throw new Error("Admin only.");
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------
export async function hideSkill(skillId: string, hidden: boolean) {
  await requireAdmin();
  await prisma.skill.update({ where: { id: skillId }, data: { hidden } });
  revalidatePath("/admin/moderation");
  revalidatePath("/explore");
}

export async function deleteSkill(skillId: string) {
  await requireAdmin();
  await prisma.skill.delete({ where: { id: skillId } });
  revalidatePath("/admin/moderation");
  revalidatePath("/explore");
}

export async function hideComment(commentId: string, hidden: boolean) {
  await requireAdmin();
  await prisma.comment.update({ where: { id: commentId }, data: { hidden } });
  revalidatePath("/admin/moderation");
}

export async function deleteComment(commentId: string) {
  await requireAdmin();
  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath("/admin/moderation");
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export async function saveConfigAction(
  entries: Partial<Record<ConfigKey, string>>
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  await Promise.all(
    Object.entries(entries).map(([k, v]) =>
      setConfigValue(k as ConfigKey, v as string)
    )
  );
  revalidatePath("/admin/config");
  return { ok: true, message: "Config saved." };
}
