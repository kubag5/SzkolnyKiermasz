import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

const frankfurterRateSchema = z.object({
  date: z.iso.date(),
  base: z.string().regex(/^[A-Z]{3}$/),
  quote: z.string().regex(/^[A-Z]{3}$/),
  rate: z.number().finite().positive(),
});

const currencyListSchema = z.array(z.object({
  iso_code: z.string().regex(/^[A-Z]{3}$/),
  name: z.string().min(1),
  symbol: z.string().nullable().optional(),
}));

export type NormalizedRate = z.infer<typeof frankfurterRateSchema>;
export type SupportedCurrency = z.infer<typeof currencyListSchema>[number];

export class UnsupportedCurrencyError extends Error {
  constructor() {
    super("Ta waluta nie jest obsługiwana przez Frankfurter API.");
    this.name = "UnsupportedCurrencyError";
  }
}

export class CurrencyUnavailableError extends Error {
  constructor() {
    super("Nie udało się pobrać aktualnych kursów walut. Spróbuj ponownie później.");
    this.name = "CurrencyUnavailableError";
  }
}

export function normalizeRatePayload(payload: unknown, base: string, quote: string): NormalizedRate {
  const parsed = frankfurterRateSchema.parse(payload);
  const expectedBase = base.toUpperCase();
  const expectedQuote = quote.toUpperCase();
  if (parsed.base !== expectedBase || parsed.quote !== expectedQuote) {
    throw new Error("Frankfurter returned a different currency pair than requested.");
  }
  return parsed;
}

export function convertAmount(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid amount or exchange rate.");
  }
  return Math.round((amount * rate + Number.EPSILON) * 100) / 100;
}

// Frankfurter API + prosty cache w pamięci
export function createFrankfurterClient(fetcher: typeof fetch = fetch) {
  let currenciesCache: { expiresAt: number; value: SupportedCurrency[] } | undefined;
  let currenciesRequest: Promise<SupportedCurrency[]> | undefined;
  const rateRequests = new Map<string, Promise<NormalizedRate>>();

  return {
    getRate(base: string, quote: string) {
      const normalizedBase = base.toUpperCase();
      const normalizedQuote = quote.toUpperCase();
      const key = `${normalizedBase}/${normalizedQuote}`;
      const pending = rateRequests.get(key);
      if (pending) return pending;

      const request = (async () => {
        const response = await fetcher(`https://api.frankfurter.dev/v2/rate/${normalizedBase}/${normalizedQuote}`, {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "application/json" },
        });
        if (response.status === 404 || response.status === 422) throw new UnsupportedCurrencyError();
        if (!response.ok) throw new Error(`Frankfurter responded with HTTP ${response.status}.`);
        return normalizeRatePayload(await response.json(), normalizedBase, normalizedQuote);
      })();

      const tracked = request.finally(() => { rateRequests.delete(key); });
      rateRequests.set(key, tracked);
      return tracked;
    },

    async getCurrencies() {
      if (currenciesCache && currenciesCache.expiresAt > Date.now()) return currenciesCache.value;
      if (!currenciesRequest) {
        currenciesRequest = fetcher("https://api.frankfurter.dev/v2/currencies", {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "application/json" },
        }).then(async (response) => {
          if (!response.ok) throw new Error(`Frankfurter responded with HTTP ${response.status}.`);
          const parsed = currencyListSchema.parse(await response.json());
          currenciesCache = { value: parsed, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
          return parsed;
        }).finally(() => { currenciesRequest = undefined; });
      }
      return currenciesRequest;
    },
  };
}

export type FrankfurterClient = ReturnType<typeof createFrankfurterClient>;

// Kurs z bazy (cache ok. 12h) albo z API; jak API padnie, bierzemy stary kurs
export function createCurrencyService(
  prisma: PrismaClient,
  frankfurter: FrankfurterClient,
  now = () => new Date(),
) {
  return {
    async getRate(quoteCurrency: string) {
      const baseCurrency = "PLN";
      const quote = quoteCurrency.toUpperCase();
      if (quote === baseCurrency) {
        return { base: baseCurrency, quote, date: now().toISOString().slice(0, 10), rate: 1, stale: false };
      }

      const cached = await prisma.exchangeRate.findFirst({
        where: { baseCurrency, quoteCurrency: quote },
        orderBy: { date: "desc" },
      });
      const isFresh = cached && now().getTime() - cached.fetchedAt.getTime() < 12 * 60 * 60 * 1000;
      if (isFresh) return toRate(cached, false);

      try {
        const rate = await frankfurter.getRate(baseCurrency, quote);
        const date = new Date(`${rate.date}T00:00:00.000Z`);
        const saved = await prisma.exchangeRate.upsert({
          where: { baseCurrency_quoteCurrency_date: { baseCurrency, quoteCurrency: quote, date } },
          create: { baseCurrency, quoteCurrency: quote, date, rate: rate.rate, fetchedAt: now() },
          update: { rate: rate.rate, fetchedAt: now() },
        });
        return toRate(saved, false);
      } catch (error) {
        if (error instanceof UnsupportedCurrencyError) throw error;
        if (cached) return toRate(cached, true);
        throw new CurrencyUnavailableError();
      }
    },

    async convert(amount: number, quoteCurrency: string) {
      const rate = await this.getRate(quoteCurrency);
      return { ...rate, amount: convertAmount(amount, rate.rate) };
    },
  };
}

export type CurrencyService = ReturnType<typeof createCurrencyService>;

function toRate(rate: { baseCurrency: string; quoteCurrency: string; date: Date; rate: unknown }, stale: boolean) {
  return {
    base: rate.baseCurrency,
    quote: rate.quoteCurrency,
    date: rate.date.toISOString().slice(0, 10),
    rate: Number(rate.rate),
    stale,
  };
}
