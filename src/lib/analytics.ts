import { computePosition, lastMonths, monthKey, monthLabel } from "./finance";
import type { Category, Dividend, Investment, Trade, Transaction } from "./finance-queries";

export const currentMonth = () => monthKey(new Date());

export function monthOf(dateISO: string) {
  return dateISO.slice(0, 7);
}

export function sumTransactions(rows: Transaction[], kind: "receita" | "despesa", month?: string) {
  return rows.reduce((total, row) => {
    if (row.kind !== kind) return total;
    if (month && monthOf(row.occurred_on) !== month) return total;
    return total + Number(row.amount);
  }, 0);
}

export function cashflowSeries(rows: Transaction[], months = 6) {
  const keys = lastMonths(months);
  return keys.map((key) => ({
    month: monthLabel(key),
    receitas: sumTransactions(rows, "receita", key),
    despesas: sumTransactions(rows, "despesa", key),
    resultado: sumTransactions(rows, "receita", key) - sumTransactions(rows, "despesa", key),
  }));
}

export function equitySeries(rows: Transaction[], baseBalance: number, months = 6) {
  const keys = lastMonths(months);
  const totals = keys.map(
    (key) => sumTransactions(rows, "receita", key) - sumTransactions(rows, "despesa", key),
  );
  const futureSum = totals.reduce((a, b) => a + b, 0);
  let running = baseBalance - futureSum;
  return keys.map((key, index) => {
    running += totals[index] ?? 0;
    return { month: monthLabel(key), patrimonio: running };
  });
}

export function expensesByCategory(rows: Transaction[], categories: Category[], month?: string) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, { name: string; color: string; total: number }>();
  for (const row of rows) {
    if (row.kind !== "despesa") continue;
    if (month && monthOf(row.occurred_on) !== month) continue;
    const category = row.category_id ? byId.get(row.category_id) : undefined;
    const key = category?.id ?? "sem-categoria";
    const entry = totals.get(key) ?? {
      name: category?.name ?? "Sem categoria",
      color: category?.color ?? "#94A3B8",
      total: 0,
    };
    entry.total += Number(row.amount);
    totals.set(key, entry);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

export type PortfolioRow = {
  investment: Investment;
  quantity: number;
  avgPrice: number;
  invested: number;
  realized: number;
  firstBuy: string | null;
  lastSell: string | null;
  dividends: number;
};

export function buildPortfolio(
  investments: Investment[],
  trades: Trade[],
  dividends: Dividend[],
): PortfolioRow[] {
  return investments.map((investment) => {
    const own = trades
      .filter((t) => t.investment_id === investment.id)
      .map((t) => ({
        side: t.side,
        quantity: Number(t.quantity),
        price: Number(t.price),
        fees: Number(t.fees ?? 0),
        traded_on: t.traded_on,
      }));
    const position = computePosition(own);
    const received = dividends
      .filter((d) => d.investment_id === investment.id)
      .reduce((total, d) => total + Number(d.amount), 0);
    return { investment, ...position, dividends: received };
  });
}

export function sumDividends(rows: Dividend[], prefix?: string) {
  return rows.reduce((total, row) => {
    if (prefix && !row.paid_on.startsWith(prefix)) return total;
    return total + Number(row.amount);
  }, 0);
}
