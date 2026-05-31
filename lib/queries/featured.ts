import { prisma } from "@/lib/prisma";
import {
  getWeightsFromEnv,
  getWindowFromEnv,
  windowStart,
  rankEligible,
  computeScore,
  type SkillActivity,
  type ScoreBreakdown,
} from "@/lib/featuredScore";

// ---------------------------------------------------------------------------
// Load all skill activity from DB, apply window, rank eligible skills
// ---------------------------------------------------------------------------
export async function getRankedEligibleSkills(): Promise<ScoreBreakdown[]> {
  const window  = getWindowFromEnv();
  const weights = getWeightsFromEnv();
  const start   = windowStart(window);

  // Fetch all skills with their activity in the window
  const skills = await prisma.skill.findMany({
    select: {
      id: true,
      authorId: true,
      createdAt: true,
      copies: {
        where: start ? { createdAt: { gte: start } } : undefined,
        select: { userId: true, createdAt: true },
      },
      comments: {
        where: start ? { createdAt: { gte: start } } : undefined,
        select: { userId: true, createdAt: true },
      },
      votes: {
        select: { userId: true, createdAt: true },
      },
    },
  });

  const activities: SkillActivity[] = skills.map((s) => ({
    skillId:   s.id,
    authorId:  s.authorId,
    createdAt: s.createdAt,
    copies:    s.copies,
    comments:  s.comments,
    upvotes:   s.votes,
  }));

  // Build feature history map: skillId → most recent Feature.selectedAt
  const features = await prisma.feature.findMany({
    select: { skillId: true, selectedAt: true },
    orderBy: { selectedAt: "desc" },
  });
  const featuredHistory = new Map<string, Date | null>();
  for (const f of features) {
    if (!featuredHistory.has(f.skillId)) {
      featuredHistory.set(f.skillId, f.selectedAt);
    }
  }

  // All authors are considered active (no "deactivated" flag in v1).
  // When HR integration exists, filter here.
  const activeAuthorIds = new Set(skills.map((s) => s.authorId));

  return rankEligible(activities, featuredHistory, activeAuthorIds, weights);
}

// ---------------------------------------------------------------------------
// Score a single skill (used by admin console)
// ---------------------------------------------------------------------------
export async function getSkillScore(skillId: string): Promise<ScoreBreakdown | null> {
  const window = getWindowFromEnv();
  const start  = windowStart(window);
  const weights = getWeightsFromEnv();

  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    select: {
      id: true,
      authorId: true,
      createdAt: true,
      copies: {
        where: start ? { createdAt: { gte: start } } : undefined,
        select: { userId: true, createdAt: true },
      },
      comments: {
        where: start ? { createdAt: { gte: start } } : undefined,
        select: { userId: true, createdAt: true },
      },
      votes: { select: { userId: true, createdAt: true } },
    },
  });
  if (!skill) return null;

  return computeScore(
    {
      skillId:   skill.id,
      authorId:  skill.authorId,
      createdAt: skill.createdAt,
      copies:    skill.copies,
      comments:  skill.comments,
      upvotes:   skill.votes,
    },
    weights
  );
}
