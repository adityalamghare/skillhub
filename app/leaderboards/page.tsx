import Image from "next/image";
import Nav from "@/app/components/Nav";
import { getLeaderboards } from "@/lib/queries/home";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboards — SkillHub" };

export default async function LeaderboardsPage() {
  const { mostCopied, mostUpvoted, topSubmitters } = await getLeaderboards();

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Leaderboards</h1>
        <p className="text-sm text-gray-500 mb-8">Top contributors this period. Self-actions excluded.</p>

        <div className="grid sm:grid-cols-3 gap-6">
          <LeaderBoard
            title="Most Copied"
            emoji="📋"
            description="Creators whose skills have been copied the most"
            rows={mostCopied}
            unit="copies"
          />
          <LeaderBoard
            title="Most Upvoted"
            emoji="▲"
            description="Creators whose skills have earned the most upvotes"
            rows={mostUpvoted}
            unit="upvotes"
          />
          <LeaderBoard
            title="Top Submitters"
            emoji="✨"
            description="Members who have published the most skills"
            rows={topSubmitters}
            unit="skills"
          />
        </div>
      </div>
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

function LeaderBoard({
  title,
  emoji,
  description,
  rows,
  unit,
}: {
  title: string;
  emoji: string;
  description: string;
  rows: { user: { id: string; name: string; avatar: string | null }; count: number }[];
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="text-xl mb-1">{emoji}</p>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">No data yet.</p>
      ) : (
        <ol className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <li key={row.user.id} className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? "bg-amber-50" : "hover:bg-gray-50"}`}>
              <span className="text-lg w-6 text-center shrink-0">{MEDALS[i]}</span>
              <Avatar src={row.user.avatar} name={row.user.name} size={28} />
              <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">
                {row.user.name}
              </span>
              <span className={`shrink-0 text-sm font-bold ${i === 0 ? "text-amber-600" : "text-gray-500"}`}>
                {row.count}
                <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
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
