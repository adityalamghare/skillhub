"use client";

import { useState, useTransition } from "react";
import { updateFeatureDraft, sendFeaturedEmailAction } from "@/lib/actions/featured";
import { useToast } from "@/app/components/useToast";
import { Toast } from "@/app/components/Toast";

interface Skill {
  id: string;
  title: string;
  description: string;
  toolType: string;
  tags: string[];
  author: { name: string };
  _count: { votes: number; comments: number; copies: number };
}

interface Feature {
  id: string;
  status: string;
  creatorNote: string | null;
  sentAt: Date | null;
  skill: Skill;
}

interface Props {
  feature: Feature;
  allSkills: { id: string; title: string }[];
  emailHtml: string;
}

export default function EmailPreview({ feature, allSkills, emailHtml }: Props) {
  const [note, setNote] = useState(feature.creatorNote ?? "");
  const [swapSkillId, setSwapSkillId] = useState(feature.skill.id);
  const { toast, show } = useToast();
  const [savePending, startSave] = useTransition();
  const [sendPending, startSend] = useTransition();

  function handleSaveDraft() {
    startSave(async () => {
      const result = await updateFeatureDraft(feature.id, {
        creatorNote: note,
        skillId: swapSkillId !== feature.skill.id ? swapSkillId : undefined,
      });
      show(result);
    });
  }

  function handleSend() {
    if (!confirm("Send this email to all org members? This cannot be undone.")) return;
    startSend(async () => {
      const result = await sendFeaturedEmailAction(feature.id);
      show(result);
    });
  }

  const isSent = feature.status === "sent";
  const anyPending = savePending || sendPending;

  return (
    <div className="space-y-6">
      <Toast toast={toast} />

      {isSent && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
          ✓ This email was sent on {feature.sentAt?.toLocaleString()}.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Edit panel */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Edit draft</h2>

          {/* Swap skill */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Featured skill</label>
            <select
              value={swapSkillId}
              onChange={(e) => setSwapSkillId(e.target.value)}
              disabled={isSent || anyPending}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            >
              {allSkills.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          {/* Creator note */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Creator note
              <span className="ml-1 font-normal text-gray-400">(48h window for author to submit; admin can also edit)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              disabled={isSent || anyPending}
              placeholder="A personal note from the skill's author…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none resize-y disabled:opacity-50"
            />
          </div>

          {/* Skill stats (read-only) */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-sm">
            <p className="font-medium text-gray-800 mb-1">{feature.skill.title}</p>
            <p className="text-gray-500 text-xs mb-2">by {feature.skill.author.name} · {feature.skill.toolType}</p>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>📋 {feature.skill._count.copies} copies</span>
              <span>▲ {feature.skill._count.votes} upvotes</span>
              <span>💬 {feature.skill._count.comments} comments</span>
            </div>
          </div>

          {!isSent && (
            <div className="flex gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={anyPending}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {savePending && <Spinner />}
                {savePending ? "Saving…" : "Save draft"}
              </button>
              <button
                onClick={handleSend}
                disabled={anyPending}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {sendPending && <Spinner className="text-white" />}
                {sendPending ? "Sending…" : "Send email →"}
              </button>
            </div>
          )}
        </div>

        {/* Email preview */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Email preview</h2>
          <div className="rounded-lg border border-gray-200 overflow-hidden h-[480px]">
            <iframe
              srcDoc={emailHtml}
              className="w-full h-full"
              title="Email preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin h-3.5 w-3.5 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  );
}
