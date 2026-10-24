"use client";

import { useEffect } from "react";

/**
 * iOS Safari only applies :active styles when a touch listener exists on the document.
 * A passive no-op listener makes the pressed state appear on touch-down, not on release.
 */
export function TouchActive() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  return null;
}
