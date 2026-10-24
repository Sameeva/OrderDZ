/** Wilaya codes: 69 after law 26-06 of 4 April 2026 (JO n. 25); 01-58 unchanged. */
export const MAX_WILAYA_CODE = 69;

export function isWilayaCode(code: number): boolean {
  return Number.isInteger(code) && code >= 1 && code <= MAX_WILAYA_CODE;
}
