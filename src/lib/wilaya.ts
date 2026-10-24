import { WILAYAS } from "./wilayas";

/** Wilaya codes: 69 after law 26-06 of 4 April 2026 (JO n. 25); 01-58 unchanged. */
export const MAX_WILAYA_CODE = WILAYAS.length;

const BY_CODE = new Map(WILAYAS.map((w) => [w.code, w]));

export function isWilayaCode(code: number): boolean {
  return BY_CODE.has(code);
}

export function wilayaName(code: number): string | undefined {
  return BY_CODE.get(code)?.nameFr;
}

/** "16 - Alger" */
export function wilayaLabel(code: number): string {
  return `${String(code).padStart(2, "0")} - ${wilayaName(code) ?? "?"}`;
}

/** The wilaya a courier should be given when it does not know the new wilayas (59-69). */
export function courierWilayaCode(code: number): number {
  return BY_CODE.get(code)?.motherCode ?? code;
}
