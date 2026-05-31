"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSkillAction } from "@/lib/actions/skill";

export default function DeleteSkillButton({ skillId }: { skillId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm("Delete this skill? This cannot be undone.")) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteSkillAction(skillId);
      if (result.ok) {
        router.push("/explore");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to delete skill.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="text-xs text-red-600 border border-red-200 rounded-md px-2.5 py-1 hover:bg-red-50 disabled:opacity-50 transition"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
      {error && <p className="max-w-40 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
