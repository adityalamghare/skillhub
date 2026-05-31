import { prisma } from "@/lib/prisma";
import { ToolType } from "@/app/generated/prisma/client";

export const PAGE_SIZE = 12;

export type SortOption = "trending" | "copies" | "newest" | "upvotes";

export interface ExploreParams {
  q?: string;
  tool?: string;
  tag?: string;
  sort?: SortOption;
  page?: number;
}

export interface SkillCard {
  id: string;
  title: string;
  description: string;
  toolType: ToolType;
  tags: string[];
  createdAt: Date;
  author: { id: string; name: string; avatar: string | null };
  _count: { votes: number; comments: number; copies: number };
}

// ---------------------------------------------------------------------------
// Build the shared WHERE clause
// ---------------------------------------------------------------------------
function buildWhere(params: ExploreParams) {
  const { q, tool, tag } = params;

  return {
    hidden: false, // never show hidden skills to regular users
    ...(tool && Object.values(ToolType).includes(tool as ToolType)
      ? { toolType: tool as ToolType }
      : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(q?.trim()
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { content: { contains: q, mode: "insensitive" as const } },
            { tags: { has: q.toLowerCase() } },
          ],
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Trending: score = copies×5 + comments×3 + uniqueCommenters×2 + upvotes×2
// over rolling 7 days, excluding author's own actions.
// Returns ordered skill IDs.
// ---------------------------------------------------------------------------
async function getTrendingIds(
  where: ReturnType<typeof buildWhere>,
  skip: number,
  take: number
): Promise<{ ids: string[]; total: number }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch all matching skills with their 7-day activity counts
  const skills = await prisma.skill.findMany({
    where,
    select: {
      id: true,
      authorId: true,
      copies: {
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
      },
      comments: {
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
      },
      votes: {
        select: { userId: true },
      },
    },
  });

  const scored = skills.map((s) => {
    const copies = s.copies.filter((c) => c.userId !== s.authorId).length;
    const comments = s.comments.filter((c) => c.userId !== s.authorId).length;
    const uniqueCommenters = new Set(
      s.comments.filter((c) => c.userId !== s.authorId).map((c) => c.userId)
    ).size;
    const upvotes = s.votes.filter((v) => v.userId !== s.authorId).length;
    const score = copies * 5 + comments * 3 + uniqueCommenters * 2 + upvotes * 2;
    return { id: s.id, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    ids: scored.slice(skip, skip + take).map((s) => s.id),
    total: scored.length,
  };
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------
export async function getSkills(params: ExploreParams): Promise<{
  skills: SkillCard[];
  total: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;
  const sort: SortOption = params.sort ?? "trending";
  const where = buildWhere(params);

  const include = {
    author: { select: { id: true, name: true, avatar: true } },
    _count: { select: { votes: true, comments: true, copies: true } },
  };

  if (sort === "trending") {
    const { ids, total } = await getTrendingIds(where, skip, PAGE_SIZE);
    if (ids.length === 0) return { skills: [], total, totalPages: Math.ceil(total / PAGE_SIZE) };

    const skills = await prisma.skill.findMany({
      where: { id: { in: ids } },
      include,
    });

    // Re-apply the trending order (findMany doesn't preserve IN order)
    const ordered = ids
      .map((id) => skills.find((s) => s.id === id))
      .filter(Boolean) as typeof skills;

    return { skills: ordered, total, totalPages: Math.ceil(total / PAGE_SIZE) };
  }

  const orderBy =
    sort === "copies"
      ? { copies: { _count: "desc" as const } }
      : sort === "upvotes"
      ? { votes: { _count: "desc" as const } }
      : { createdAt: "desc" as const };

  const [skills, total] = await Promise.all([
    prisma.skill.findMany({ where, include, orderBy, skip, take: PAGE_SIZE }),
    prisma.skill.count({ where }),
  ]);

  return { skills, total, totalPages: Math.ceil(total / PAGE_SIZE) };
}

// ---------------------------------------------------------------------------
// All distinct tags (for the filter dropdown)
// ---------------------------------------------------------------------------
export async function getAllTags(): Promise<string[]> {
  const skills = await prisma.skill.findMany({ select: { tags: true } });
  const tagSet = new Set(skills.flatMap((s) => s.tags));
  return Array.from(tagSet).sort();
}
