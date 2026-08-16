import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState, ErrorState, LoadingRows, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRequireAuth } from "@/hooks/use-session";
import { useConnections } from "@/lib/finance-queries";
import { supabase } from "@/integrations/supabase/client";
import { createPluggyConnectToken, getPluggyStatus, syncPluggyItem } from "@/lib/pluggy.functions";
import { dateBR } from "@/lib/finance";

export const Route = createFileRoute("/conexoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Open Finance — Patrimônio" },
      {
        name: "description",
        content:
          "Conecte suas contas bancárias via Open Finance e sincronize saldos e lançamentos automaticamente.",
      },
      { property: "og:title", content: "Open Finance — Patrimônio" },
      {
        property: "og:description",
        content: "Conexões bancárias seguras com sincronização automática de contas e lançamentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConexoesPage,
});

const PLUGGY_SCRIPT = "https://cdn.pluggy.ai/pluggy-connect/v2.9.2/pluggy-connect.js";

type PluggyConnectCtor = new (options: {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess?: (data: { item: { id: string } }) => void;
  onError?: (error: unknown) => void;
}) => { init: () => void };

function loadPluggyScript() {
  return new Promise<PluggyConnectCtor>((resolve, reject) => {
    const existing = (window as unknown as { PluggyConnect?: PluggyConnectCtor }).PluggyConnect;
    if (existing) return resolve(existing);
    const script = document.createElement("script");
    script.src = PLUGGY_SCRIPT;
    script.async = true;
    script.onload = () => {
      const ctor = (window as unknown as { PluggyConnect?: PluggyConnectCtor }).PluggyConnect;
      if (ctor) resolve(ctor);
      else reject(new Error("Widget do Open Finance indisponível."));
    };
    script.onerror = () => reject(new Error("Não foi possível carregar o widget do Open Finance."));
    document.head.appendChild(script);
  });
}

function ConexoesPage() {
  const { userId, loading } = useRequireAuth();
  const enabled = Boolean(userId);
  const connections = useConnections(enabled);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["pluggy-status"],
    queryFn: () => getPluggyStatus(),
  });

  const refreshAll = () => {
    for (const key of [["connections"], ["accounts"], ["transactions"]]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const sync = async (itemId: string) => {
    setBusy(itemId);
    try {
      const result = await syncPluggyItem({ data: { itemId } });
      toast.success(
        `${result.institution}: ${result.accounts} conta(s) e ${result.importedTransactions} novo(s) lançamento(s).`,
      );
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao sincronizar.");
    } finally {
      setBusy(null);
    }
  };

  const connect = async (itemId?: string) => {
    setBusy(itemId ?? "new");
    try {
      const [{ accessToken }, PluggyConnect] = await Promise.all([
        createPluggyConnectToken({ data: itemId ? { itemId } : {} }),
        loadPluggyScript(),
      ]);
      const widget = new PluggyConnect({
        connectToken: accessToken,
        includeSandbox: false,
        onSuccess: (data) => {
          void sync(data.item.id);
        },
        onError: () => toast.error("Conexão não concluída."),
      });
      widget.init();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir o Open Finance.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (id: string) => {
    try {
      const { error } = await supabase.from("bank_connections").delete().eq("id", id);
      if (error) throw new Error(error.message);
      toast.success("Conexão removida. As contas e lançamentos importados foram mantidos.");
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover conexão.");
    }
  };

  const rows = connections.data ?? [];
  const configured = status.data?.configured ?? false;

  return (
    <AppShell
      title="Open Finance"
      description="Conecte suas instituições e mantenha saldos e lançamentos sempre atualizados."
      actions={
        <Button size="sm" onClick={() => connect()} disabled={!configured || busy === "new"}>
          <Link2 className="size-4" /> Conectar conta
        </Button>
      }
    >
      {connections.error ? <ErrorState error={connections.error} /> : null}

      {!status.isLoading && !configured ? (
        <div className="surface border-negative/30 mb-4 p-4">
          <p className="text-primary text-sm font-medium">Integração pendente de configuração</p>
          <p className="text-muted-foreground mt-1 text-sm">
            As credenciais do provedor de Open Finance ainda não estão cadastradas no backend do
            projeto. Assim que forem adicionadas, o botão de conexão fica disponível.
          </p>
        </div>
      ) : null}

      <SectionCard title="Instituições conectadas">
        {loading || connections.isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState message="Nenhuma instituição conectada ainda." />
        ) : (
          <ul className="divide-border/70 divide-y">
            {rows.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-primary flex items-center gap-2 font-medium">
                    {c.institution ?? "Instituição"}
                    <Badge variant="secondary">{c.status ?? "—"}</Badge>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Última sincronização:{" "}
                    {c.last_synced_at ? dateBR(c.last_synced_at.slice(0, 10)) : "nunca"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sync(c.item_id)}
                    disabled={busy === c.item_id}
                  >
                    <RefreshCw className="size-4" /> Sincronizar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => connect(c.item_id)}>
                    Reconectar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover conexão"
                    onClick={() => disconnect(c.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Como funciona" className="mt-4">
        <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
          <li>Clique em “Conectar conta” e escolha sua instituição financeira.</li>
          <li>Autorize o compartilhamento de dados no ambiente seguro do banco.</li>
          <li>
            As contas e os lançamentos dos últimos 12 meses são importados e classificados como
            Open Finance.
          </li>
          <li>Use “Sincronizar” para trazer novos lançamentos sem duplicar os já importados.</li>
        </ol>
      </SectionCard>
    </AppShell>
  );
}
