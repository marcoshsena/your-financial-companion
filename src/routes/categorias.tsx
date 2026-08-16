import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState, ErrorState, LoadingRows, SectionCard } from "@/components/app/ui-bits";
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
  useCategories,
  useDeleteCategory,
  useSaveCategory,
  type Category,
  type CategoryInput,
} from "@/lib/finance-queries";

export const Route = createFileRoute("/categorias")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Categorias — Patrimônio" },
      {
        name: "description",
        content: "Organize suas receitas e despesas em categorias personalizadas com cores próprias.",
      },
      { property: "og:title", content: "Categorias — Patrimônio" },
      {
        property: "og:description",
        content: "Crie, edite e exclua categorias de receitas e despesas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoriasPage,
});

const empty = (): CategoryInput => ({ name: "", kind: "despesa", color: "#1E9E8A" });

function CategoriasPage() {
  const { userId, loading } = useRequireAuth();
  const enabled = Boolean(userId);
  const categories = useCategories(enabled);
  const save = useSaveCategory(userId);
  const remove = useDeleteCategory();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryInput>(empty());

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome da categoria."); return; }
    try {
      await save.mutateAsync({ ...(editing ? { id: editing.id } : {}), values: form });
      toast.success(editing ? "Categoria atualizada." : "Categoria criada.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    }
  };

  const del = async (row: Category) => {
    try {
      await remove.mutateAsync(row.id);
      toast.success("Categoria excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir.");
    }
  };

  const list = categories.data ?? [];
  const groups: Array<{ kind: "receita" | "despesa"; label: string }> = [
    { kind: "receita", label: "Receitas" },
    { kind: "despesa", label: "Despesas" },
  ];

  return (
    <AppShell
      title="Categorias"
      description="Padronize a classificação dos seus lançamentos"
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
      {categories.error ? <ErrorState error={categories.error} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <SectionCard key={group.kind} title={group.label}>
            {loading || categories.isLoading ? (
              <LoadingRows />
            ) : list.filter((c) => c.kind === group.kind).length === 0 ? (
              <EmptyState message="Nenhuma categoria aqui ainda." />
            ) : (
              <ul className="divide-border/70 divide-y">
                {list
                  .filter((c) => c.kind === group.kind)
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex min-w-0 items-center gap-3 text-sm">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-primary truncate font-medium">{c.name}</span>
                      </span>
                      <span className="shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar"
                          onClick={() => {
                            setEditing(c);
                            setForm({ name: c.name, kind: c.kind, color: c.color });
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir"
                          onClick={() => void del(c)}
                        >
                          <Trash2 className="text-negative size-4" />
                        </Button>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </SectionCard>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>Nome, tipo e cor de identificação.</DialogDescription>
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
                <Label>Tipo</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm((f) => ({ ...f, kind: v as "receita" | "despesa" }))}
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
                <Label>Cor</Label>
                <Input
                  type="color"
                  className="h-10 p-1"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
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
