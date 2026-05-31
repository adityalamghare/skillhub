"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useCallback } from "react";

const SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "copies",   label: "Most copied" },
  { value: "newest",   label: "Newest" },
  { value: "upvotes",  label: "Most upvoted" },
] as const;

const TOOL_OPTIONS = [
  { value: "", label: "All tools" },
  { value: "Claude", label: "Claude" },
  { value: "Cursor", label: "Cursor" },
  { value: "Both",   label: "Both" },
];

interface Props {
  allTags: string[];
}

export default function ExploreControls({ allTags }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = {
    q:    searchParams.get("q") ?? "",
    tool: searchParams.get("tool") ?? "",
    tag:  searchParams.get("tag") ?? "",
    sort: searchParams.get("sort") ?? "trending",
  };

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      // Reset to page 1 on any filter/sort change
      params.delete("page");
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [router, pathname, searchParams]
  );

  return (
    <div className={`space-y-4 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          defaultValue={current.q}
          placeholder="Search skills…"
          onChange={(e) => push({ q: e.target.value })}
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Sort tabs + filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort tabs */}
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => push({ sort: opt.value })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                current.sort === opt.value
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tool filter */}
        <select
          value={current.tool}
          onChange={(e) => push({ tool: e.target.value })}
          className="rounded-lg border border-gray-300 py-1.5 pl-3 pr-8 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none"
        >
          {TOOL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <select
            value={current.tag}
            onChange={(e) => push({ tag: e.target.value })}
            className="rounded-lg border border-gray-300 py-1.5 pl-3 pr-8 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* Active filter chips */}
        {(current.q || current.tool || current.tag) && (
          <button
            onClick={() => push({ q: "", tool: "", tag: "" })}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
