export type TxKind = "receita" | "despesa";

export const brl = (value: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const num = (value: number, digits = 2) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    Number.isFinite(value) ? value : 0,
  );

export const pct = (value: number) =>
  `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;

export const dateBR = (value: string | null | undefined) => {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");
};

export const monthRange = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y!, m ?? 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
};

export const lastMonths = (count: number) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return monthKey(d);
  });
};

export type Trade = {
  side: "compra" | "venda";
  quantity: number;
  price: number;
  fees: number;
  traded_on: string;
};

export type Position = {
  quantity: number;
  avgPrice: number;
  invested: number;
  realized: number;
  firstBuy: string | null;
  lastSell: string | null;
};

/** Preço médio ponderado com baixa proporcional nas vendas (padrão B3). */
export function computePosition(trades: Trade[]): Position {
  const ordered = [...trades].sort((a, b) => a.traded_on.localeCompare(b.traded_on));
  let quantity = 0;
  let invested = 0;
  let realized = 0;
  let firstBuy: string | null = null;
  let lastSell: string | null = null;

  for (const t of ordered) {
    const qty = Number(t.quantity);
    const price = Number(t.price);
    const fees = Number(t.fees ?? 0);
    if (t.side === "compra") {
      firstBuy ??= t.traded_on;
      quantity += qty;
      invested += qty * price + fees;
    } else {
      const avg = quantity > 0 ? invested / quantity : 0;
      const sold = Math.min(qty, quantity);
      realized += sold * price - sold * avg - fees;
      quantity -= sold;
      invested -= sold * avg;
      lastSell = t.traded_on;
    }
  }

  return {
    quantity,
    avgPrice: quantity > 0 ? invested / quantity : 0,
    invested: Math.max(invested, 0),
    realized,
    firstBuy,
    lastSell,
  };
}

export const ASSET_CLASS_LABEL: Record<string, string> = {
  acao: "Ação",
  fii: "FII",
  etf: "ETF",
  cripto: "Cripto",
  renda_fixa: "Renda fixa",
  bdr: "BDR",
  outro: "Outro",
};