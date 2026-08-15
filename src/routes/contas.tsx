import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { useRequireAuth } from "@/hooks/use-session";
import {
  useAccounts,
  useDeleteAccount,
  useSaveAccount,
  type Account,
  type AccountInput,
} from "@/lib/finance-queries";
import { brl } from "@/lib/finance";

export const Route = createFileRoute("/contas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contas — Patrimônio" },
      {
        name: "description",
        content: "Cadastre contas correntes, poupança, carteiras e cartões e acompanhe seus saldos.",
      },
      { property: "og:title", content: "Contas — Patrimônio" },
      { property: "og:description", content: "Saldos consolidados de todas as suas contas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContasPage,
});

const TYPES = [
  { value: "conta_corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "carteira", label: "Carteira / dinheiro" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "investimento", label: "Investimento" },
];

const empty = (): AccountInput => ({
  name: "",
  institution: null,
  type: "conta_corrente",
  balance: 0,
  currency: "BRL",
});

function ContasPage() {
  const { userId, loading } = useRequireAuth();
  const enabled = Boolean(userId);
  const accounts = useAccounts(enabled);
  const save = useSaveAccount(userId);
  const remove = useDeleteAccount();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountInput>(empty());

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome da conta.");
    try {
      await save.mutateAsync({ ...(editing ? { id: editing.id } : {}), values: form });
      toast.success(editing ? "Conta atualizada." : "Conta criada.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    }
  };

  const del = async (row: Account) => {
    try {
      await remove.mutateAsync(row.id);
      toast.success("Conta excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir.");
    }
  };

  const list = accounts.data ?? [];
  const total = list.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <AppShell
      title="Contas"
      description="Contas manuais e contas importadas do Open Finance"
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setForm(empty());
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Nova
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Saldo total" value={brl(total)} loading={accounts.isLoading} />
        <StatCard label="Contas cadastradas" value={String(list.length)} />
        <StatCard
          label="Vindas do Open Finance"
          value={String(list.filter((a) => a.connection_id).length)}
        />
      </div>

      <SectionCard title="Minhas contas" className="mt-4">
        {accounts.error ? (
          <ErrorState error={accounts.error} />
        ) : loading || accounts.isLoading ? (
          <LoadingRows />
        ) : list.length === 0 ? (
          <EmptyState message="Nenhuma conta cadastrada ainda." />
        ) : (
          <ul className="divide-border/70 divide-y">
            {list.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-primary truncate text-sm font-medium">{a.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {TYPES.find((t) => t.value === a.type)?.label ?? a.type}
                    {a.institution ? ` · ${a.institution}` : ""}
                    {a.connection_id ? " · Open Finance" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="num text-primary text-sm font-medium">
                    {brl(Number(a.balance), a.currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar"
                    onClick={() => {
                      setEditing(a);
                      setForm({
                        name: a.name,
                        institution: a.institution,
                        type: a.type,
                        balance: Number(a.balance),
                        currency: a.currency,
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir"
                    onClick={() => void del(a)}
                  >
                    <Trash2 className="text-negative size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
            <DialogDescription>Dados básicos e saldo atual.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Instituição</Label>
                <Input
                  value={form.institution ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, institution: e.target.value || null }))
                  }
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Saldo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.balance}
                  onChange={(e) => setForm((f) => ({ ...f, balance: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Moeda</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
