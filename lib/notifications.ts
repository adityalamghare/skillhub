/**
 * In-product notifications for skill authors.
 *
 * Content is *derived* from Vote / CopyEvent / Comment (consistent with the
 * "counters are derived" rule) and grouped per (skill, kind) — groups never
 * combine across skills. Read state is tracked per recipient in NotificationView.
 *
 * A group is "unread" when its latest activity is newer than the recipient's
 * seenAt for that (skill, kind), or when they've never viewed it.
 */
import { prisma } from "@/lib/prisma";

export type NotificationKind = "upvote" | "copy" | "comment" | "thread_reply";

const MAX_NAMES = 3; // distinct actor names shown before the "+N" overflow

export interface NotificationGroup {
  skillId: string;
  skillTitle: string;
  kind: NotificationKind;
  actors: string[];     // up to MAX_NAMES most-recent distinct actor names
  extraCount: number;   // distinct actors beyond the shown names
  latestAt: string;     // ISO timestamp of most recent activity
  unread: boolean;
}

interface RawEvent {
  skillId: string;
  name: string;
  createdAt: Date;
}

function groupEvents(
  events: RawEvent[],
  kind: NotificationKind,
  titleById: Map<string, string>,
  seenByKey: Map<string, Date>
): NotificationGroup[] {
  // events arrive most-recent-first
  const bySkill = new Map<string, RawEvent[]>();
  for (const e of events) {
    const list = bySkill.get(e.skillId);
    if (list) list.push(e);
    else bySkill.set(e.skillId, [e]);
  }

  const groups: NotificationGroup[] = [];
  for (const [skillId, list] of bySkill) {
    const title = titleById.get(skillId);
    if (!title) continue; // skill deleted/unknown — skip

    // distinct actor names, preserving most-recent-first order
    const seenNames = new Set<string>();
    const actors: string[] = [];
    for (const e of list) {
      if (seenNames.has(e.name)) continue;
      seenNames.add(e.name);
      if (actors.length < MAX_NAMES) actors.push(e.name);
    }

    const latest = list[0].createdAt;
    const seenAt = seenByKey.get(`${skillId}:${kind}`);
    groups.push({
      skillId,
      skillTitle: title,
      kind,
      actors,
      extraCount: Math.max(0, seenNames.size - actors.length),
      latestAt: latest.toISOString(),
      unread: !seenAt || latest > seenAt,
    });
  }
  return groups;
}

async function buildThreadReplyGroups(
  userId: string,
  titleById: Map<string, string>,
  seenByKey: Map<string, Date>
): Promise<NotificationGroup[]> {
  // Find root comment threads on *other authors'* skills where userId participated.
  // "Participated" = left any comment (root or reply) on that skill.
  const participation = await prisma.comment.findMany({
    where: { userId, hidden: false },
    select: { skillId: true, parentId: true, id: true },
    distinct: ["skillId"],
  });

  // Collect distinct skillIds where user commented but is NOT the author
  const participatedSkillIds = participation.map((p) => p.skillId);
  if (participatedSkillIds.length === 0) return [];

  // Get the root commentIds in each skill's threads where user participated
  const userComments = await prisma.comment.findMany({
    where: { userId, skillId: { in: participatedSkillIds }, hidden: false },
    select: { skillId: true, id: true, parentId: true },
  });

  // For each skill, collect the rootCommentIds user is part of
  const rootIdsBySkill = new Map<string, Set<string>>();
  for (const c of userComments) {
    const rootId = c.parentId ?? c.id; // root comment id
    const set = rootIdsBySkill.get(c.skillId) ?? new Set();
    set.add(rootId);
    rootIdsBySkill.set(c.skillId, set);
  }

  // Fetch all skill titles for participated skills (may include own skills — filter below)
  const participatedSkills = await prisma.skill.findMany({
    where: { id: { in: participatedSkillIds }, authorId: { not: userId } },
    select: { id: true, title: true },
  });

  const participatedTitleById = new Map(participatedSkills.map((s) => [s.id, s.title]));

  // Find new replies by others in those root threads
  const replyEvents: RawEvent[] = [];

  for (const [skillId, rootIds] of rootIdsBySkill) {
    if (!participatedTitleById.has(skillId)) continue; // skip own skills

    const replies = await prisma.comment.findMany({
      where: {
        skillId,
        parentId: { in: Array.from(rootIds) },
        userId: { not: userId },
        hidden: false,
      },
      select: { skillId: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    for (const r of replies) {
      replyEvents.push({ skillId: r.skillId, createdAt: r.createdAt, name: r.user.name });
    }
  }

  return groupEvents(replyEvents, "thread_reply", participatedTitleById, seenByKey);
}

async function buildGroups(userId: string): Promise<NotificationGroup[]> {
  const skills = await prisma.skill.findMany({
    where: { authorId: userId },
    select: { id: true, title: true },
  });

  const skillIds = skills.map((s) => s.id);
  const titleById = new Map(skills.map((s) => [s.id, s.title]));

  const views = await prisma.notificationView.findMany({
    where: { userId },
    select: { skillId: true, kind: true, seenAt: true },
  });
  const seenByKey = new Map(views.map((v) => [`${v.skillId}:${v.kind}`, v.seenAt]));

  const notSelf = skillIds.length > 0
    ? { skillId: { in: skillIds }, userId: { not: userId } }
    : null;

  const [votes, copies, comments, threadReplyGroups] = await Promise.all([
    notSelf
      ? prisma.vote.findMany({
          where: notSelf,
          select: { skillId: true, createdAt: true, user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    notSelf
      ? prisma.copyEvent.findMany({
          where: notSelf,
          select: { skillId: true, createdAt: true, user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    notSelf
      ? prisma.comment.findMany({
          where: { ...notSelf, hidden: false },
          select: { skillId: true, createdAt: true, user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    buildThreadReplyGroups(userId, titleById, seenByKey),
  ]);

  const toRaw = (rows: { skillId: string; createdAt: Date; user: { name: string } }[]): RawEvent[] =>
    rows.map((r) => ({ skillId: r.skillId, createdAt: r.createdAt, name: r.user.name }));

  const groups = [
    ...groupEvents(toRaw(votes), "upvote", titleById, seenByKey),
    ...groupEvents(toRaw(copies), "copy", titleById, seenByKey),
    ...groupEvents(toRaw(comments), "comment", titleById, seenByKey),
    ...threadReplyGroups,
  ];

  groups.sort((a, b) => (a.latestAt < b.latestAt ? 1 : a.latestAt > b.latestAt ? -1 : 0));
  return groups;
}

export async function getNotifications(
  userId: string
): Promise<{ groups: NotificationGroup[]; unreadCount: number }> {
  const groups = await buildGroups(userId);
  return { groups, unreadCount: groups.filter((g) => g.unread).length };
}

/** Mark every current notification group as seen (now), clearing the unread badge. */
export async function markNotificationsSeen(userId: string): Promise<void> {
  const groups = await buildGroups(userId);
  const now = new Date();
  await Promise.all(
    groups.map((g) =>
      prisma.notificationView.upsert({
        where: { userId_skillId_kind: { userId, skillId: g.skillId, kind: g.kind } },
        update: { seenAt: now },
        create: { userId, skillId: g.skillId, kind: g.kind, seenAt: now },
      })
    )
  );
}
