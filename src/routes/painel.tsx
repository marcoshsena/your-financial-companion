import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState, ErrorState, LoadingRows, SectionCard, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/use-session";
import {
  useAccounts,
  useCategories,
  useDividends,
  useInvestments,
  useTrades,
  useTransactions,
} from "@/lib/finance-queries";
import { brl, computePosition, dateBR, lastMonths, monthLabel, monthRange } from "@/lib/finance";
import { useQuotes } from "@/lib/use-quotes";

export const Route = createFileRoute("/painel")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel financeiro — Patrimônio" },
      {
        name: "description",
        content:
          "Resumo do mês, saldo das contas, evolução de receitas e despesas e valor da carteira em tempo real.",
      },
      { property: "og:title", content: "Painel financeiro — Patrimônio" },
      {
        property: "og:description",
        content: "Seu resumo financeiro com Open Finance e carteira atualizada em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PainelPage,
});

function PainelPage() {
  const { userId, loading } = useRequireAuth();
  const enabled = Boolean(userId);
  const months = useMemo(() => lastMonths(6), []);
  const range = useMemo(
    () => ({ from: monthRange(months[0]!).start, to: monthRange(months[5]!).end }),
    [months],
  );

  const tx = useTransactions(range, enabled);
  const accounts = useAccounts(enabled);
  const categories = useCategories(enabled);
  const investments = useInvestments(enabled);
  const trades = useTrades(enabled);
  const dividends = useDividends(enabled);

  const quoteReqs = useMemo(
    () =>
      (investments.data ?? []).map((i) => ({
        symbol: i.symbol,
        assetClass: i.asset_class,
        currency: i.currency,
      })),
    [investments.data],
  );
  const quotes = useQuotes(quoteReqs, enabled);

  const currentKey = months[5]!;
  const rows = tx.data ?? [];
  const monthRows = rows.filter((r) => r.occurred_on.startsWith(currentKey));
  const receitas = monthRows
    .filter((r) => r.kind === "receita")
    .reduce((s, r) => s + Number(r.amount), 0);
  const despesas = monthRows
    .filter((r) => r.kind === "despesa")
    .reduce((s, r) => s + Number(r.amount), 0);
  const saldoContas = (accounts.data ?? []).reduce((s, a) => s + Number(a.balance), 0);

  const chartData = months.map((key) => {
    const list = rows.filter((r) => r.occurred_on.startsWith(key));
    return {
      mes: monthLabel(key),
      receitas: list.filter((r) => r.kind === "receita").reduce((s, r) => s + Number(r.amount), 0),
      despesas: list.filter((r) => r.kind === "despesa").reduce((s, r) => s + Number(r.amount), 0),
    };
  });

  const usdBrl = quotes.data?.usdBrl ?? null;
  const carteira = (investments.data ?? []).reduce((total, inv) => {
    const pos = computePosition(
      (trades.data ?? [])
        .filter((t) => t.investment_id === inv.id)
        .map((t) => ({
          side: t.side,
          quantity: Number(t.quantity),
          price: Number(t.price),
          fees: Number(t.fees),
          traded_on: t.traded_on,
        })),
    );
    if (pos.quantity <= 0) return total;
    const quote = quotes.data?.map.get(inv.symbol.toUpperCase());
    const price = quote?.price ?? pos.avgPrice;
    const value = pos.quantity * price;
    const isForeign = inv.currency !== "BRL" || inv.asset_class === "cripto";
    return total + (isForeign && usdBrl ? value * usdBrl : value);
  }, 0);

  const proventos = (dividends.data ?? []).reduce((s, d) => s + Number(d.amount), 0);

  const topCategorias = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of monthRows) {
      if (r.kind !== "despesa") continue;
      const name =
        (categories.data ?? []).find((c) => c.id === r.category_id)?.name ?? "Sem categoria";
      map.set(name, (map.get(name) ?? 0) + Number(r.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [monthRows, categories.data]);

  const isLoading = loading || tx.isLoading;

  return (
    <AppShell
      title="Painel"
      description="Visão consolidada das suas finanças e da sua carteira"
      actions={
        <Button asChild size="sm">
          <Link to="/lancamentos">Novo lançamento</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Receitas do mês"
          value={brl(receitas)}
          tone="positive"
          loading={isLoading}
        />
        <StatCard
          label="Despesas do mês"
          value={brl(despesas)}
          tone="negative"
          loading={isLoading}
        />
        <StatCard
          label="Resultado do mês"
          value={brl(receitas - despesas)}
          tone={receitas - despesas >= 0 ? "positive" : "negative"}
          loading={isLoading}
        />
        <StatCard
          label="Saldo em contas"
          value={brl(saldoContas)}
          hint={`${(accounts.data ?? []).length} conta(s)`}
          loading={accounts.isLoading}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Carteira (valor atual)"
          value={brl(carteira)}
          hint={quotes.data?.fetchedAt ? "Cotações em tempo real" : "Aguardando cotações"}
          loading={investments.isLoading || trades.isLoading}
        />
        <StatCard label="Proventos recebidos" value={brl(proventos)} tone="positive" />
        <StatCard
          label="Dólar (USD/BRL)"
          value={usdBrl ? brl(usdBrl) : "—"}
          loading={quotes.isLoading}
        />
        <StatCard label="Patrimônio total" value={brl(saldoContas + carteira)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Receitas x Despesas (6 meses)" className="lg:col-span-2">
          {tx.error ? (
            <ErrorState error={tx.error} />
          ) : isLoading ? (
            <LoadingRows rows={3} />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip formatter={(v: number) => brl(Number(v))} />
                  <Bar dataKey="receitas" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Maiores despesas do mês">
          {topCategorias.length === 0 ? (
            <EmptyState message="Sem despesas neste mês." />
          ) : (
            <ul className="space-y-3">
              {topCategorias.map(([name, total]) => (
                <li key={name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground truncate">{name}</span>
                  <span className="num text-primary font-medium">{brl(total)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Últimos lançamentos"
        className="mt-4"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/lancamentos">Ver todos</Link>
          </Button>
        }
      >
        {isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState
            message="Nenhum lançamento ainda. Cadastre manualmente ou conecte suas contas."
            action={
              <Button asChild size="sm">
                <Link to="/conexoes">Conectar Open Finance</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-border/70 divide-y">
            {rows.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="text-primary truncate font-medium">{r.description}</p>
                  <p className="text-muted-foreground text-xs">
                    {dateBR(r.occurred_on)} · {r.source === "pluggy" ? "Open Finance" : "Manual"}
                  </p>
                </div>
                <span
                  className={
                    r.kind === "receita" ? "num text-positive" : "num text-negative"
                  }
                >
                  {r.kind === "receita" ? "+" : "-"}
                  {brl(Number(r.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </AppShell>
  );
}
