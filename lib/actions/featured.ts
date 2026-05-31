"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRankedEligibleSkills } from "@/lib/queries/featured";
import { sendFeaturedEmail, type FeaturedEmailPayload } from "@/lib/email";
import { getConfig } from "@/lib/config";

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) throw new Error("Admin only.");
  return session;
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Auto-select top eligible skill (runs on 1st of month or on-demand by admin)
// ---------------------------------------------------------------------------
export async function runAutoSelection(): Promise<{ ok: boolean; message: string }> {
  const session = await requireAdmin();
  const ranked = await getRankedEligibleSkills();

  if (ranked.length === 0) {
    return { ok: false, message: "No eligible skills found." };
  }

  const top = ranked[0];
  const period = currentPeriod();

  // Avoid creating a duplicate for the same period
  const existing = await prisma.feature.findFirst({
    where: { period, status: { not: "sent" } },
  });
  if (existing) {
    return { ok: false, message: `A pending feature already exists for ${period}.` };
  }

  await prisma.feature.create({
    data: {
      skillId:      top.skillId,
      period,
      type:         "auto",
      status:       "pending_note",
      selectedById: session.user.id,
    },
  });

  console.log(JSON.stringify({ event: "feature_selected", skillId: top.skillId, type: "auto" }));
  revalidatePath("/admin");
  revalidatePath("/admin/featured");
  redirect("/admin/featured");
}

// ---------------------------------------------------------------------------
// Manually feature a specific skill (admin only, bypasses 12-month cooldown with confirm)
// ---------------------------------------------------------------------------
export async function manualFeatureSkill(
  skillId: string,
  bypassCooldown = false
): Promise<{ ok: boolean; message: string; needsConfirm?: boolean }> {
  const session = await requireAdmin();

  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) return { ok: false, message: "Skill not found." };

  // Check 12-month cooldown unless bypassed
  if (!bypassCooldown) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const recentFeature = await prisma.feature.findFirst({
      where: { skillId, selectedAt: { gt: twelveMonthsAgo } },
    });
    if (recentFeature) {
      return {
        ok: false,
        needsConfirm: true,
        message: `This skill was featured within the last 12 months (${recentFeature.selectedAt.toISOString().slice(0, 10)}). Confirm to bypass.`,
      };
    }
  }

  const period = currentPeriod();
  await prisma.feature.create({
    data: {
      skillId,
      period,
      type:         "manual",
      status:       "pending_note",
      selectedById: session.user.id,
    },
  });

  console.log(JSON.stringify({ event: "feature_selected", skillId, type: "manual" }));
  revalidatePath("/admin");
  revalidatePath("/admin/featured");
  redirect("/admin/featured");
}

// ---------------------------------------------------------------------------
// Creator submits their note (called from /creator-note/[featureId])
// ---------------------------------------------------------------------------
export async function submitCreatorNote(
  featureId: string,
  note: string
): Promise<{ ok: boolean; message: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Not signed in." };

  const feature = await prisma.feature.findUnique({
    where: { id: featureId },
    include: { skill: { select: { authorId: true } } },
  });

  if (!feature) return { ok: false, message: "Feature not found." };
  if (feature.skill.authorId !== session.user.id) {
    return { ok: false, message: "Only the skill author can submit a note." };
  }
  if (feature.status === "sent") {
    return { ok: false, message: "This feature has already been sent." };
  }

  await prisma.feature.update({
    where: { id: featureId },
    data: { creatorNote: note.trim() || null, status: "ready" },
  });

  revalidatePath("/admin/featured");
  return { ok: true, message: "Note saved. Thank you!" };
}

// ---------------------------------------------------------------------------
// Admin updates the email copy (creatorNote, or swaps the skill)
// ---------------------------------------------------------------------------
export async function updateFeatureDraft(
  featureId: string,
  data: { creatorNote?: string; skillId?: string }
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();

  const feature = await prisma.feature.findUnique({ where: { id: featureId } });
  if (!feature || feature.status === "sent") {
    return { ok: false, message: "Feature not found or already sent." };
  }

  await prisma.feature.update({
    where: { id: featureId },
    data: {
      ...(data.creatorNote !== undefined ? { creatorNote: data.creatorNote || null } : {}),
      ...(data.skillId ? { skillId: data.skillId } : {}),
      status: "ready",
    },
  });

  revalidatePath("/admin/featured");
  return { ok: true, message: "Draft updated." };
}

// ---------------------------------------------------------------------------
// Send the featured email org-wide
// ---------------------------------------------------------------------------
export async function sendFeaturedEmailAction(
  featureId: string
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();

  const feature = await prisma.feature.findUnique({
    where: { id: featureId },
    include: {
      skill: {
        include: {
          author: { select: { name: true } },
          _count: { select: { votes: true, comments: true, copies: true } },
        },
      },
    },
  });

  if (!feature) return { ok: false, message: "Feature not found." };
  if (feature.status === "sent") return { ok: false, message: "Already sent." };

  const config = await getConfig();
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // Build recipient list
  let recipients: string[];
  const recipientList = config.FEATURED_RECIPIENT_LIST.trim();
  if (recipientList) {
    recipients = recipientList.split(",").map((e) => e.trim()).filter(Boolean);
  } else {
    const users = await prisma.user.findMany({ select: { email: true } });
    recipients = users.map((u) => u.email);
  }

  const payload: FeaturedEmailPayload = {
    skill: {
      id:          feature.skill.id,
      title:       feature.skill.title,
      description: feature.skill.description,
      toolType:    feature.skill.toolType,
      tags:        feature.skill.tags,
      copies:      feature.skill._count.copies,
      upvotes:     feature.skill._count.votes,
      comments:    feature.skill._count.comments,
    },
    author:      feature.skill.author,
    creatorNote: feature.creatorNote,
    appUrl,
    featureId:   featureId,
  };

  const result = await sendFeaturedEmail(payload, recipients);

  if (!result.ok) {
    return { ok: false, message: `Email failed: ${result.error}` };
  }

  await prisma.feature.update({
    where: { id: featureId },
    data: { status: "sent", sentAt: new Date() },
  });

  console.log(JSON.stringify({ event: "email_sent", featureId, recipients: recipients.length }));
  revalidatePath("/admin/featured");
  revalidatePath("/");
  return { ok: true, message: `Email sent to ${recipients.length} recipients.` };
}
