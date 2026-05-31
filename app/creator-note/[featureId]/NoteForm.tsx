"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitCreatorNote } from "@/lib/actions/featured";

export default function NoteForm({
  featureId,
  defaultNote,
  deadline,
  expired,
}: {
  featureId: string;
  defaultNote: string;
  deadline: string;
  expired: boolean;
}) {
  const [note, setNote] = useState(defaultNote);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitCreatorNote(featureId, note);
      if (result.ok) {
        setDone(true);
        setTimeout(() => router.push("/"), 1500);
      } else {
        setError(result.message);
      }
    });
  }

  if (done) {
    return (
      <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
        ✓ Note submitted! Redirecting…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your note
          <span className="ml-1 font-normal text-gray-400">
            (optional — shown in the featured email)
          </span>
        </label>
        <textarea
          name="note"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          placeholder="Share why you built this skill, when it works best, or any tips for using it…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y disabled:opacity-60"
        />
      </div>

      {!expired && (
        <p className="text-xs text-gray-400">Deadline: {deadline}</p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
      >
        {pending && <Spinner />}
        {pending ? "Submitting…" : "Submit note"}
      </button>
    </form>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  );
}
