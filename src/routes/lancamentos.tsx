import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState, ErrorState, LoadingRows, SectionCard, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useRequireAuth } from "@/hooks/use-session";
import {
  useAccounts,
  useCategories,
  useDeleteTransaction,
  useSaveTransaction,
  useTransactions,
  type Transaction,
  type TransactionInput,
} from "@/lib/finance-queries";
import { brl, dateBR, monthKey, monthRange } from "@/lib/finance";

export const Route = createFileRoute("/lancamentos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lançamentos — Patrimônio" },
      {
        name: "description",
        content:
          "Cadastre, edite, categorize e filtre receitas e despesas manuais ou importadas do Open Finance.",
      },
      { property: "og:title", content: "Lançamentos — Patrimônio" },
      {
        property: "og:description",
        content: "Controle total das suas entradas e saídas, com filtros por período e categoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LancamentosPage,
});

const emptyForm = (): TransactionInput => ({
  description: "",
  amount: 0,
  kind: "despesa",
  occurred_on: new Date().toISOString().slice(0, 10),
  category_id: null,
  account_id: null,
  notes: null,
});

function LancamentosPage() {
  const { userId, loading } = useRequireAuth();
  const enabled = Boolean(userId);

  const thisMonth = monthKey(new Date());
  const [from, setFrom] = useState(monthRange(thisMonth).start);
  const [to, setTo] = useState(monthRange(thisMonth).end);
  const [kind, setKind] = useState<"todos" | "receita" | "despesa">("todos");
  const [categoryId, setCategoryId] = useState<string>("todas");
  const [accountId, setAccountId] = useState<string>("todas");
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => ({ from, to, kind, categoryId, accountId, search }),
    [from, to, kind, categoryId, accountId, search],
  );

  const tx = useTransactions(filters, enabled);
  const categories = useCategories(enabled);
  const accounts = useAccounts(enabled);
  const save = useSaveTransaction(userId);
  const remove = useDeleteTransaction();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionInput>(emptyForm());

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (row: Transaction) => {
    setEditing(row);
    setForm({
      description: row.description,
      amount: Number(row.amount),
      kind: row.kind,
      occurred_on: row.occurred_on,
      category_id: row.category_id,
      account_id: row.account_id,
      notes: row.notes,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.description.trim()) return toast.error("Informe a descrição.");
    if (!(form.amount > 0)) return toast.error("Informe um valor maior que zero.");
    try {
      await save.mutateAsync({ ...(editing ? { id: editing.id } : {}), values: form });
      toast.success(editing ? "Lançamento atualizado." : "Lançamento criado.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    }
  };

  const del = async (row: Transaction) => {
    try {
      await remove.mutateAsync(row.id);
      toast.success("Lançamento excluído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir.");
    }
  };

  const rows = tx.data ?? [];
  const receitas = rows.filter((r) => r.kind === "receita").reduce((s, r) => s + Number(r.amount), 0);
  const despesas = rows.filter((r) => r.kind === "despesa").reduce((s, r) => s + Number(r.amount), 0);
  const categoryOptions = (categories.data ?? []).filter((c) => c.kind === form.kind);

  return (
    <AppShell
      title="Lançamentos"
      description="Receitas e despesas manuais e importadas"
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" /> Novo
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Receitas no filtro" value={brl(receitas)} tone="positive" />
        <StatCard label="Despesas no filtro" value={brl(despesas)} tone="negative" />
        <StatCard
          label="Resultado"
          value={brl(receitas - despesas)}
          tone={receitas - despesas >= 0 ? "positive" : "negative"}
          hint={`${rows.length} lançamento(s)`}
        />
      </div>

      <SectionCard title="Filtros" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="receita">Receitas</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(accounts.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Buscar descrição</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex.: mercado" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Lista" className="mt-4">
        {tx.error ? (
          <ErrorState error={tx.error} />
        ) : loading || tx.isLoading ? (
          <LoadingRows rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            message="Nenhum lançamento no período."
            action={
              <Button size="sm" onClick={openNew}>
                Criar lançamento
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs uppercase">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Data</th>
                  <th className="px-2 py-2 text-left font-medium">Descrição</th>
                  <th className="px-2 py-2 text-left font-medium">Categoria</th>
                  <th className="px-2 py-2 text-left font-medium">Conta</th>
                  <th className="px-2 py-2 text-right font-medium">Valor</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-border/70 divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num px-2 py-2 whitespace-nowrap">{dateBR(r.occurred_on)}</td>
                    <td className="px-2 py-2">
                      <span className="text-primary font-medium">{r.description}</span>
                      {r.source === "pluggy" ? (
                        <span className="text-muted-foreground ml-2 text-xs">Open Finance</span>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-2 py-2">
                      {(categories.data ?? []).find((c) => c.id === r.category_id)?.name ?? "—"}
                    </td>
                    <td className="text-muted-foreground px-2 py-2">
                      {(accounts.data ?? []).find((a) => a.id === r.account_id)?.name ?? "—"}
                    </td>
                    <td
                      className={
                        r.kind === "receita"
                          ? "num text-positive px-2 py-2 text-right"
                          : "num text-negative px-2 py-2 text-right"
                      }
                    >
                      {r.kind === "receita" ? "+" : "-"}
                      {brl(Number(r.amount))}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir"
                        onClick={() => void del(r)}
                      >
                        <Trash2 className="text-negative size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
            <DialogDescription>
              Descreva a movimentação, escolha o tipo e a categoria.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, kind: v as "receita" | "despesa", category_id: null }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.occurred_on}
                  onChange={(e) => setForm((f) => ({ ...f, occurred_on: e.target.value }))}
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={form.category_id ?? "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "none" ? null : v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Conta</Label>
              <Select
                value={form.account_id ?? "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, account_id: v === "none" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem conta</SelectItem>
                  {(accounts.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
