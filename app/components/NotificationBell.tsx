"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Kind = "upvote" | "copy" | "comment" | "thread_reply";

interface NotificationGroup {
  skillId: string;
  skillTitle: string;
  kind: Kind;
  actors: string[];
  extraCount: number;
  latestAt: string;
  unread: boolean;
}

const VERB: Record<Kind, string> = {
  upvote: "upvoted",
  copy: "copied",
  comment: "commented on",
  thread_reply: "replied in a thread on",
};

const ICON: Record<Kind, string> = {
  upvote: "▲",
  copy: "📋",
  comment: "💬",
  thread_reply: "↩️",
};

function actorLine(g: NotificationGroup) {
  const names = g.actors.join(", ");
  const extra = g.extraCount > 0 ? ` +${g.extraCount}` : "";
  return `${names}${extra}`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(data.groups);
      setUnreadCount(data.unreadCount);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + refresh when the tab regains focus
  useEffect(() => {
    fetchData();
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchData]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      await fetchData();
      // Mark everything seen: badge clears now; items stay highlighted until next open.
      setUnreadCount(0);
      fetch("/api/notifications", { method: "POST" }).catch(() => {});
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Loading…</p>
            ) : error ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500">Couldn&apos;t load notifications.</p>
                <button onClick={fetchData} className="mt-1 text-xs text-indigo-600 hover:underline">
                  Retry
                </button>
              </div>
            ) : groups.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-gray-500">No notifications yet.</p>
                <p className="mt-1 text-xs text-gray-400">
                  Upvotes, copies, and comments on your skills show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {groups.map((g) => (
                  <li key={`${g.skillId}:${g.kind}`}>
                    <a
                      href={`/skill/${g.skillId}`}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-3 transition hover:bg-gray-50 ${
                        g.unread ? "bg-indigo-50/60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 text-sm">{ICON[g.kind]}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${g.unread ? "text-gray-900" : "text-gray-500"}`}>
                            <span className="font-medium">{actorLine(g)}</span> {VERB[g.kind]} your skill{" "}
                            <span className="font-semibold">{g.skillTitle}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400">{relativeTime(g.latestAt)}</p>
                        </div>
                        {g.unread && (
                          <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                        )}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
