"use client";

import { useState, useTransition } from "react";
import { saveConfigAction } from "@/lib/actions/admin";
import { useToast } from "@/app/components/useToast";
import { Toast } from "@/app/components/Toast";

// Duplicated from lib/config to avoid pulling Prisma into the client bundle
const CONFIG_KEYS = [
  "SCORE_WEIGHT_COPIES",
  "SCORE_WEIGHT_COMMENTS",
  "SCORE_WEIGHT_UNIQUE_COMMENTERS",
  "SCORE_WEIGHT_UPVOTES",
  "SCORE_MIN_COPIERS",
  "FEATURED_SCORE_WINDOW",
  "FEATURED_RECIPIENT_LIST",
] as const;
type ConfigKey = (typeof CONFIG_KEYS)[number];

const FIELD_META: Record<string, { label: string; description: string; type?: string }> = {
  SCORE_WEIGHT_COPIES:            { label: "Weight: copies",            description: "Points per non-author copy (default 5)" },
  SCORE_WEIGHT_COMMENTS:          { label: "Weight: comments",          description: "Points per non-author comment (default 3)" },
  SCORE_WEIGHT_UNIQUE_COMMENTERS: { label: "Weight: unique commenters", description: "Points per unique non-author commenter (default 2)" },
  SCORE_WEIGHT_UPVOTES:           { label: "Weight: upvotes",           description: "Points per non-author upvote (default 2)" },
  SCORE_MIN_COPIERS:              { label: "Min distinct copiers",       description: "Min unique non-author copiers for eligibility (default 5)" },
  FEATURED_SCORE_WINDOW:          { label: "Score window",              description: "monthly | 7days | alltime", type: "text" },
  FEATURED_RECIPIENT_LIST:        { label: "Group / distribution emails", description: "Comma-separated emails added on top of all subscribed users. Manage in Mailing list.", type: "text" },
};

export default function ConfigForm({ initialConfig }: { initialConfig: Record<ConfigKey, string> }) {
  const [values, setValues] = useState<Record<ConfigKey, string>>(initialConfig);
  const [pending, startTransition] = useTransition();
  const { toast, show } = useToast();

  function handleChange(key: ConfigKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveConfigAction(values as never);
      show(result);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
      <Toast toast={toast} />

      {CONFIG_KEYS.map((key) => {
        const meta = FIELD_META[key] ?? { label: key, description: "" };
        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {meta.label}
            </label>
            <input
              type={meta.type ?? "number"}
              value={values[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              min={meta.type ? undefined : 0}
              disabled={pending}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-gray-400">{meta.description}</p>
          </div>
        );
      })}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
      >
        {pending && <Spinner />}
        {pending ? "Saving…" : "Save config"}
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
