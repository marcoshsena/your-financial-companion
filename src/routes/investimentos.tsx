import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState, ErrorState, LoadingRows, SectionCard, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRequireAuth } from "@/hooks/use-session";
import {
  useDeleteDividend,
  useDeleteInvestment,
  useDeleteTrade,
  useDividends,
  useInvestments,
  useSaveDividend,
  useSaveInvestment,
  useSaveTrade,
  useTrades,
  type DividendInput,
  type InvestmentInput,
  type TradeInput,
} from "@/lib/finance-queries";
import { buildPortfolio, sumDividends } from "@/lib/analytics";
import { ASSET_CLASS_LABEL, brl, dateBR, num, pct } from "@/lib/finance";
import { useQuotes } from "@/lib/use-quotes";

export const Route = createFileRoute("/investimentos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Carteira de investimentos — Patrimônio" },
      {
        name: "description",
        content:
          "Posições, preço médio, cotações em tempo real, rentabilidade, operações de compra e venda e proventos recebidos.",
      },
      { property: "og:title", content: "Carteira de investimentos — Patrimônio" },
      {
        property: "og:description",
        content: "Acompanhe posições, preço médio e rendimentos da sua carteira em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestimentosPage,
});

const ASSET_CLASSES = ["acao", "fii", "etf", "cripto", "renda_fixa", "bdr", "outro"] as const;

const emptyInvestment = (): InvestmentInput => ({
  symbol: "",
  name: "",
  asset_class: "acao",
  currency: "BRL",
});

const today = () => new Date().toISOString().slice(0, 10);

const emptyTrade = (investmentId: string): TradeInput => ({
  investment_id: investmentId,
  side: "compra",
  quantity: 0,
  price: 0,
  fees: 0,
  traded_on: today(),
  notes: null,
});

const emptyDividend = (investmentId: string): DividendInput => ({
  investment_id: investmentId,
  amount: 0,
  kind: "dividendo",
  paid_on: today(),
});

