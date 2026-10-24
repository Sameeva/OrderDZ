"use client";

import { animate, motionValue, type AnimationPlaybackControls } from "motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { WILAYAS } from "@/lib/wilayas";
import { fmtDA, fold } from "./format";

export type DeliveryType = "DOMICILE" | "STOP_DESK";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (code: number) => void;
  selected: number | null;
  deliveryType: DeliveryType;
  /** wilayaCode -> available delivery types with fee (centimes) */
  fees: ReadonlyMap<number, Partial<Record<DeliveryType, number>>>;
};

// Critically damped for taps (zeta = 1: c = 2*sqrt(k*m) with k = 420, m = 1). ~80% damping for flicks.
const SPRING_TAP = { type: "spring", stiffness: 420, damping: 41, mass: 1 } as const;
const SPRING_FLICK = { type: "spring", stiffness: 420, damping: 33, mass: 1 } as const;

/** Rubber band: content follows the finger with growing resistance past the edge (constant is a tuned guess). */
function rubber(over: number): number {
  const c = 0.55;
  const d = 140;
  return -(1 - 1 / ((Math.abs(over) * c) / d + 1)) * d;
}

export default function WilayaSheet({ open, onClose, onSelect, selected, deliveryType, fees }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [y] = useState(() => motionValue(0));
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const closing = useRef(false);
  const [query, setQuery] = useState("");

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Apply the y motion value to the DOM without React renders (transform + opacity only).
  useEffect(() => {
    const apply = (v: number) => {
      const panel = panelRef.current;
      const dlg = dialogRef.current;
      if (!panel || !dlg) return;
      const h = panel.offsetHeight || 1;
      const p = Math.min(1, Math.max(0, 1 - v / h));
      if (reduced()) {
        // Reduced motion: fade instead of sliding.
        panel.style.transform = "";
        panel.style.opacity = String(p);
      } else {
        panel.style.opacity = "";
        panel.style.transform = v === 0 ? "" : `translate3d(0, ${v}px, 0)`;
      }
      dlg.style.setProperty("--p", String(p));
    };
    return y.on("change", apply);
  }, [y]);

  // Keep the sheet above the on-screen keyboard (iOS does not resize the layout viewport).
  useEffect(() => {
    const vv = window.visualViewport;
    const dlg = dialogRef.current;
    if (!vv || !dlg) return;
    const sync = () => {
      dlg.style.setProperty("--vv-h", `${vv.height}px`);
      dlg.style.setProperty("--vv-top", `${vv.offsetTop}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  const finishClose = () => {
    closing.current = false;
    const dlg = dialogRef.current;
    if (dlg?.open) dlg.close();
    onClose();
  };

  const closeAnimated = (velocity = 0) => {
    const panel = panelRef.current;
    if (!panel || closing.current) return;
    closing.current = true;
    controls.current?.stop();
    if (reduced()) {
      animate(y, panel.offsetHeight, { duration: 0.12, ease: "linear", onComplete: finishClose });
      return;
    }
    controls.current = animate(y, (dialogRef.current?.clientHeight ?? panel.offsetHeight) + 8, {
      ...(velocity > 300 ? SPRING_FLICK : SPRING_TAP),
      velocity,
      restDelta: 1,
      onComplete: finishClose,
    });
  };

  useEffect(() => {
    const dlg = dialogRef.current;
    const panel = panelRef.current;
    if (!open || !dlg || !panel || dlg.open) return;
    closing.current = false;
    setQuery("");
    dlg.showModal();
    const h = panel.offsetHeight;
    y.jump(dlg.clientHeight || h);
    if (reduced()) {
      animate(y, 0, { duration: 0.12, ease: "linear" });
    } else {
      controls.current = animate(y, 0, { ...SPRING_TAP, restDelta: 0.5 });
    }
    if (window.matchMedia("(pointer: fine)").matches) searchRef.current?.focus();
    listRef.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>("[aria-current='true']")?.scrollIntoView({ block: "center" });
    });
  }, [open, y]);

  // Drag on the header: 1:1 tracking, rubber band upward, release by projected position.
  const drag = useRef<{ id: number; startY: number; base: number; samples: { t: number; y: number }[] } | null>(null);

  const onHeadDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, input")) return;
    controls.current?.stop();
    closing.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, startY: e.clientY, base: y.get(), samples: [{ t: e.timeStamp, y: e.clientY }] };
  };
  const onHeadMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const raw = d.base + (e.clientY - d.startY);
    y.set(raw < 0 ? rubber(raw) : raw);
    d.samples.push({ t: e.timeStamp, y: e.clientY });
    if (d.samples.length > 12) d.samples.shift();
  };
  const onHeadUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const recent = d.samples.filter((s) => e.timeStamp - s.t < 100);
    const first = recent[0] ?? d.samples[0];
    const dt = Math.max(1, e.timeStamp - first.t);
    const vy = ((e.clientY - first.y) / dt) * 1000; // px/s
    const h = panelRef.current?.offsetHeight ?? 400;
    const projected = y.get() + vy * 0.2;
    if (projected > Math.min(150, h * 0.3)) {
      closeAnimated(Math.max(0, vy));
    } else {
      controls.current = animate(y, 0, { ...(Math.abs(vy) > 300 ? SPRING_FLICK : SPRING_TAP), velocity: vy, restDelta: 0.5 });
    }
  };

  const q = fold(query);
  const { served, other } = useMemo(() => {
    const match = (w: (typeof WILAYAS)[number]) =>
      !q || fold(w.nameFr).includes(q) || w.nameAr.includes(query.trim()) || String(w.code).padStart(2, "0").startsWith(q) || String(w.code) === q;
    const list = WILAYAS.filter(match);
    return { served: list.filter((w) => fees.has(w.code)), other: list.filter((w) => !fees.has(w.code)) };
  }, [q, query, fees]);

  const row = (w: (typeof WILAYAS)[number], served: boolean) => {
    const f = fees.get(w.code);
    const fee = f?.[deliveryType];
    const code = String(w.code).padStart(2, "0");
    return (
      <li key={w.code}>
        <button
          type="button"
          className="w-row pressable"
          disabled={!served}
          aria-current={selected === w.code ? "true" : undefined}
          onClick={() => {
            onSelect(w.code);
            closeAnimated();
          }}
        >
          <span className="w-code">{code}</span>
          <span className="w-name">
            {w.nameFr}
            <span className="w-ar" lang="ar" dir="auto">
              {w.nameAr}
            </span>
          </span>
          <span className="w-fee">
            {!served
              ? "Non desservie"
              : fee !== undefined
                ? fmtDA(fee)
                : deliveryType === "DOMICILE"
                  ? "Stop desk seul"
                  : "Domicile seul"}
          </span>
          {selected === w.code && (
            <svg className="w-check" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="m4 10.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </li>
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        closeAnimated();
      }}
      onClose={() => {
        if (!closing.current) onClose();
      }}
    >
      <div className="sheet-scrim" onClick={() => closeAnimated()} />
      <div ref={panelRef} className="sheet-panel">
        <div
          className="sheet-head"
          onPointerDown={onHeadDown}
          onPointerMove={onHeadMove}
          onPointerUp={onHeadUp}
          onPointerCancel={onHeadUp}
        >
          <span className="sheet-grabber" aria-hidden="true" />
          <div className="sheet-title-row">
            <h2 id="sheet-title">Choisir la wilaya</h2>
            <button type="button" className="sheet-close pressable" aria-label="Fermer" onClick={() => closeAnimated()}>
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <label className="sheet-search">
            <span className="sr-only">Rechercher une wilaya par nom ou numéro</span>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Nom ou numéro (ex. Alger, 16)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div ref={listRef} className="sheet-list">
          <p className="sr-only" role="status">
            {served.length + other.length} résultat{served.length + other.length > 1 ? "s" : ""}
          </p>
          {served.length + other.length === 0 && (
            <p className="sheet-empty">Aucune wilaya ne correspond à « {query.trim()} ».</p>
          )}
          {served.length > 0 && (
            <>
              {other.length > 0 && <h3 className="sheet-group">Livraison disponible</h3>}
              <ul>{served.map((w) => row(w, true))}</ul>
            </>
          )}
          {other.length > 0 && (
            <>
              <h3 className="sheet-group">Pas encore desservies</h3>
              <ul>{other.map((w) => row(w, false))}</ul>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
