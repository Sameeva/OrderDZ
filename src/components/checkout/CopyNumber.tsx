"use client";

import { useEffect, useRef, useState } from "react";

export function CopyNumber({ value }: { value: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("done");
    } catch {
      setState("fail");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2200);
  };

  return (
    <>
      <button type="button" className="ty-copy pressable" onClick={copy} aria-label={`Copier le numéro de commande ${value}`}>
        {state === "done" ? "Copié" : "Copier"}
      </button>
      <span className="sr-only" role="status">
        {state === "done" ? "Numéro copié." : state === "fail" ? "Copie impossible." : ""}
      </span>
    </>
  );
}
