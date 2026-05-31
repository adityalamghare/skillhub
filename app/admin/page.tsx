import { getRankedEligibleSkills } from "@/lib/queries/featured";
import { prisma } from "@/lib/prisma";
import { runAutoSelection, manualFeatureSkill } from "@/lib/actions/featured";

async function runAutoSelectionVoid() { "use server"; await runAutoSelection(); }

export const metadata = { title: "Admin — Selection · SkillHub" };

export default async function AdminPage() {
  const [ranked, skills] = await Promise.all([
    getRankedEligibleSkills(),
    prisma.skill.findMany({
      where: { hidden: false },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auto-selection</h1>
          <p className="mt-1 text-sm text-gray-500">
            Eligible skills ranked by Featured Score (scores are admin-only).
          </p>
        </div>
        <form action={runAutoSelectionVoid}>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
          >
            ▶ Run auto-selection now
          </button>
        </form>
      </div>

      {/* Eligible ranking */}
      {ranked.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">No eligible skills right now.</p>
          <p className="mt-1 text-xs text-gray-400">
            Skills need ≥5 distinct non-author copies and no feature in the last 12 months.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">Copiers</th>
                <th className="px-4 py-3 text-right">Copies</th>
                <th className="px-4 py-3 text-right">Comments</th>
                <th className="px-4 py-3 text-right">Upvotes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ranked.map((s, i) => (
                <tr key={s.skillId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    <a href={`/skill/${s.skillId}`} className="font-medium text-indigo-600 hover:underline">
                      {s.skillId}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{s.score}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.uniqueNonAuthorCopiers}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.nonAuthorCopies}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.nonAuthorComments}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.nonAuthorUpvotes}</td>
                  <td className="px-4 py-3">
                    <form action={async () => { "use server"; await manualFeatureSkill(s.skillId, false); }}>
                      <button type="submit" className="text-xs text-indigo-600 hover:underline">
                        Feature
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual feature any skill */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Manually feature any skill</h2>
        <ManualFeatureForm skills={skills} />
      </div>
    </div>
  );
}

function ManualFeatureForm({ skills }: { skills: { id: string; title: string }[] }) {
  return (
    <form action={async (fd: FormData) => {
      "use server";
      const skillId = fd.get("skillId") as string;
      const bypass  = fd.get("bypass") === "on";
      await manualFeatureSkill(skillId, bypass);
    }} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs text-gray-500 mb-1">Select skill</label>
        <select
          name="skillId"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          {skills.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
        <input type="checkbox" name="bypass" className="accent-indigo-600" />
        Bypass 12-month cooldown
      </label>
      <button
        type="submit"
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition"
      >
        Feature skill
      </button>
    </form>
  );
}
