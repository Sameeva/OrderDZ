import { describe, expect, it } from "vitest";
import { computeTotals, formatDA } from "./money";
import { normalizeMobile } from "./phone";
import { ORDER_STATUSES, allowedTransitions, assertTransition, canTransition } from "./status";
import { isWilayaCode } from "./wilaya";

describe("money", () => {
  it("adds items and delivery in integer centimes", () => {
    const t = computeTotals(
      [
        { quantity: 2, unitPriceCentimes: 150_000 },
        { quantity: 1, unitPriceCentimes: 49_950 },
      ],
      60_000,
    );
    expect(t).toEqual({ subtotalCentimes: 349_950, deliveryFeeCentimes: 60_000, totalCodCentimes: 409_950 });
  });
  it("rejects empty orders, bad quantities and fractional amounts", () => {
    expect(() => computeTotals([], 0)).toThrow();
    expect(() => computeTotals([{ quantity: 0, unitPriceCentimes: 100 }], 0)).toThrow();
    expect(() => computeTotals([{ quantity: 1, unitPriceCentimes: 10.5 }], 0)).toThrow();
    expect(() => computeTotals([{ quantity: 1, unitPriceCentimes: 100 }], -1)).toThrow();
  });
  it("formats centimes as DA", () => {
    expect(formatDA(0)).toBe("0,00 DA");
    expect(formatDA(123_456)).toBe("1 234,56 DA");
    expect(formatDA(5)).toBe("0,05 DA");
  });
});

describe("normalizeMobile", () => {
  it("accepts national and international forms", () => {
    expect(normalizeMobile("0551 23 45 67")).toBe("0551234567");
    expect(normalizeMobile("+213 661 234 567")).toBe("0661234567");
    expect(normalizeMobile("00213771234567")).toBe("0771234567");
  });
  it("rejects landlines and malformed numbers", () => {
    for (const v of ["021 23 45 67", "055123456", "08012345678", "abc", ""]) expect(normalizeMobile(v), v).toBeNull();
  });
});

describe("order status machine", () => {
  it("allows the normal path", () => {
    const path = ["PENDING", "NO_ANSWER_1", "NO_ANSWER_2", "CONFIRMED", "SHIPPED", "DELIVERED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("cannot cancel once shipped, and final states are final", () => {
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
    for (const s of ["DELIVERED", "RETURNED", "CANCELLED"] as const) expect(allowedTransitions(s)).toEqual([]);
    expect(() => assertTransition("DELIVERED", "PENDING")).toThrow();
  });
  it("never transitions to itself", () => {
    for (const s of ORDER_STATUSES) expect(canTransition(s, s)).toBe(false);
  });
});

describe("wilaya", () => {
  it("accepts 1 to 69 only", () => {
    expect(isWilayaCode(1) && isWilayaCode(58) && isWilayaCode(69)).toBe(true);
    expect([0, 70, 1.5, -1].some(isWilayaCode)).toBe(false);
  });
});
