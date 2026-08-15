import { useQuery } from "@tanstack/react-query";
import { getQuotes, type Quote } from "@/lib/quotes.functions";

export type QuoteRequest = { symbol: string; assetClass: string; currency: string };

export function useQuotes(symbols: QuoteRequest[], enabled = true) {
  const key = symbols
    .map((s) => `${s.symbol}:${s.assetClass}:${s.currency}`)
    .sort()
    .join(",");

  return useQuery({
    queryKey: ["quotes", key],
    enabled: enabled && symbols.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await getQuotes({ data: { symbols } });
      const map = new Map<string, Quote>();
      for (const q of res.quotes) map.set(q.symbol.toUpperCase(), q);
      return { map, usdBrl: res.usdBrl, fetchedAt: res.fetchedAt };
    },
  });
}
