import { getRankedEligibleSkills } from "@/lib/queries/featured";
import { prisma } from "@/lib/prisma";
import { manualFeatureSkill } from "@/lib/actions/featured";
import ManualFeatureForm from "./ManualFeatureForm";
import AutoSelectButton from "./AutoSelectButton";

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
        <AutoSelectButton />
      </div>

      {/* Eligible ranking */}
      {ranked.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">No eligible skills right now.</p>
          <p className="mt-1 text-xs text-gray-400">
            Skills need no feature in the last 12 months and an active author.
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
