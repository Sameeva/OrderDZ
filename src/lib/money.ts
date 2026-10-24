/** Money is always an integer number of centimes (1 DA = 100 centimes). */

export function assertCentimes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`Invalid centimes amount: ${value}`);
  return value;
}

export function computeTotals(
  items: readonly { quantity: number; unitPriceCentimes: number }[],
  deliveryFeeCentimes: number,
) {
  if (items.length === 0) throw new RangeError("An order needs at least one item.");
  assertCentimes(deliveryFeeCentimes);
  let subtotalCentimes = 0;
  for (const it of items) {
    if (!Number.isSafeInteger(it.quantity) || it.quantity < 1) throw new RangeError(`Invalid quantity: ${it.quantity}`);
    subtotalCentimes += it.quantity * assertCentimes(it.unitPriceCentimes);
  }
  assertCentimes(subtotalCentimes);
  return { subtotalCentimes, deliveryFeeCentimes, totalCodCentimes: subtotalCentimes + deliveryFeeCentimes };
}

/** 123456 -> "1 234,56 DA" (fr-DZ style, narrow no-break space as thousands separator). */
export function formatDA(centimes: number): string {
  assertCentimes(centimes);
  const da = Math.floor(centimes / 100);
  const cents = centimes % 100;
  const whole = String(da).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${whole},${String(cents).padStart(2, "0")} DA`;
}
