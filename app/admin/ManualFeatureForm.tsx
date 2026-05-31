"use client";

import { useState, useTransition } from "react";
import { manualFeatureSkill } from "@/lib/actions/featured";

export default function ManualFeatureForm({ skills }: { skills: { id: string; title: string }[] }) {
  const [skillId, setSkillId] = useState(skills[0]?.id ?? "");
  const [bypass, setBypass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(bypassOverride = bypass) {
    setError(null);
    setNeedsConfirm(false);
    startTransition(async () => {
      const result = await manualFeatureSkill(skillId, bypassOverride);
      // redirect() throws internally — if we get here, it means an early return
      if (!result.ok) {
        if (result.needsConfirm) {
          setNeedsConfirm(true);
          setError(result.message);
        } else {
          setError(result.message);
        }
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Select skill</label>
          <select
            value={skillId}
            onChange={(e) => { setSkillId(e.target.value); setNeedsConfirm(false); setError(null); }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
          <input
            type="checkbox"
            checked={bypass}
            onChange={(e) => setBypass(e.target.checked)}
            className="accent-indigo-600"
          />
          Bypass 12-month cooldown
        </label>
        <button
          type="button"
          onClick={() => submit()}
          disabled={pending || !skillId}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition"
        >
          {pending && <Spinner />}
          {pending ? "Featuring…" : "Feature skill"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          {needsConfirm && (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={pending}
              className="ml-3 underline font-medium hover:text-red-900"
            >
              Confirm bypass →
            </button>
          )}
        </div>
      )}
    </div>
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
