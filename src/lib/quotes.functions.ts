import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  symbols: z
    .array(
      z.object({
        symbol: z.string().min(1).max(24),
        assetClass: z.string().min(1).max(24),
        currency: z.string().min(3).max(4),
      }),
    )
    .max(80),
});

export type Quote = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  changePercent: number | null;
  currency: string | null;
  updatedAt: string | null;
};

function toYahoo(symbol: string, assetClass: string, currency: string) {
  const clean = symbol.trim().toUpperCase();
  if (clean.includes(".") || clean.includes("-") || clean.includes("=")) return clean;
  if (assetClass === "cripto") return `${clean}-USD`;
  if (currency === "BRL") return `${clean}.SA`;
  return clean;
}

async function fetchQuote(yahooSymbol: string): Promise<Omit<Quote, "symbol">> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FinanceDashboard/1.0)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`quote ${yahooSymbol}: ${res.status}`);
  const json = (await res.json()) as {
    chart?: { result?: Array<{ meta?: Record<string, number | string> }> };
  };
  const meta = json.chart?.result?.[0]?.meta;
  if (!meta) throw new Error("sem dados");
  const price = Number(meta["regularMarketPrice"] ?? NaN);
  const previousClose = Number(meta["chartPreviousClose"] ?? meta["previousClose"] ?? NaN);
  return {
    price: Number.isFinite(price) ? price : null,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    changePercent:
      Number.isFinite(price) && Number.isFinite(previousClose) && previousClose !== 0
        ? ((price - previousClose) / previousClose) * 100
        : null,
    currency: typeof meta["currency"] === "string" ? (meta["currency"] as string) : null,
    updatedAt: new Date().toISOString(),
  };
}

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const unique = new Map<string, { symbol: string; yahoo: string }>();
    for (const item of data.symbols) {
      const yahoo = toYahoo(item.symbol, item.assetClass, item.currency);
      unique.set(item.symbol.toUpperCase(), { symbol: item.symbol.toUpperCase(), yahoo });
    }

    const entries = [...unique.values()];
    const results = await Promise.all(
      entries.map(async (entry): Promise<Quote> => {
        try {
          const quote = await fetchQuote(entry.yahoo);
          return { symbol: entry.symbol, ...quote };
        } catch {
          return {
            symbol: entry.symbol,
            price: null,
            previousClose: null,
            changePercent: null,
            currency: null,
            updatedAt: null,
          };
        }
      }),
    );

    let usdBrl: number | null = null;
    try {
      usdBrl = (await fetchQuote("USDBRL=X")).price;
    } catch {
      usdBrl = null;
    }

    return { quotes: results, usdBrl, fetchedAt: new Date().toISOString() };
  });