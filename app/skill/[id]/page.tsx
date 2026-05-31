export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DeleteSkillButton from "./DeleteSkillButton";
import SkillMarkdown from "./SkillMarkdown";
import SkillInteractions from "./SkillInteractions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const skill = await prisma.skill.findUnique({ where: { id }, select: { title: true } });
  return { title: skill ? `${skill.title} · SkillHub` : "Skill · SkillHub" };
}

const TOOL_BADGE: Record<string, string> = {
  Claude: "bg-orange-50 text-orange-700 border-orange-200",
  Cursor: "bg-sky-50 text-sky-700 border-sky-200",
  Both:   "bg-violet-50 text-violet-700 border-violet-200",
};

function AuthorAvatar({ avatar, name }: { avatar: string | null; name: string }) {
  if (avatar?.startsWith("http")) {
    return (
      <Image
        src={avatar}
        alt={name}
        width={24}
        height={24}
        className="h-6 w-6 shrink-0 rounded-full object-cover"
      />
    );
  }

  if (avatar) {
    return <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none">{avatar}</span>;
  }

  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
      {name[0]?.toUpperCase()}
    </span>
  );
}

export default async function SkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const currentUserId = session?.user?.id ?? "";

  const skill = await prisma.skill.findUnique({
    where: { id, hidden: false },
    include: {
      author: { select: { name: true, avatar: true } },
    },
  });

  if (!skill) notFound();

  // Log view (best-effort, no await)
  console.log(JSON.stringify({ event: "skill_view", skillId: skill.id, userId: currentUserId || "anon" }));

  // Copies — deduplicated per user, newest first
  const copies = await prisma.copyEvent.findMany({
    where: { skillId: id },
    include: { user: { select: { name: true, avatar: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Votes — count excluding author
  const voteCount = await prisma.vote.count({
    where: { skillId: id, userId: { not: skill.authorId } },
  });

  const currentUserVoted = currentUserId
    ? !!(await prisma.vote.findUnique({
        where: { skillId_userId: { skillId: id, userId: currentUserId } },
      }))
    : false;

  // Root comments + one level of replies, ordered oldest-first
  const rootComments = await prisma.comment.findMany({
    where: { skillId: id, parentId: null, hidden: false },
    include: {
      user: { select: { name: true, avatar: true } },
      replies: {
        where: { hidden: false },
        include: { user: { select: { name: true, avatar: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const badgeCls = TOOL_BADGE[skill.toolType] ?? "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Back */}
        <Link href="/explore" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Explore
        </Link>

        {/* Header */}
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{skill.title}</h1>
            <div className="flex items-center gap-2">
              {(currentUserId === skill.authorId || session?.user?.isAdmin) && (
                <>
                  <Link
                    href={`/skill/${skill.id}/edit`}
                    className="text-xs text-gray-500 border border-gray-300 rounded-md px-2.5 py-1 hover:bg-gray-50 transition"
                  >
                    Edit
                  </Link>
                  <DeleteSkillButton skillId={skill.id} />
                </>
              )}
              <span className={`text-xs font-semibold rounded-full border px-2.5 py-1 ${badgeCls}`}>
                {skill.toolType}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
            <AuthorAvatar avatar={skill.author.avatar} name={skill.author.name} />
            <Link href={`/u/${skill.authorId}`} className="hover:text-indigo-600 hover:underline">{skill.author.name}</Link>
            <span>·</span>
            <span>{new Date(skill.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>

          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {skill.tags.map((t) => (
                <span key={t} className="text-[11px] uppercase tracking-wide font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          )}

          {skill.description && (
            <p className="mt-3 text-sm leading-6 text-gray-600">{skill.description}</p>
          )}
        </div>

        {/* Skill file — markdown rendered */}
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-3 font-medium">Skill file</p>
          <SkillMarkdown content={skill.content} />
        </div>

        {/* Interactive: copy, vote, who-copied, comments */}
        {currentUserId ? (
          <div className="mt-6">
            <SkillInteractions
              skillId={skill.id}
              skillContent={skill.content}
              authorId={skill.authorId}
              currentUserId={currentUserId}
              initialVoted={currentUserVoted}
              initialVoteCount={voteCount}
              copies={copies}
              comments={rootComments}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            <Link href="/auth/signin" className="text-indigo-600 underline font-medium">Sign in</Link> to copy, upvote, or comment.
          </div>
        )}
      </div>
    </div>
  );
}
