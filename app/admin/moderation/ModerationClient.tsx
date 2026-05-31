"use client";

import { useTransition } from "react";
import { hideSkill, deleteSkill, hideComment, deleteComment } from "@/lib/actions/admin";

interface Skill {
  id: string;
  title: string;
  hidden: boolean;
  author: { name: string };
}

interface Comment {
  id: string;
  body: string;
  hidden: boolean;
  user: { name: string };
  skill: { title: string };
}

function SkillRow({ skill }: { skill: Skill }) {
  const [hidePending, startHide] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const pending = hidePending || deletePending;

  return (
    <tr className={skill.hidden ? "bg-red-50" : "hover:bg-gray-50"}>
      <td className="px-4 py-3">
        <a href={`/skill/${skill.id}`} className="text-indigo-600 hover:underline line-clamp-1">
          {skill.title}
        </a>
      </td>
      <td className="px-4 py-3 text-gray-500">{skill.author.name}</td>
      <td className="px-4 py-3">
        {skill.hidden
          ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Hidden</span>
          : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Visible</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-3">
          <button
            disabled={pending}
            onClick={() => startHide(async () => { await hideSkill(skill.id, !skill.hidden); })}
            className="text-xs text-gray-600 hover:text-gray-900 underline disabled:opacity-40"
          >
            {hidePending ? "…" : skill.hidden ? "Unhide" : "Hide"}
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this skill permanently?")) return;
              startDelete(async () => { await deleteSkill(skill.id); });
            }}
            className="text-xs text-red-600 hover:text-red-800 underline disabled:opacity-40"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
  const [hidePending, startHide] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const pending = hidePending || deletePending;

  return (
    <tr className={comment.hidden ? "bg-red-50" : "hover:bg-gray-50"}>
      <td className="px-4 py-3 max-w-xs">
        <p className="line-clamp-2 text-gray-700">{comment.body}</p>
      </td>
      <td className="px-4 py-3 text-gray-500">{comment.user.name}</td>
      <td className="px-4 py-3 text-gray-500 line-clamp-1">{comment.skill.title}</td>
      <td className="px-4 py-3">
        {comment.hidden
          ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Hidden</span>
          : <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Visible</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-3">
          <button
            disabled={pending}
            onClick={() => startHide(async () => { await hideComment(comment.id, !comment.hidden); })}
            className="text-xs text-gray-600 hover:text-gray-900 underline disabled:opacity-40"
          >
            {hidePending ? "…" : comment.hidden ? "Unhide" : "Hide"}
          </button>
          <button
            disabled={pending}
            onClick={() => startDelete(async () => { await deleteComment(comment.id); })}
            className="text-xs text-red-600 hover:text-red-800 underline disabled:opacity-40"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ModerationClient({
  skills,
  comments,
}: {
  skills: Skill[];
  comments: Comment[];
}) {
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
              {skills.map((s) => <SkillRow key={s.id} skill={s} />)}
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
              {comments.map((c) => <CommentRow key={c.id} comment={c} />)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
