import { auth } from "@/auth";
import Image from "next/image";
import Nav from "@/app/components/Nav";
import {
  getHeroFeature,
  getTrendingThisWeek,
  getTopRatedAllTime,
  getWeeklyStats,
  getUserImpact,
} from "@/lib/queries/home";

export default async function Home() {
  const session = await auth();
  const userId = session!.user.id;
  const user   = session!.user;

  const [hero, trending, topRated, stats, impact] = await Promise.all([
    getHeroFeature(),
    getTrendingThisWeek(5),
    getTopRatedAllTime(5),
    getWeeklyStats(),
    getUserImpact(userId),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-10">

        {/* ── Hero: Skill of the Month ─────────────────────────────────── */}
        {hero ? (
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-3">
              🌟 Skill of the Month
            </p>
            <a
              href={`/skill/${hero.skill.id}`}
              className="group block rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      {hero.skill.toolType}
                    </span>
                    {hero.skill.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{t}</span>
                    ))}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 group-hover:text-indigo-700 transition mb-1">
                    {hero.skill.title}
                  </h2>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{hero.skill.description}</p>
                  {hero.creatorNote && (
                    <blockquote className="border-l-4 border-indigo-300 pl-3 text-sm italic text-gray-600">
                      &ldquo;{hero.creatorNote}&rdquo;
                      <span className="ml-2 not-italic text-gray-400">— {hero.skill.author.name}</span>
                    </blockquote>
                  )}
                </div>
                <div className="flex sm:flex-col gap-4 sm:gap-2 sm:text-right shrink-0">
                  <Stat label="copies"   n={hero.skill._count.copies}   />
                  <Stat label="upvotes"  n={hero.skill._count.votes}    />
                  <Stat label="comments" n={hero.skill._count.comments} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Avatar src={hero.skill.author.avatar} name={hero.skill.author.name} size={20} />
                <span className="text-xs text-gray-500">by {hero.skill.author.name}</span>
              </div>
            </a>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">No Skill of the Month yet.</p>
            <p className="text-xs text-gray-400 mt-1">Admins can select one from the <a href="/admin" className="underline text-indigo-500">admin console</a>.</p>
          </section>
        )}

        {/* ── Weekly stats strip ──────────────────────────────────────── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Copies this week", value: stats.copiesThisWeek, emoji: "📋" },
            { label: "New skills",       value: stats.newSkills,       emoji: "✨" },
            { label: "New comments",     value: stats.newComments,     emoji: "💬" },
            { label: "Total skills",     value: stats.totalSkills,     emoji: "📚" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl mb-1">{s.emoji}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </section>

        {/* ── Main grid ───────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Trending + Top rated */}
          <div className="lg:col-span-2 space-y-8">

            {/* Trending this week */}
            <section>
              <SectionHeader title="Trending this week" href="/explore?sort=trending" />
              {trending.length === 0
                ? <Empty text="No activity this week yet." />
                : <SkillList skills={trending} showScore />}
            </section>

            {/* Top rated all time */}
            <section>
              <SectionHeader title="Top rated of all time" href="/explore?sort=copies" />
              {topRated.length === 0
                ? <Empty text="No skills yet." />
                : <SkillList skills={topRated} />}
            </section>
          </div>

          {/* Sidebar: impact + badges */}
          <div className="space-y-6 lg:pt-7">

            {/* Your impact */}
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Avatar src={user.image ?? null} name={user.name ?? ""} size={32} />
                <div>
                  <p className="text-base font-semibold text-gray-900 leading-tight">{user.name}</p>
                  <p className="text-sm text-gray-400">{user.email}</p>
                </div>
              </div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Your impact</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <ImpactStat n={impact.mySkills}      label="skills" />
                <ImpactStat n={impact.copiesReceived}  label="copies" />
                <ImpactStat n={impact.upvotesReceived} label="upvotes" />
              </div>
            </section>

            {/* Badges */}
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Badges</p>
              <div className="space-y-2">
                {impact.badges.map(({ badge, earned }) => (
                  <div
                    key={badge.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                      earned
                        ? badge.color
                        : "border-gray-100 bg-gray-50 text-gray-400"
                    }`}
                  >
                    <span className={`text-xl ${earned ? "" : "grayscale opacity-40"}`}>
                      {badge.emoji}
                    </span>
                    <div>
                      <p className={`text-base font-semibold leading-tight ${earned ? "" : "text-gray-400"}`}>
                        {badge.name}
                      </p>
                      <p className={`text-sm leading-tight mt-0.5 ${earned ? "opacity-70" : "text-gray-400"}`}>
                        {badge.description}
                      </p>
                    </div>
                    {earned && <span className="ml-auto text-xs font-bold">✓</span>}
                  </div>
                ))}
              </div>
            </section>

            {/* Leaderboards teaser */}
            <a
              href="/leaderboards"
              className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-200 hover:shadow-md transition text-center"
            >
              <p className="text-2xl mb-1">🏆</p>
              <p className="text-sm font-semibold text-gray-900">Leaderboards</p>
              <p className="text-xs text-gray-500 mt-0.5">See top contributors →</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <a href={href} className="text-sm text-indigo-600 hover:underline">See all →</a>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
      {text}
    </div>
  );
}

function SkillList({
  skills,
  showScore,
}: {
  skills: {
    id: string;
    title: string;
    toolType: string;
    author: { name: string; avatar: string | null };
    _count: { votes: number; comments: number; copies: number };
    score?: number;
  }[];
  showScore?: boolean;
}) {
  const TOOL_COLORS: Record<string, string> = {
    Claude: "bg-orange-100 text-orange-700",
    Cursor: "bg-blue-100 text-blue-700",
    Both:   "bg-purple-100 text-purple-700",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100 shadow-sm">
      {skills.map((s, i) => (
        <a
          key={s.id}
          href={`/skill/${s.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition group"
        >
          <span className="w-5 text-center text-sm font-bold text-gray-300">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 truncate">
              {s.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Avatar src={s.author.avatar} name={s.author.name} size={14} />
              <span className="text-sm text-gray-400 truncate">{s.author.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400 shrink-0">
            {showScore && s.score !== undefined && (
              <span className="font-semibold text-indigo-600">{s.score}pts</span>
            )}
            <span>📋 {s._count.copies}</span>
            <span>▲ {s._count.votes}</span>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-sm font-medium ${TOOL_COLORS[s.toolType] ?? "bg-gray-100 text-gray-600"}`}>
            {s.toolType}
          </span>
        </a>
      ))}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <p className="text-xl font-bold text-indigo-700">{n}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function ImpactStat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg bg-gray-50 py-2">
      <p className="text-lg font-bold text-gray-900">{n}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function Avatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-indigo-100 shrink-0 flex items-center justify-center text-indigo-600 font-bold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
