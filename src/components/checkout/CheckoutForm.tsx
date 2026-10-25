"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { normalizeMobile } from "@/lib/phone";
import { WILAYAS } from "@/lib/wilayas";
import "./checkout.css";
import { fmtDA, groupPhone, initials, phoneStatus } from "./format";
import { Odometer } from "./Odometer";
import type { DeliveryType } from "./WilayaSheet";

const loadSheet = () => import("./WilayaSheet");
const WilayaSheet = dynamic(loadSheet, { ssr: false });

export type ProductProp = { id: string; name: string; priceCentimes: number; stock: number };
export type FeeProp = { wilayaCode: number; deliveryType: DeliveryType; feeCentimes: number };

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  products: ProductProp[];
  fees: FeeProp[];
  serverError?: string;
};

const MAX_QTY = 50;
const TYPE_LABEL: Record<DeliveryType, string> = { DOMICILE: "À domicile", STOP_DESK: "Stop desk" };
const TYPES: DeliveryType[] = ["DOMICILE", "STOP_DESK"];

function SubmitButton({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`cta pressable ${className}`} disabled={pending} data-pending={pending || undefined}>
      <span className="cta-label">{pending ? "Envoi en cours" : "Commander"}</span>
      <svg className="cta-arrow" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="M4 10h11m-4.5-5L15 10l-4.5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="cta-bar" aria-hidden="true" />
    </button>
  );
}

const nowMs = () => performance.now();

