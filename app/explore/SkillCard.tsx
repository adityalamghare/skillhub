import type { SkillCard as SkillCardType } from "@/lib/queries/skills";
import Image from "next/image";

const TOOL_COLORS: Record<string, string> = {
  Claude: "bg-orange-100 text-orange-700",
  Cursor: "bg-blue-100 text-blue-700",
  Both: "bg-purple-100 text-purple-700",
};

export default function SkillCard({ skill }: { skill: SkillCardType }) {
  return (
    <a
      href={`/skill/${skill.id}`}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 line-clamp-2 leading-snug">
          {skill.title}
        </h2>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            TOOL_COLORS[skill.toolType] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {skill.toolType}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 line-clamp-3 mb-3 flex-1">
        {skill.description || <span className="italic text-gray-300">No description</span>}
      </p>

      {/* Tags */}
      {skill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {skill.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
            >
              {tag}
            </span>
          ))}
          {skill.tags.length > 4 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
              +{skill.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {/* Author */}
        <div className="flex items-center gap-1.5 min-w-0">
          {skill.author.avatar ? (
            <Image
              src={skill.author.avatar}
              alt={skill.author.name}
              width={20}
              height={20}
              className="rounded-full shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-indigo-100 shrink-0" />
          )}
          <span className="text-xs text-gray-500 truncate">{skill.author.name}</span>
        </div>

        {/* Counters */}
        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
          <span title="Upvotes">▲ {skill._count.votes}</span>
          <span title="Comments">💬 {skill._count.comments}</span>
          <span title="Copies">📋 {skill._count.copies}</span>
        </div>
      </div>
    </a>
  );
}
