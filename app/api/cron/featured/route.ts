/**
 * Monthly featured-skill auto-selection cron job.
 *
 * Vercel Cron: runs at 00:00 UTC on the 1st of every month (configured in vercel.json).
 * Protected by CRON_SECRET — Vercel sets the Authorization header automatically.
 *
 * Can also be triggered manually by an admin via the admin console (runAutoSelection action).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankedEligibleSkills } from "@/lib/queries/featured";

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  // Verify Vercel's cron secret (or CRON_SECRET env var for self-hosted)
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = currentPeriod();

  // Idempotent: skip if a feature already exists for this period
  const existing = await prisma.feature.findFirst({
    where: { period },
  });
  if (existing) {
    return NextResponse.json({ ok: true, message: `Feature already exists for ${period}.` });
  }

  const ranked = await getRankedEligibleSkills();
  if (ranked.length === 0) {
    console.log(JSON.stringify({ event: "cron_featured_skip", period, reason: "no_eligible_skills" }));
    return NextResponse.json({ ok: false, message: "No eligible skills found." });
  }

  const top = ranked[0];

  // Use a system user id — find the first admin in the DB as the selector
  const systemUser = await prisma.user.findFirst({ where: { isAdmin: true }, select: { id: true } });
  if (!systemUser) {
    return NextResponse.json({ ok: false, message: "No admin user found to assign as selector." }, { status: 500 });
  }

  await prisma.feature.create({
    data: {
      skillId:      top.skillId,
      period,
      type:         "auto",
      status:       "pending_note",
      selectedById: systemUser.id,
    },
  });

  console.log(JSON.stringify({ event: "feature_selected", skillId: top.skillId, type: "auto", period, trigger: "cron" }));

  return NextResponse.json({ ok: true, message: `Featured ${top.skillId} for ${period}.` });
}
