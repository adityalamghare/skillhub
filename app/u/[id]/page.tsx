export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserImpact } from "@/lib/queries/home";
import TokensPanel from "./TokensPanel";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: user ? `${user.name} · SkillHub` : "Profile · SkillHub" };
}

const TOOL_BADGE: Record<string, string> = {
  Claude: "bg-orange-50 text-orange-700 border-orange-200",
  Cursor: "bg-sky-50 text-sky-700 border-sky-200",
  Both:   "bg-violet-50 text-violet-700 border-violet-200",
};

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [user, skills, impact] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, avatar: true, department: true, createdAt: true },
    }),
    prisma.skill.findMany({
      where: { authorId: id, hidden: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, description: true, toolType: true, tags: true, createdAt: true,
        _count: { select: { votes: true, comments: true, copies: true } },
      },
    }),
    getUserImpact(id),
  ]);

  if (!user) notFound();

  const isOwnProfile = session?.user?.id === id;

  function Avatar() {
    if (user!.avatar?.startsWith("http")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user!.avatar} alt={user!.name} className="w-16 h-16 rounded-full object-cover" />
      );
    }
    if (user!.avatar) {
      return <span className="text-4xl leading-none">{user!.avatar}</span>;
    }
    return (
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 text-2xl font-bold">
        {user!.name[0]?.toUpperCase()}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        {/* Back */}
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← Home</a>

        {/* Profile header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <Avatar />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
              {user.department && (
                <p className="text-sm text-gray-500 mt-0.5">{user.department}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </p>
            </div>
            {isOwnProfile && (
              <span className="ml-auto text-xs text-indigo-600 border border-indigo-200 rounded-full px-2.5 py-1 bg-indigo-50">
                You
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-gray-100 pt-5">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{impact.mySkills}</p>
              <p className="text-xs text-gray-500 mt-0.5">Skills</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{impact.copiesReceived}</p>
              <p className="text-xs text-gray-500 mt-0.5">Times copied</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{impact.upvotesReceived}</p>
              <p className="text-xs text-gray-500 mt-0.5">Upvotes received</p>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Badges</h2>
          <div className="flex flex-wrap gap-2">
            {impact.badges.map(({ badge, earned }) => (
              <span
                key={badge.id}
                title={badge.description}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition
                  ${earned ? badge.color : "bg-gray-50 text-gray-400 border-gray-200 opacity-60"}`}
              >
                {badge.emoji} {badge.name}
                {!earned && <span className="text-[10px] text-gray-400">(locked)</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Access Tokens (own profile only) */}
        {isOwnProfile && <TokensPanel />}

        {/* Skills */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            {isOwnProfile ? "Your skills" : `Skills by ${user.name}`} ({skills.length})
          </h2>
          {skills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center text-sm text-gray-400">
              {isOwnProfile ? (
                <>
                  No skills yet.{" "}
                  <a href="/submit" className="text-indigo-600 underline">Publish your first skill</a>
                </>
              ) : (
                "No published skills yet."
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => {
                const badgeCls = TOOL_BADGE[skill.toolType] ?? "bg-gray-100 text-gray-700 border-gray-200";
                return (
                  <a
                    key={skill.id}
                    href={`/skill/${skill.id}`}
                    className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-gray-900">{skill.title}</h3>
                      <span className={`flex-shrink-0 text-[11px] font-semibold rounded-full border px-2 py-0.5 ${badgeCls}`}>
                        {skill.toolType}
                      </span>
                    </div>
                    {skill.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{skill.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                      <span>▲ {skill._count.votes}</span>
                      <span>💬 {skill._count.comments}</span>
                      <span>📋 {skill._count.copies}</span>
                      <span className="ml-auto">
                        {new Date(skill.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
