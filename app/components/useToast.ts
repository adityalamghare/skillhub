"use client";

import { useState, useCallback } from "react";

export type ToastState = { ok: boolean; message: string } | null;

export function useToast(ttl = 3500) {
  const [toast, setToast] = useState<ToastState>(null);

  const show = useCallback(
    (result: { ok: boolean; message: string }) => {
      setToast(result);
      setTimeout(() => setToast(null), ttl);
    },
    [ttl]
  );

  const clear = useCallback(() => setToast(null), []);

  return { toast, show, clear };
}
