import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type PluggyAccount = {
  id: string;
  name: string;
  type: string;
  subtype?: string | null;
  balance: number;
  currencyCode: string;
  itemId: string;
};

type PluggyTransaction = {
  id: string;
  description: string;
  descriptionRaw?: string | null;
  amount: number;
  date: string;
  category?: string | null;
};

type PluggyItem = {
  id: string;
  status: string;
  connector?: { name?: string } | null;
};

export const getPluggyStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { pluggyConfigured } = await import("./pluggy.server");
  return { configured: pluggyConfigured() };
});

export const createPluggyConnectToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ itemId: z.string().min(10).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { pluggyFetch } = await import("./pluggy.server");
    const json = await pluggyFetch<{ accessToken: string }>("/connect_token", {
      method: "POST",
      body: data.itemId ? { itemId: data.itemId } : {},
    });
    return { accessToken: json.accessToken };
  });

export const syncPluggyItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().min(10) }).parse(input))
  .handler(async ({ data, context }) => {
    const { pluggyFetch } = await import("./pluggy.server");
    const supabase = context.supabase;
    const userId = context.userId;

    const item = await pluggyFetch<PluggyItem>(`/items/${data.itemId}`);

    const { data: connection, error: connError } = await supabase
      .from("bank_connections")
      .upsert(
        {
          user_id: userId,
          provider: "pluggy",
          item_id: item.id,
          institution: item.connector?.name ?? "Instituição financeira",
          status: item.status,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,item_id" },
      )
      .select("id")
      .single();
    if (connError) throw new Error(connError.message);

    const accountsRes = await pluggyFetch<{ results: PluggyAccount[] }>(
      `/accounts?itemId=${item.id}`,
    );

    let importedTx = 0;
    for (const acc of accountsRes.results ?? []) {
      const { data: savedAccount, error: accError } = await supabase
        .from("accounts")
        .upsert(
          {
            user_id: userId,
            name: acc.name,
            type: acc.subtype ?? acc.type ?? "conta_corrente",
            institution: item.connector?.name ?? null,
            balance: acc.balance ?? 0,
            currency: acc.currencyCode ?? "BRL",
            connection_id: connection.id,
            external_id: acc.id,
          },
          { onConflict: "user_id,external_id" },
        )
        .select("id")
        .single();
      if (accError) throw new Error(accError.message);

      const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const txRes = await pluggyFetch<{ results: PluggyTransaction[] }>(
        `/transactions?accountId=${acc.id}&from=${from}&pageSize=500`,
      );
      const results = txRes.results ?? [];
      if (results.length === 0) continue;

      const { data: existing } = await supabase
        .from("transactions")
        .select("external_id")
        .eq("user_id", userId)
        .in(
          "external_id",
          results.map((t) => t.id),
        );
      const known = new Set((existing ?? []).map((row) => row.external_id));

      const rows = results
        .filter((t) => !known.has(t.id))
        .map((t) => ({
          user_id: userId,
          account_id: savedAccount.id,
          description: t.description || t.descriptionRaw || "Lançamento importado",
          amount: Math.abs(Number(t.amount ?? 0)),
          kind: Number(t.amount ?? 0) >= 0 ? ("receita" as const) : ("despesa" as const),
          occurred_on: (t.date ?? new Date().toISOString()).slice(0, 10),
          source: "pluggy",
          external_id: t.id,
          notes: t.category ? `Categoria Open Finance: ${t.category}` : null,
        }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from("transactions").insert(rows);
        if (insertError) throw new Error(insertError.message);
        importedTx += rows.length;
      }
    }

    return {
      institution: item.connector?.name ?? "Instituição financeira",
      accounts: accountsRes.results?.length ?? 0,
      importedTransactions: importedTx,
    };
  });