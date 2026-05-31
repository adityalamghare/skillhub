import { Suspense } from "react";
import { getSkills, getAllTags, PAGE_SIZE, type SortOption } from "@/lib/queries/skills";
import SkillCard from "./SkillCard";
import ExploreControls from "./ExploreControls";
import Pagination from "./Pagination";
import Nav from "@/app/components/Nav";

export const metadata = { title: "Explore Skills — SkillHub" };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tool?: string;
    tag?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ExplorePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const sort = (["trending", "copies", "newest", "upvotes"].includes(sp.sort ?? "")
    ? sp.sort
    : "trending") as SortOption;

  const [{ skills, total, totalPages }, allTags] = await Promise.all([
    getSkills({ q: sp.q, tool: sp.tool, tag: sp.tag, sort, page }),
    getAllTags(),
  ]);

  const hasFilters = !!(sp.q || sp.tool || sp.tag);

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Explore skills</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total === 0
              ? "No skills found."
              : `${total} skill${total === 1 ? "" : "s"}${hasFilters ? " matching your filters" : ""}`}
          </p>
        </div>

        {/* Controls — needs Suspense because it reads useSearchParams */}
        <Suspense fallback={<div className="h-20 animate-pulse rounded-xl bg-gray-100" />}>
          <div className="mb-8">
            <ExploreControls allTags={allTags} />
          </div>
        </Suspense>

        {/* Grid */}
        {skills.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>

            {/* Results summary */}
            <p className="mt-4 text-center text-xs text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </p>

            <Suspense>
              <Pagination page={page} totalPages={totalPages} />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
      <p className="text-4xl mb-3">🔍</p>
      <p className="text-sm font-medium text-gray-700">
        {hasFilters ? "No skills match your filters" : "No skills yet"}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        {hasFilters
          ? "Try clearing the filters or searching for something else."
          : "Be the first to submit one!"}
      </p>
      {!hasFilters && (
        <a
          href="/submit"
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Submit a skill
        </a>
      )}
    </div>
  );
}
