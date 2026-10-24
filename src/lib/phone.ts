/**
 * Algerian mobile numbers: 10 digits starting with 05, 06 or 07 (national form), or
 * +213 / 00213 followed by 9 digits starting with 5, 6 or 7. Returns the national
 * form "0XXXXXXXXX", or null when the input is not a mobile number.
 */
export function normalizeMobile(input: string): string | null {
  let d = input.replace(/[\s.\-()]/g, "");
  if (d.startsWith("+213")) d = "0" + d.slice(4);
  else if (d.startsWith("00213")) d = "0" + d.slice(5);
  return /^0[567]\d{8}$/.test(d) ? d : null;
}
