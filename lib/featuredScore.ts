/**
 * Featured Score — spec §5
 *
 * score = copies×5 + comments×3 + uniqueCommenters×2 + upvotes×2
 *
 * All counts exclude the author's own actions (anti-gaming).
 * Window is configurable (monthly or all-time via FEATURED_SCORE_WINDOW).
 */

// ---------------------------------------------------------------------------
// Config (admin-tunable — read from env; fall back to spec defaults)
// ---------------------------------------------------------------------------
export interface ScoreWeights {
  copies: number;          // default 5
  comments: number;        // default 3
  uniqueCommenters: number;// default 2
  upvotes: number;         // default 2
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  copies: 5,
  comments: 3,
  uniqueCommenters: 2,
  upvotes: 2,
};

export function getWeightsFromEnv(): ScoreWeights {
  return {
    copies:           Number(process.env.SCORE_WEIGHT_COPIES           ?? DEFAULT_WEIGHTS.copies),
    comments:         Number(process.env.SCORE_WEIGHT_COMMENTS         ?? DEFAULT_WEIGHTS.comments),
    uniqueCommenters: Number(process.env.SCORE_WEIGHT_UNIQUE_COMMENTERS ?? DEFAULT_WEIGHTS.uniqueCommenters),
    upvotes:          Number(process.env.SCORE_WEIGHT_UPVOTES          ?? DEFAULT_WEIGHTS.upvotes),
  };
}

// Minimum distinct non-author copiers for auto-eligibility (admin-tunable)
export const DEFAULT_MIN_COPIERS = 5;
export function getMinCopiersFromEnv(): number {
  return Number(process.env.SCORE_MIN_COPIERS ?? DEFAULT_MIN_COPIERS);
}

// ---------------------------------------------------------------------------
// Core data types (plain objects — no Prisma dependency)
// ---------------------------------------------------------------------------
export interface ActionRecord {
  userId: string;
  createdAt: Date;
}

export interface SkillActivity {
  skillId: string;
  authorId: string;
  createdAt: Date;           // skill creation date (used as tiebreaker proxy)
  copies: ActionRecord[];    // all CopyEvent rows in window
  comments: ActionRecord[];  // all Comment rows in window
  upvotes: ActionRecord[];   // all Vote rows (votes have no window — use all-time)
}

export interface ScoreBreakdown {
  skillId: string;
  score: number;
  // Components (excluding author)
  nonAuthorCopies: number;
  nonAuthorComments: number;
  uniqueNonAuthorCommenters: number;
  nonAuthorUpvotes: number;
  // Tiebreaker fields
  uniqueNonAuthorCopiers: number; // = distinct copier user IDs
  mostRecentActivity: Date | null;
}

// ---------------------------------------------------------------------------
// computeScore — pure function, no I/O
// ---------------------------------------------------------------------------
export function computeScore(
  activity: SkillActivity,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): ScoreBreakdown {
  const { authorId, copies, comments, upvotes } = activity;

  const nonAuthorCopies    = copies.filter((c) => c.userId !== authorId);
  const nonAuthorComments  = comments.filter((c) => c.userId !== authorId);
  const nonAuthorUpvotes   = upvotes.filter((v) => v.userId !== authorId);

  const uniqueCopierIds    = new Set(nonAuthorCopies.map((c) => c.userId));
  const uniqueCommenterIds = new Set(nonAuthorComments.map((c) => c.userId));

  const score =
    nonAuthorCopies.length           * weights.copies +
    nonAuthorComments.length         * weights.comments +
    uniqueCommenterIds.size          * weights.uniqueCommenters +
    nonAuthorUpvotes.length          * weights.upvotes;

  // Most recent non-author action across all activity types
  const allDates = [
    ...nonAuthorCopies,
    ...nonAuthorComments,
    ...nonAuthorUpvotes,
  ].map((a) => a.createdAt.getTime());
  const mostRecentActivity =
    allDates.length > 0 ? new Date(Math.max(...allDates)) : null;

  return {
    skillId:                    activity.skillId,
    score,
    nonAuthorCopies:            nonAuthorCopies.length,
    nonAuthorComments:          nonAuthorComments.length,
    uniqueNonAuthorCommenters:  uniqueCommenterIds.size,
    nonAuthorUpvotes:           nonAuthorUpvotes.length,
    uniqueNonAuthorCopiers:     uniqueCopierIds.size,
    mostRecentActivity,
  };
}

// ---------------------------------------------------------------------------
// Eligibility check — pure function
// ---------------------------------------------------------------------------
export interface EligibilityInput {
  breakdown: ScoreBreakdown;
  lastFeaturedAt: Date | null; // null = never featured
  authorIsActive: boolean;
  now?: Date;                  // injectable for testing
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export function checkEligibility({
  breakdown,
  lastFeaturedAt,
  authorIsActive,
  now = new Date(),
}: EligibilityInput): EligibilityResult {
  if (!authorIsActive) {
    return { eligible: false, reason: "Author is not an active employee." };
  }

  if (lastFeaturedAt !== null) {
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    if (lastFeaturedAt > twelveMonthsAgo) {
      return {
        eligible: false,
        reason: `Featured within the last 12 months (${lastFeaturedAt.toISOString().slice(0, 10)}).`,
      };
    }
  }

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// rankEligible — sort by score then tiebreakers, return only eligible skills
// Tiebreaker order (spec §5): unique copiers → total copies → unique commenters → most recent activity
// ---------------------------------------------------------------------------
export function rankEligible(
  activities: SkillActivity[],
  featuredHistory: Map<string, Date | null>, // skillId → last featured date
  activeAuthorIds: Set<string>,
  weights: ScoreWeights = DEFAULT_WEIGHTS
): ScoreBreakdown[] {
  const breakdowns = activities.map((a) => computeScore(a, weights));

  const eligible = breakdowns.filter((b) => {
    const { eligible } = checkEligibility({
      breakdown: b,
      lastFeaturedAt: featuredHistory.get(b.skillId) ?? null,
      authorIsActive: activeAuthorIds.has(
        activities.find((a) => a.skillId === b.skillId)!.authorId
      ),
    });
    return eligible;
  });

  eligible.sort((a, b) => {
    // Primary: score
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreaker 1: unique copiers
    if (b.uniqueNonAuthorCopiers !== a.uniqueNonAuthorCopiers)
      return b.uniqueNonAuthorCopiers - a.uniqueNonAuthorCopiers;
    // Tiebreaker 2: total copies
    if (b.nonAuthorCopies !== a.nonAuthorCopies)
      return b.nonAuthorCopies - a.nonAuthorCopies;
    // Tiebreaker 3: unique commenters
    if (b.uniqueNonAuthorCommenters !== a.uniqueNonAuthorCommenters)
      return b.uniqueNonAuthorCommenters - a.uniqueNonAuthorCommenters;
    // Tiebreaker 4: most recent activity
    const aTime = a.mostRecentActivity?.getTime() ?? 0;
    const bTime = b.mostRecentActivity?.getTime() ?? 0;
    return bTime - aTime;
  });

  return eligible;
}

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------
export type ScoreWindow = "monthly" | "alltime" | "7days";

export function getWindowFromEnv(): ScoreWindow {
  const val = process.env.FEATURED_SCORE_WINDOW ?? "monthly";
  if (val === "alltime" || val === "7days") return val;
  return "monthly";
}

export function windowStart(window: ScoreWindow, now: Date = new Date()): Date | null {
  if (window === "alltime") return null;
  if (window === "7days") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  // monthly: start of current calendar month
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
