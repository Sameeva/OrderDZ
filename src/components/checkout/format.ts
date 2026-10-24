import { normalizeMobile } from "@/lib/phone";

const NNBSP = " ";
const NBSP = " ";

export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

/** Display only. The server recomputes the real amounts. */
export function fmtDA(centimes: number): string {
  const whole = Math.floor(centimes / 100);
  const cents = centimes % 100;
  return `${groupDigits(whole)}${cents ? `,${String(cents).padStart(2, "0")}` : ""}${NBSP}DA`;
}

/** Lower-case, no accents/diacritics, apostrophes and hyphens folded to spaces. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٟ]/g, "")
    .toLowerCase()
    .replace(/['’\-\s]+/g, " ")
    .trim();
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0]?.toLowerCase() ?? "");
}

/** "0551234567" -> "05 51 23 45 67" */
export function groupPhone(national: string): string {
  return national.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export type PhoneState = "empty" | "typing" | "valid" | "bad-prefix" | "bad-chars" | "too-long";

export function phoneStatus(raw: string): { state: PhoneState; hint: string; ok: boolean } {
  const trimmed = raw.replace(/[\s.\-()]/g, "");
  if (!trimmed) return { state: "empty", hint: "10 chiffres, commence par 05, 06 ou 07.", ok: false };
  let d = trimmed;
  if (d.startsWith("+213")) d = "0" + d.slice(4);
  else if (d.startsWith("00213")) d = "0" + d.slice(5);
  if (/\D/.test(d)) return { state: "bad-chars", hint: "Chiffres uniquement.", ok: false };
  if (d.length >= 2 && !/^0[567]/.test(d))
    return { state: "bad-prefix", hint: "Un mobile commence par 05, 06 ou 07.", ok: false };
  if (d.length > 10) return { state: "too-long", hint: "Trop de chiffres : 10 attendus.", ok: false };
  if (normalizeMobile(raw)) return { state: "valid", hint: "Numéro valide.", ok: true };
  const missing = 10 - d.length;
  return { state: "typing", hint: `Encore ${missing} chiffre${missing > 1 ? "s" : ""}.`, ok: false };
}
