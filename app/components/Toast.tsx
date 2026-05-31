"use client";

import type { ToastState } from "./useToast";

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm font-medium border transition-all ${
        toast.ok
          ? "bg-green-50 text-green-800 border-green-200"
          : "bg-red-50 text-red-800 border-red-200"
      }`}
    >
      {toast.ok ? "✓ " : "✕ "}
      {toast.message}
    </div>
  );
}