function InvestimentosPage() {
  const { userId, loading } = useRequireAuth();
  const enabled = Boolean(userId);

  const investments = useInvestments(enabled);
  const trades = useTrades(enabled);
  const dividends = useDividends(enabled);

  const saveInvestment = useSaveInvestment(userId);
  const removeInvestment = useDeleteInvestment();
  const saveTrade = useSaveTrade(userId);
  const removeTrade = useDeleteTrade();
  const saveDividend = useSaveDividend(userId);
  const removeDividend = useDeleteDividend();

  const [assetOpen, setAssetOpen] = useState(false);
  const [assetForm, setAssetForm] = useState<InvestmentInput>(emptyInvestment());
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeForm, setTradeForm] = useState<TradeInput>(emptyTrade(""));
  const [divOpen, setDivOpen] = useState(false);
  const [divForm, setDivForm] = useState<DividendInput>(emptyDividend(""));

  const list = investments.data ?? [];

  const quoteReqs = useMemo(
    () =>
      list.map((i) => ({ symbol: i.symbol, assetClass: i.asset_class, currency: i.currency })),
    [list],
  );
  const quotes = useQuotes(quoteReqs, enabled);
  const usdBrl = quotes.data?.usdBrl ?? 0;

  const portfolio = useMemo(
    () => buildPortfolio(list, trades.data ?? [], dividends.data ?? []),
    [list, trades.data, dividends.data],
  );

  const rows = portfolio.map((row) => {
    const quote = quotes.data?.map.get(row.investment.symbol.toUpperCase());
    const price = quote?.price ?? null;
    const isForeign = row.investment.currency !== "BRL";
    const rate = isForeign && usdBrl > 0 ? usdBrl : 1;
    const marketValue = price !== null ? price * row.quantity * rate : null;
    const investedBRL = row.invested * (isForeign ? rate : 1);
    const profit = marketValue !== null ? marketValue - investedBRL : null;
    const profitPct = profit !== null && investedBRL > 0 ? profit / investedBRL : null;
    return { ...row, price, marketValue, investedBRL, profit, profitPct };
  });

  const totalMarket = rows.reduce((t, r) => t + (r.marketValue ?? r.investedBRL), 0);
  const totalInvested = rows.reduce((t, r) => t + r.investedBRL, 0);
  const totalProfit = totalMarket - totalInvested;
  const totalDividends = sumDividends(dividends.data ?? []);

  const isLoading = loading || investments.isLoading || trades.isLoading || dividends.isLoading;
  const error = investments.error ?? trades.error ?? dividends.error;

  const submitAsset = async () => {
    if (!assetForm.symbol.trim()) {
      toast.error("Informe o código do ativo (ex.: PETR4, AAPL, BTC).");
      return;
    }
    try {
      await saveInvestment.mutateAsync({ values: { ...assetForm, name: assetForm.name || null } });
      toast.success("Ativo adicionado à carteira.");
      setAssetOpen(false);
      setAssetForm(emptyInvestment());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar ativo.");
    }
  };

  const submitTrade = async () => {
    if (!tradeForm.investment_id) {
      toast.error("Selecione o ativo.");
      return;
    }
    if (!(tradeForm.quantity > 0) || !(tradeForm.price > 0)) {
      toast.error("Quantidade e preço devem ser maiores que zero.");
      return;
    }
    try {
      await saveTrade.mutateAsync(tradeForm);
      toast.success("Operação registrada.");
      setTradeOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar operação.");
    }
  };

  const submitDividend = async () => {
    if (!divForm.investment_id) {
      toast.error("Selecione o ativo.");
      return;
    }
    if (!(divForm.amount > 0)) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    try {
      await saveDividend.mutateAsync(divForm);
      toast.success("Provento registrado.");
      setDivOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar provento.");
    }
  };

  const symbolOf = (id: string) => list.find((i) => i.id === id)?.symbol ?? "—";

  return (
    <AppShell
      title="Investimentos"
      description="Posições, preço médio, cotações ao vivo, rentabilidade e proventos."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTradeForm(emptyTrade(list[0]?.id ?? ""));
              setTradeOpen(true);
            }}
            disabled={list.length === 0}
          >
            Nova operação
          </Button>
          <Button size="sm" onClick={() => setAssetOpen(true)}>
            <Plus className="size-4" /> Ativo
          </Button>
        </>
      }
    >
      {error ? <ErrorState error={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Valor da carteira" value={brl(totalMarket)} loading={isLoading} />
        <StatCard label="Total investido" value={brl(totalInvested)} loading={isLoading} />
        <StatCard
          label="Resultado não realizado"
          value={brl(totalProfit)}
          tone={totalProfit >= 0 ? "positive" : "negative"}
          loading={isLoading}
        />
        <StatCard
          label="Proventos recebidos"
          value={brl(totalDividends)}
          tone="positive"
          loading={isLoading}
          hint={usdBrl > 0 ? `USD/BRL ${num(usdBrl, 4)}` : undefined}
        />
      </div>

      <Tabs defaultValue="posicoes" className="mt-4">
        <TabsList>
          <TabsTrigger value="posicoes">Posições</TabsTrigger>
          <TabsTrigger value="operacoes">Operações</TabsTrigger>
          <TabsTrigger value="proventos">Proventos</TabsTrigger>
        </TabsList>

        <TabsContent value="posicoes">
          <SectionCard title="Carteira">
            {isLoading ? (
              <LoadingRows rows={5} />
            ) : rows.length === 0 ? (
              <EmptyState
                message="Nenhum ativo cadastrado. Adicione o primeiro ativo e registre suas operações."
                action={
                  <Button size="sm" onClick={() => setAssetOpen(true)}>
                    Adicionar ativo
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="text-muted-foreground text-xs uppercase">
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium">Ativo</th>
                      <th className="py-2 text-right font-medium">Qtd.</th>
                      <th className="py-2 text-right font-medium">Preço médio</th>
                      <th className="py-2 text-right font-medium">Cotação</th>
                      <th className="py-2 text-right font-medium">Valor atual</th>
                      <th className="py-2 text-right font-medium">Resultado</th>
                      <th className="py-2 text-right font-medium">Proventos</th>
                      <th className="py-2 text-right font-medium">1ª compra</th>
                      <th className="py-2 text-right font-medium">Últ. venda</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-border/70 divide-y">
                    {rows.map((r) => (
                      <tr key={r.investment.id}>
                        <td className="py-2.5">
                          <p className="text-primary font-medium">{r.investment.symbol}</p>
                          <p className="text-muted-foreground text-xs">
                            {ASSET_CLASS_LABEL[r.investment.asset_class] ?? r.investment.asset_class}
                            {r.investment.name ? ` · ${r.investment.name}` : ""}
                          </p>
                        </td>
                        <td className="num py-2.5 text-right">{num(r.quantity, 6)}</td>
                        <td className="num py-2.5 text-right">
                          {brl(r.avgPrice, r.investment.currency)}
                        </td>
                        <td className="num py-2.5 text-right">
                          {r.price === null ? "—" : brl(r.price, r.investment.currency)}
                        </td>
                        <td className="num py-2.5 text-right">
                          {r.marketValue === null ? "—" : brl(r.marketValue)}
                        </td>
                        <td
                          className={
                            (r.profit ?? 0) >= 0
                              ? "num text-positive py-2.5 text-right"
                              : "num text-negative py-2.5 text-right"
                          }
                        >
                          {r.profit === null ? "—" : brl(r.profit)}
                          {r.profitPct !== null ? (
                            <span className="text-muted-foreground ml-1 text-xs">
                              {pct(r.profitPct)}
                            </span>
                          ) : null}
                        </td>
                        <td className="num text-positive py-2.5 text-right">{brl(r.dividends)}</td>
                        <td className="num py-2.5 text-right">{dateBR(r.firstBuy)}</td>
                        <td className="num py-2.5 text-right">{dateBR(r.lastSell)}</td>
                        <td className="py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir ${r.investment.symbol}`}
                            onClick={async () => {
                              try {
                                await removeInvestment.mutateAsync(r.investment.id);
                                toast.success("Ativo removido.");
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Erro ao remover.",
                                );
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="operacoes">
          <SectionCard
            title="Compras e vendas"
            action={
              <Button
                size="sm"
                variant="outline"
                disabled={list.length === 0}
                onClick={() => {
                  setTradeForm(emptyTrade(list[0]?.id ?? ""));
                  setTradeOpen(true);
                }}
              >
                Registrar
              </Button>
            }
          >
            {isLoading ? (
              <LoadingRows />
            ) : (trades.data ?? []).length === 0 ? (
              <EmptyState message="Nenhuma operação registrada." />
            ) : (
              <ul className="divide-border/70 divide-y">
                {(trades.data ?? []).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-primary font-medium">
                        {symbolOf(t.investment_id)} · {t.side === "compra" ? "Compra" : "Venda"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {dateBR(t.traded_on)} · {num(Number(t.quantity), 6)} x{" "}
                        {brl(Number(t.price))}
                        {Number(t.fees ?? 0) > 0 ? ` · taxas ${brl(Number(t.fees))}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          t.side === "compra"
                            ? "num text-negative"
                            : "num text-positive"
                        }
                      >
                        {brl(Number(t.quantity) * Number(t.price))}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir operação"
                        onClick={async () => {
                          try {
                            await removeTrade.mutateAsync(t.id);
                            toast.success("Operação excluída.");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="proventos">
          <SectionCard
            title="Dividendos e rendimentos"
            action={
              <Button
                size="sm"
                variant="outline"
                disabled={list.length === 0}
                onClick={() => {
                  setDivForm(emptyDividend(list[0]?.id ?? ""));
                  setDivOpen(true);
                }}
              >
                Registrar
              </Button>
            }
          >
            {isLoading ? (
              <LoadingRows />
            ) : (dividends.data ?? []).length === 0 ? (
              <EmptyState message="Nenhum provento registrado." />
            ) : (
              <ul className="divide-border/70 divide-y">
                {(dividends.data ?? []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="text-primary font-medium">{symbolOf(d.investment_id)}</p>
                      <p className="text-muted-foreground text-xs">
                        {dateBR(d.paid_on)} · {d.kind}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="num text-positive">{brl(Number(d.amount))}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir provento"
                        onClick={async () => {
                          try {
                            await removeDividend.mutateAsync(d.id);
                            toast.success("Provento excluído.");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo ativo</DialogTitle>
            <DialogDescription>
              Use o código de negociação: PETR4 e HGLG11 (Brasil), AAPL (EUA), BTC (cripto).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="symbol">Código</Label>
              <Input
                id="symbol"
                value={assetForm.symbol}
                onChange={(e) => setAssetForm((f) => ({ ...f, symbol: e.target.value }))}
                placeholder="PETR4"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="asset-name">Nome (opcional)</Label>
              <Input
                id="asset-name"
                value={assetForm.name ?? ""}
                onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Classe</Label>
                <Select
                  value={assetForm.asset_class}
                  onValueChange={(v) =>
                    setAssetForm((f) => ({
                      ...f,
                      asset_class: v as InvestmentInput["asset_class"],
                      currency: v === "cripto" ? "USD" : f.currency,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CLASSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {ASSET_CLASS_LABEL[c] ?? c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Moeda</Label>
                <Select
                  value={assetForm.currency}
                  onValueChange={(v) => setAssetForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitAsset} disabled={saveInvestment.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tradeOpen} onOpenChange={setTradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova operação</DialogTitle>
            <DialogDescription>Compras e vendas atualizam o preço médio da posição.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Ativo</Label>
              <Select
                value={tradeForm.investment_id}
                onValueChange={(v) => setTradeForm((f) => ({ ...f, investment_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={tradeForm.side}
                  onValueChange={(v) =>
                    setTradeForm((f) => ({ ...f, side: v as TradeInput["side"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="venda">Venda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="traded-on">Data</Label>
                <Input
                  id="traded-on"
                  type="date"
                  value={tradeForm.traded_on}
                  onChange={(e) => setTradeForm((f) => ({ ...f, traded_on: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="qty">Quantidade</Label>
                <Input
                  id="qty"
                  type="number"
                  step="any"
                  value={tradeForm.quantity || ""}
                  onChange={(e) =>
                    setTradeForm((f) => ({ ...f, quantity: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="price">Preço unitário</Label>
                <Input
                  id="price"
                  type="number"
                  step="any"
                  value={tradeForm.price || ""}
                  onChange={(e) => setTradeForm((f) => ({ ...f, price: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fees">Taxas</Label>
                <Input
                  id="fees"
                  type="number"
                  step="any"
                  value={tradeForm.fees || ""}
                  onChange={(e) => setTradeForm((f) => ({ ...f, fees: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTradeOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitTrade} disabled={saveTrade.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={divOpen} onOpenChange={setDivOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo provento</DialogTitle>
            <DialogDescription>Dividendos, JCP e rendimentos recebidos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Ativo</Label>
              <Select
                value={divForm.investment_id}
                onValueChange={(v) => setDivForm((f) => ({ ...f, investment_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={divForm.kind}
                  onValueChange={(v) => setDivForm((f) => ({ ...f, kind: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dividendo">Dividendo</SelectItem>
                    <SelectItem value="jcp">JCP</SelectItem>
                    <SelectItem value="rendimento">Rendimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="paid-on">Data do pagamento</Label>
                <Input
                  id="paid-on"
                  type="date"
                  value={divForm.paid_on}
                  onChange={(e) => setDivForm((f) => ({ ...f, paid_on: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="div-amount">Valor</Label>
                <Input
                  id="div-amount"
                  type="number"
                  step="any"
                  value={divForm.amount || ""}
                  onChange={(e) => setDivForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDivOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitDividend} disabled={saveDividend.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
