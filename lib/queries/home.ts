import { prisma } from "@/lib/prisma";
import { computeScore } from "@/lib/featuredScore";
import { computeBadges, type BadgeInput } from "@/lib/badges";

const weekAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
};

// ---------------------------------------------------------------------------
// Hero — latest sent or ready Feature
// ---------------------------------------------------------------------------
export async function getHeroFeature() {
  return prisma.feature.findFirst({
    where: { status: { in: ["sent", "ready"] } },
    orderBy: { selectedAt: "desc" },
    include: {
      skill: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          _count: { select: { votes: true, comments: true, copies: true } },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Trending this week — top 5 by 7-day Featured Score
// ---------------------------------------------------------------------------
export async function getTrendingThisWeek(limit = 5) {
  const since = weekAgo();

  const skills = await prisma.skill.findMany({
    where: { hidden: false },
    select: {
      id: true, title: true, toolType: true, authorId: true, createdAt: true,
      author: { select: { name: true, avatar: true } },
      _count: { select: { votes: true, comments: true, copies: true } },
      copies:   { where: { createdAt: { gte: since } }, select: { userId: true, createdAt: true } },
      comments: { where: { createdAt: { gte: since } }, select: { userId: true, createdAt: true } },
      votes:    { select: { userId: true, createdAt: true } },
    },
  });

  const scored = skills
    .map((s) => ({
      ...s,
      score: computeScore({
        skillId: s.id, authorId: s.authorId, createdAt: s.createdAt,
        copies: s.copies, comments: s.comments, upvotes: s.votes,
      }).score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

// ---------------------------------------------------------------------------
// Top rated of all time — top N by non-self copy count
// ---------------------------------------------------------------------------
export async function getTopRatedAllTime(limit = 5) {
  return prisma.skill.findMany({
    where: { hidden: false },
    orderBy: { copies: { _count: "desc" } },
    take: limit,
    select: {
      id: true, title: true, toolType: true,
      author: { select: { name: true, avatar: true } },
      _count: { select: { votes: true, comments: true, copies: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Weekly stats strip
// ---------------------------------------------------------------------------
export async function getWeeklyStats() {
  const since = weekAgo();
  const [copiesThisWeek, newSkills, newComments, totalSkills] = await Promise.all([
    prisma.copyEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.skill.count({ where: { createdAt: { gte: since }, hidden: false } }),
    prisma.comment.count({ where: { createdAt: { gte: since }, hidden: false } }),
    prisma.skill.count({ where: { hidden: false } }),
  ]);
  return { copiesThisWeek, newSkills, newComments, totalSkills };
}

// ---------------------------------------------------------------------------
// Your impact (personal stats for the signed-in user)
// ---------------------------------------------------------------------------
export async function getUserImpact(userId: string) {
  const [mySkills, copiesReceived, upvotesReceived, commentsMade] = await Promise.all([
    prisma.skill.count({ where: { authorId: userId } }),
    // copies on my skills, excluding myself
    prisma.copyEvent.count({
      where: { skill: { authorId: userId }, userId: { not: userId } },
    }),
    // upvotes on my skills, excluding myself
    prisma.vote.count({
      where: { skill: { authorId: userId }, userId: { not: userId } },
    }),
    prisma.comment.count({ where: { userId } }),
  ]);

  // Was any of my skills ever featured?
  const featured = await prisma.feature.findFirst({
    where: { skill: { authorId: userId } },
  });

  const badgeInput: BadgeInput = {
    skillCount:       mySkills,
    nonSelfCopyCount: copiesReceived,
    wasFeatured:      !!featured,
    commentCount:     commentsMade,
  };

  return {
    mySkills,
    copiesReceived,
    upvotesReceived,
    badges: computeBadges(badgeInput),
  };
}

// ---------------------------------------------------------------------------
// Leaderboards — top 5 each, exclude self-actions
// ---------------------------------------------------------------------------
export async function getLeaderboards() {
  // Most-copied creators: sum non-self CopyEvents per author
  const allCopies = await prisma.copyEvent.findMany({
    select: { userId: true, skill: { select: { authorId: true } } },
  });
  const copyMap = new Map<string, number>();
  for (const c of allCopies) {
    if (c.userId !== c.skill.authorId) {
      copyMap.set(c.skill.authorId, (copyMap.get(c.skill.authorId) ?? 0) + 1);
    }
  }

  // Highest upvotes received: sum non-self Votes per author
  const allVotes = await prisma.vote.findMany({
    select: { userId: true, skill: { select: { authorId: true } } },
  });
  const voteMap = new Map<string, number>();
  for (const v of allVotes) {
    if (v.userId !== v.skill.authorId) {
      voteMap.set(v.skill.authorId, (voteMap.get(v.skill.authorId) ?? 0) + 1);
    }
  }

  // Top submitters: skill count per author
  const skillCounts = await prisma.skill.groupBy({
    by: ["authorId"],
    where: { hidden: false },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  // Fetch user details for all referenced author IDs
  const authorIds = Array.from(
    new Set([
      ...Array.from(copyMap.keys()),
      ...Array.from(voteMap.keys()),
      ...skillCounts.map((s) => s.authorId),
    ])
  );
  const users = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, name: true, avatar: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  function topN(map: Map<string, number>, n = 5) {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([authorId, count]) => ({
        user: userMap.get(authorId) ?? { id: authorId, name: "Unknown", avatar: null },
        count,
      }));
  }

  return {
    mostCopied:     topN(copyMap),
    mostUpvoted:    topN(voteMap),
    topSubmitters:  skillCounts.slice(0, 5).map((s) => ({
      user:  userMap.get(s.authorId) ?? { id: s.authorId, name: "Unknown", avatar: null },
      count: s._count.id,
    })),
  };
}
