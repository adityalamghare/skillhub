import { prisma } from "@/lib/prisma";
import { hideSkill, deleteSkill, hideComment, deleteComment } from "@/lib/actions/admin";

export const metadata = { title: "Admin — Moderation · SkillHub" };

export default async function ModerationPage() {
  const [skills, comments] = await Promise.all([
    prisma.skill.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { author: { select: { name: true } } },
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user:  { select: { name: true } },
        skill: { select: { title: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-gray-900">Moderation</h1>

      {/* Skills */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Skills <span className="text-gray-400 font-normal">({skills.length})</span>
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {skills.map((s) => (
                <tr key={s.id} className={s.hidden ? "bg-red-50" : "hover:bg-gray-50"}>
                  <td className="px-4 py-3">
                    <a href={`/skill/${s.id}`} className="text-indigo-600 hover:underline line-clamp-1">
                      {s.title}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.author.name}</td>
                  <td className="px-4 py-3">
                    {s.hidden
                      ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Hidden</span>
                      : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Visible</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-3">
                      <form action={hideSkill.bind(null, s.id, !s.hidden)}>
                        <button type="submit" className="text-xs text-gray-600 hover:text-gray-900 underline">
                          {s.hidden ? "Unhide" : "Hide"}
                        </button>
                      </form>
                      <form action={deleteSkill.bind(null, s.id)}
                        onSubmit={(e) => { if (!confirm("Delete this skill permanently?")) e.preventDefault(); }}>
                        <button type="submit" className="text-xs text-red-600 hover:text-red-800 underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Comments */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Comments <span className="text-gray-400 font-normal">({comments.length})</span>
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Comment</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comments.map((c) => (
                <tr key={c.id} className={c.hidden ? "bg-red-50" : "hover:bg-gray-50"}>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="line-clamp-2 text-gray-700">{c.body}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.user.name}</td>
                  <td className="px-4 py-3 text-gray-500 line-clamp-1">{c.skill.title}</td>
                  <td className="px-4 py-3">
                    {c.hidden
                      ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Hidden</span>
                      : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Visible</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-3">
                      <form action={hideComment.bind(null, c.id, !c.hidden)}>
                        <button type="submit" className="text-xs text-gray-600 hover:text-gray-900 underline">
                          {c.hidden ? "Unhide" : "Hide"}
                        </button>
                      </form>
                      <form action={deleteComment.bind(null, c.id)}>
                        <button type="submit" className="text-xs text-red-600 hover:text-red-800 underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
