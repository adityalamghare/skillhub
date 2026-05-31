"use client";

import { useState, useTransition } from "react";
import { setEmailSubscription } from "@/lib/actions/profile";
import { useToast } from "@/app/components/useToast";
import { Toast } from "@/app/components/Toast";

export default function EmailPreferences({ subscribed }: { subscribed: boolean }) {
  const [on, setOn] = useState(subscribed);
  const [pending, startTransition] = useTransition();
  const { toast, show } = useToast();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const result = await setEmailSubscription(next);
      show(result);
      if (!result.ok) setOn(!next); // revert on failure
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Email preferences</h2>
      <Toast toast={toast} />
      <div className="mt-2 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Monthly featured email</p>
          <p className="text-xs text-gray-500 mt-0.5">
            A once-a-month highlight of the top SkillHub skill. {on ? "You're subscribed." : "You're unsubscribed."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Toggle monthly featured email"
          onClick={toggle}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-indigo-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
