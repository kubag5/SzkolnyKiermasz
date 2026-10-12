import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  convertAmount,
  createCurrencyService,
  createFrankfurterClient,
  CurrencyUnavailableError,
  normalizeRatePayload,
} from "./currency";

describe("normalizeRatePayload", () => {
  it("accepts a valid Frankfurter rate", () => {
    expect(normalizeRatePayload({ date: "2026-10-09", base: "PLN", quote: "EUR", rate: 0.231 }, "PLN", "EUR"))
      .toEqual({ date: "2026-10-09", base: "PLN", quote: "EUR", rate: 0.231 });
  });

  it("rejects bad data", () => {
    expect(() => normalizeRatePayload({ date: "yesterday", base: "PLN", quote: "USD", rate: -2 }, "PLN", "EUR")).toThrow();
  });
});

describe("convertAmount", () => {
  it("rounds to two decimals", () => {
    expect(convertAmount(49.99, 0.231)).toBe(11.55);
  });
});

describe("Frankfurter client", () => {
  it("reuses one request for the same pair", async () => {
    const fetcher = vi.fn(async () => Response.json({ date: "2026-10-12", base: "PLN", quote: "EUR", rate: 0.22796 }));
    const client = createFrankfurterClient(fetcher as unknown as typeof fetch);
    const [first, second] = await Promise.all([client.getRate("PLN", "EUR"), client.getRate("PLN", "EUR")]);
    expect(first).toEqual(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("currency cache", () => {
  const today = new Date("2026-10-12T00:00:00.000Z");

  function savedRate(fetchedAt: Date) {
    return { baseCurrency: "PLN", quoteCurrency: "EUR", date: new Date("2026-10-09T00:00:00.000Z"), rate: 0.231, fetchedAt };
  }

  it("uses a fresh cached rate", async () => {
    const findFirst = vi.fn(async () => savedRate(new Date("2026-10-11T15:00:00.000Z")));
    const frankfurter = { getRate: vi.fn(), getCurrencies: vi.fn() };
    const service = createCurrencyService({ exchangeRate: { findFirst } } as unknown as PrismaClient, frankfurter as never, () => today);
    await expect(service.getRate("EUR")).resolves.toMatchObject({ rate: 0.231, stale: false });
    expect(frankfurter.getRate).not.toHaveBeenCalled();
  });

  it("falls back to a saved rate when API fails", async () => {
    const findFirst = vi.fn(async () => savedRate(new Date("2026-10-10T00:00:00.000Z")));
    const frankfurter = { getRate: vi.fn(async () => { throw new Error("timeout"); }), getCurrencies: vi.fn() };
    const service = createCurrencyService({ exchangeRate: { findFirst } } as unknown as PrismaClient, frankfurter as never, () => today);
    await expect(service.getRate("EUR")).resolves.toMatchObject({ rate: 0.231, stale: true });
  });

  it("throws when there is no cache and API fails", async () => {
    const frankfurter = { getRate: vi.fn(async () => { throw new Error("timeout"); }), getCurrencies: vi.fn() };
    const service = createCurrencyService({ exchangeRate: { findFirst: vi.fn(async () => null) } } as unknown as PrismaClient, frankfurter as never, () => today);
    await expect(service.getRate("EUR")).rejects.toBeInstanceOf(CurrencyUnavailableError);
  });
});
