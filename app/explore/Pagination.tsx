"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Props {
  page: number;
  totalPages: number;
}

export default function Pagination({ page, totalPages }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function go(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  // Show at most 5 page numbers centred on current page
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end   = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-center gap-1 mt-10">
      <PageBtn onClick={() => go(page - 1)} disabled={page === 1}>‹</PageBtn>
      {start > 1 && (
        <>
          <PageBtn onClick={() => go(1)}>1</PageBtn>
          {start > 2 && <span className="px-1 text-gray-400 text-sm">…</span>}
        </>
      )}
      {pages.map((p) => (
        <PageBtn key={p} onClick={() => go(p)} active={p === page}>{p}</PageBtn>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-gray-400 text-sm">…</span>}
          <PageBtn onClick={() => go(totalPages)}>{totalPages}</PageBtn>
        </>
      )}
      <PageBtn onClick={() => go(page + 1)} disabled={page === totalPages}>›</PageBtn>
    </div>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-indigo-600 text-white"
          : disabled
          ? "text-gray-300 cursor-not-allowed"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}