export function CheckoutForm({ action, products, fees, serverError }: Props) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState<number | null>(null);
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<DeliveryType>("DOMICILE");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const wilayaBtnRef = useRef<HTMLButtonElement>(null);
  const communeRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef<HTMLInputElement>(null);
  const openedAt = useRef(0);

  // Warm the sheet chunk when the browser is idle so the first tap opens it at once.
  useEffect(() => {
    openedAt.current = nowMs();
  }, []);

  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = idle ? idle(() => void loadSheet()) : window.setTimeout(() => void loadSheet(), 1500);
    return () => {
      if (!idle) window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (serverError) alertRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [serverError]);

  const feeMap = useMemo(() => {
    const m = new Map<number, Partial<Record<DeliveryType, number>>>();
    for (const f of fees) m.set(f.wilayaCode, { ...m.get(f.wilayaCode), [f.deliveryType]: f.feeCentimes });
    return m;
  }, [fees]);

  const product = products.find((p) => p.id === productId) ?? products[0];
  const maxQty = Math.max(1, Math.min(MAX_QTY, product?.stock ?? 1));
  const q = Math.min(qty, maxQty);
  const fee = wilaya !== null ? feeMap.get(wilaya)?.[type] : undefined;
  const subtotal = (product?.priceCentimes ?? 0) * q;
  const total = subtotal + (fee ?? 0);
  const wilayaName = wilaya !== null ? WILAYAS.find((w) => w.code === wilaya)?.nameFr : undefined;

  const ph = phoneStatus(phone);
  const errors = {
    name: name.trim().length < 2 ? "Indiquez votre nom complet." : "",
    phone: ph.ok ? "" : ph.state === "empty" ? "Indiquez votre numéro mobile." : ph.state === "typing" ? "Numéro incomplet. " + ph.hint : ph.hint,
    wilaya: wilaya === null ? "Choisissez votre wilaya." : fee === undefined ? "Livraison indisponible pour ce choix." : "",
    commune: commune.trim() ? "" : "Indiquez votre commune.",
  };
  const show = (k: keyof typeof errors) => (submitted || touched[k]) && errors[k];
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const pickWilaya = useCallback(
    (code: number) => {
      setWilaya(code);
      touch("wilaya");
      const f = feeMap.get(code) ?? {};
      if (f[type] === undefined) {
        const other = TYPES.find((t) => f[t] !== undefined);
        if (other) {
          setType(other);
          const w = WILAYAS.find((x) => x.code === code)?.nameFr;
          setNotice(`${TYPE_LABEL[type]} n'est pas proposé à ${w} : ${TYPE_LABEL[other].toLowerCase()} sélectionné.`);
          return;
        }
      }
      setNotice("");
    },
    [feeMap, type],
  );

  const openSheet = () => {
    setSheetMounted(true);
    setSheetOpen(true);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (elapsedRef.current) elapsedRef.current.value = String(Math.round(nowMs() - openedAt.current));
    const firstBad = (["name", "phone", "wilaya", "commune"] as const).find((k) => errors[k]);
    if (!firstBad) return;
    e.preventDefault();
    setSubmitted(true);
    const target = { name: nameRef, phone: phoneRef, wilaya: wilayaBtnRef, commune: communeRef }[firstBad].current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  // Hide the sticky bar while a text field has focus (keyboard open), without re-rendering.
  const isText = (t: EventTarget | null) =>
    t instanceof HTMLInputElement ? !["radio", "checkbox", "button", "submit"].includes(t.type) : t instanceof HTMLTextAreaElement;
  const onFocusCapture = (e: React.FocusEvent) => {
    if (isText(e.target)) formRef.current?.setAttribute("data-typing", "");
  };
  const onBlurCapture = (e: React.FocusEvent) => {
    if (!isText(e.relatedTarget)) formRef.current?.removeAttribute("data-typing");
  };

  const typeIndex = TYPES.indexOf(type);
  const phoneLive = ph.state === "valid" || ph.state === "bad-prefix" || ph.state === "bad-chars" || ph.state === "too-long" ? ph.hint : "";
  const phoneTone =
    ph.state === "valid" ? "ok" : ph.state === "bad-prefix" || ph.state === "bad-chars" || ph.state === "too-long" || show("phone") ? "bad" : "";

  if (!product) {
    return (
      <p className="co-empty" role="status">
        Aucun produit n&apos;est disponible pour le moment. Revenez bientôt.
      </p>
    );
  }

  return (
    <>
    <form
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      noValidate
      className="co"
    >
      {/* Spam trap: invisible to people, tempting to bots. The server drops orders that fill it or that arrive too fast. */}
      <div className="co-hp" aria-hidden="true">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input ref={elapsedRef} type="hidden" name="elapsed" />
      <input type="hidden" name="quantity" value={q} />
      <input type="hidden" name="wilayaCode" value={wilaya ?? ""} />

      {serverError && (
        <div ref={alertRef} className="co-alert" role="alert">
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path d="M10 3 18 17H2L10 3Zm0 5v4m0 2.5v.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      <div className="co-fields">
        {/* 1. Article */}
        <section className="co-sec" aria-labelledby="h-article">
          <h2 id="h-article" className="co-h">
            <span className="co-n" aria-hidden="true">1</span>
            {products.length > 1 ? "Choisissez votre article" : "Votre article"}
          </h2>
          <div className={`prail${products.length === 1 ? " prail--one" : ""}`} role="radiogroup" aria-labelledby="h-article">
            {products.map((p) => (
              <label key={p.id} className="pcard-wrap">
                <input
                  type="radio"
                  name="productId"
                  value={p.id}
                  checked={p.id === product.id}
                  onChange={() => setProductId(p.id)}
                  className="pick"
                />
                <span className="pcard pressable">
                  <span className="ptile" aria-hidden="true">
                    <span className="ptile-ini">{initials(p.name)}</span>
                  </span>
                  <span className="pinfo">
                    <span className="pname">{p.name}</span>
                    <span className="pprice">{fmtDA(p.priceCentimes)}</span>
                  </span>
                  <svg className="pcheck" viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
                    <circle cx="10" cy="10" r="10" fill="currentColor" />
                    <path d="m5.5 10.3 3 3 6-6.6" fill="none" stroke="var(--brand-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </label>
            ))}
          </div>

          <div className="qty" role="group" aria-label="Quantité">
            <span className="qty-label">Quantité</span>
            <div className="qty-ctl">
              <button type="button" className="qty-btn pressable" aria-label="Diminuer la quantité" disabled={q <= 1} onClick={() => setQty(Math.max(1, q - 1))}>
                <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              </button>
              <output className="qty-val" aria-live="polite">{q}</output>
              <button type="button" className="qty-btn pressable" aria-label="Augmenter la quantité" disabled={q >= maxQty} onClick={() => setQty(Math.min(maxQty, q + 1))}>
                <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M4 10h12M10 4v12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              </button>
            </div>
            {product.stock <= 5 && <span className="qty-stock">{product.stock === 1 ? "Dernier article" : `Plus que ${product.stock} en stock`}</span>}
          </div>
        </section>

        {/* 2. Coordonnées */}
        <section className="co-sec" aria-labelledby="h-contact">
          <h2 id="h-contact" className="co-h"><span className="co-n" aria-hidden="true">2</span>Vos coordonnées</h2>

          <div className="field" data-bad={show("name") ? "" : undefined}>
            <label htmlFor="f-name">Nom complet</label>
            <input
              ref={nameRef}
              id="f-name"
              name="customerName"
              autoComplete="name"
              enterKeyHint="next"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => touch("name")}
              aria-invalid={show("name") ? true : undefined}
              aria-describedby={show("name") ? "e-name" : undefined}
              required
            />
            {show("name") && <p id="e-name" className="hint hint--bad">{errors.name}</p>}
          </div>

          <div className="field" data-tone={phoneTone || undefined}>
            <label htmlFor="f-phone">Téléphone mobile</label>
            <div className="input-wrap">
              <input
                ref={phoneRef}
                id="f-phone"
                name="customerPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                placeholder="05 51 23 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => {
                  touch("phone");
                  const n = normalizeMobile(phone);
                  if (n) setPhone(groupPhone(n));
                }}
                aria-invalid={phoneTone === "bad" ? true : undefined}
                aria-describedby="e-phone"
                required
              />
              {ph.ok && (
                <svg className="input-ok" viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
                  <circle cx="10" cy="10" r="10" fill="currentColor" />
                  <path d="m5.5 10.3 3 3 6-6.6" fill="none" stroke="var(--card)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <p id="e-phone" className={`hint${phoneTone ? ` hint--${phoneTone}` : ""}`}>
              {phoneTone === "bad" && ph.state === "typing" ? errors.phone : ph.hint}
            </p>
            <p className="sr-only" role="status">{phoneLive}</p>
          </div>
        </section>

        {/* 3. Livraison */}
        <section className="co-sec" aria-labelledby="h-ship">
          <h2 id="h-ship" className="co-h"><span className="co-n" aria-hidden="true">3</span>Livraison</h2>

          <div className="field" data-bad={show("wilaya") ? "" : undefined}>
            <label htmlFor="f-wilaya">Wilaya</label>
            <button
              ref={wilayaBtnRef}
              id="f-wilaya"
              type="button"
              className="picker pressable"
              aria-haspopup="dialog"
              aria-describedby={show("wilaya") ? "e-wilaya" : undefined}
              onPointerEnter={() => void loadSheet()}
              onClick={openSheet}
            >
              <span className={wilaya === null ? "picker-ph" : "picker-val"}>
                {wilaya === null ? "Choisir la wilaya" : `${String(wilaya).padStart(2, "0")} · ${wilayaName}`}
              </span>
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {show("wilaya") && <p id="e-wilaya" className="hint hint--bad">{errors.wilaya}</p>}
          </div>

          <fieldset className="seg-set">
            <legend>Mode de livraison</legend>
            <div className="seg" style={{ "--i": typeIndex } as React.CSSProperties}>
              <span className="seg-thumb" aria-hidden="true" />
              {TYPES.map((t) => {
                const f = wilaya !== null ? feeMap.get(wilaya)?.[t] : undefined;
                const unavailable = wilaya !== null && f === undefined;
                return (
                  <label key={t} className="seg-opt" data-off={unavailable || undefined}>
                    <input
                      type="radio"
                      name="deliveryType"
                      value={t}
                      checked={type === t}
                      disabled={unavailable}
                      onChange={() => {
                        setType(t);
                        setNotice("");
                      }}
                      className="pick"
                    />
                    <span className="seg-face pressable">
                      <span className="seg-main">{TYPE_LABEL[t]}</span>
                      <span className="seg-sub">{wilaya === null ? "selon la wilaya" : unavailable ? "Indisponible" : f === 0 ? "Gratuite" : fmtDA(f!)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="hint" role="status">{notice || (type === "STOP_DESK" ? "Vous récupérez le colis au point relais." : "Le livreur vous appelle à l'arrivée.")}</p>
          </fieldset>

          <div className="field" data-bad={show("commune") ? "" : undefined}>
            <label htmlFor="f-commune">Commune</label>
            <input
              ref={communeRef}
              id="f-commune"
              name="commune"
              autoComplete="address-level2"
              enterKeyHint="next"
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              onBlur={() => touch("commune")}
              aria-invalid={show("commune") ? true : undefined}
              aria-describedby={show("commune") ? "e-commune" : undefined}
              required
            />
            {show("commune") && <p id="e-commune" className="hint hint--bad">{errors.commune}</p>}
          </div>

          <div className="field">
            <label htmlFor="f-address">
              Adresse <span className="opt">(facultatif)</span>
            </label>
            <input
              id="f-address"
              name="address"
              autoComplete="street-address"
              enterKeyHint="done"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rue, quartier, repère"
            />
          </div>
        </section>
      </div>

      {/* Live order slip */}
      <aside className="co-side" aria-label="Récapitulatif de la commande">
        <div className="ticket">
          <div className="ticket-stripe" aria-hidden="true" />
          <h2 className="ticket-title">Bon de commande</h2>
          <dl className="t-lines">
            <div className="t-line">
              <dt>
                {product.name}
                <span className="t-sub">{q} × {fmtDA(product.priceCentimes)}</span>
              </dt>
              <dd>{fmtDA(subtotal)}</dd>
            </div>
            <div className="t-line">
              <dt>
                Livraison
                <span className="t-sub">{wilayaName ? `${wilayaName} · ${TYPE_LABEL[type]}` : "Choisissez une wilaya"}</span>
              </dt>
              <dd>{fee === undefined ? "–" : fee === 0 ? "Gratuite" : fmtDA(fee)}</dd>
            </div>
          </dl>
          <div className="t-perf" aria-hidden="true" />
          <div className="t-total" aria-live="polite">
            <span className="t-total-label">Total à payer à la livraison</span>
            <span className="t-total-val"><Odometer centimes={total} /></span>
            {fee === undefined && <span className="t-sub">hors frais de livraison</span>}
          </div>
          <p className="t-note">Paiement en espèces à la réception. Nous vous appelons pour confirmer la commande.</p>
        </div>
        <SubmitButton className="cta--desktop" />
      </aside>

      {/* Mobile bar */}
      <div className="co-bar">
        <div className="co-bar-total" aria-hidden="true">
          <span className="co-bar-label">Total</span>
          <Odometer centimes={total} />
        </div>
        <SubmitButton className="cta--bar" />
      </div>
    </form>
    {sheetMounted && (
      <WilayaSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          wilayaBtnRef.current?.focus({ preventScroll: true });
        }}
        onSelect={pickWilaya}
        selected={wilaya}
        deliveryType={type}
        fees={feeMap}
      />
    )}
    </>
  );
}
