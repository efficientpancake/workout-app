"use client";

import { useEffect, useRef } from "react";

// Keeps the screen awake while `active` is true.
export function useWakeLock(active) {
  const lockRef = useRef(null);
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) lock.release();
        else lockRef.current = lock;
      } catch {}
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
