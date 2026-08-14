import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Account = Tables["accounts"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Transaction = Tables["transactions"]["Row"];
export type Investment = Tables["investments"]["Row"];
export type Trade = Tables["trades"]["Row"];
export type Dividend = Tables["dividends"]["Row"];
export type BankConnection = Tables["bank_connections"]["Row"];
export type Profile = Tables["profiles"]["Row"];

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export type TransactionFilters = {
  from?: string;
  to?: string;
  kind?: "receita" | "despesa" | "todos";
  categoryId?: string | "todas";
  accountId?: string | "todas";
  search?: string;
};

export const financeKeys = {
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  connections: ["bank_connections"] as const,
  transactions: (filters?: TransactionFilters) => ["transactions", filters ?? {}] as const,
  investments: ["investments"] as const,
  trades: ["trades"] as const,
  dividends: ["dividends"] as const,
  profile: ["profile"] as const,
};

/* ---------------------------------- reads --------------------------------- */

export function useAccounts(enabled = true) {
  return useQuery({
    queryKey: financeKeys.accounts,
    enabled,
    queryFn: async () =>
      unwrap<Account[]>(
        await supabase.from("accounts").select("*").order("name", { ascending: true }),
      ),
  });
}

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: financeKeys.categories,
    enabled,
    queryFn: async () =>
      unwrap<Category[]>(
        await supabase.from("categories").select("*").order("name", { ascending: true }),
      ),
  });
}

export function useConnections(enabled = true) {
  return useQuery({
    queryKey: financeKeys.connections,
    enabled,
    queryFn: async () =>
      unwrap<BankConnection[]>(
        await supabase.from("bank_connections").select("*").order("created_at", { ascending: false }),
      ),
  });
}

export function useTransactions(filters: TransactionFilters = {}, enabled = true) {
  return useQuery({
    queryKey: financeKeys.transactions(filters),
    enabled,
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select("*")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);

      if (filters.from) query = query.gte("occurred_on", filters.from);
      if (filters.to) query = query.lte("occurred_on", filters.to);
      if (filters.kind && filters.kind !== "todos") query = query.eq("kind", filters.kind);
      if (filters.categoryId && filters.categoryId !== "todas")
        query = query.eq("category_id", filters.categoryId);
      if (filters.accountId && filters.accountId !== "todas")
        query = query.eq("account_id", filters.accountId);
      if (filters.search?.trim()) query = query.ilike("description", `%${filters.search.trim()}%`);

      return unwrap<Transaction[]>(await query);
    },
  });
}

export function useInvestments(enabled = true) {
  return useQuery({
    queryKey: financeKeys.investments,
    enabled,
    queryFn: async () =>
      unwrap<Investment[]>(
        await supabase.from("investments").select("*").order("symbol", { ascending: true }),
      ),
  });
}

export function useTrades(enabled = true) {
  return useQuery({
    queryKey: financeKeys.trades,
    enabled,
    queryFn: async () =>
      unwrap<Trade[]>(
        await supabase.from("trades").select("*").order("traded_on", { ascending: false }),
      ),
  });
}

export function useDividends(enabled = true) {
  return useQuery({
    queryKey: financeKeys.dividends,
    enabled,
    queryFn: async () =>
      unwrap<Dividend[]>(
        await supabase.from("dividends").select("*").order("paid_on", { ascending: false }),
      ),
  });
}

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: financeKeys.profile,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidate(keys: readonly unknown[][]) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
  };
}

export type TransactionInput = {
  description: string;
  amount: number;
  kind: "receita" | "despesa";
  occurred_on: string;
  category_id: string | null;
  account_id: string | null;
  notes: string | null;
};

export function useSaveTransaction(userId: string | null) {
  const invalidate = useInvalidate([["transactions"], ["accounts"]]);
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: TransactionInput }) => {
      if (id) {
        const { error } = await supabase.from("transactions").update(values).eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase
        .from("transactions")
        .insert({ ...values, user_id: userId, source: "manual" });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidate([["transactions"]]);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export type CategoryInput = { name: string; kind: "receita" | "despesa"; color: string };

export function useSaveCategory(userId: string | null) {
  const invalidate = useInvalidate([["categories"], ["transactions"]]);
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: CategoryInput }) => {
      if (id) {
        const { error } = await supabase.from("categories").update(values).eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("categories").insert({ ...values, user_id: userId });
      if (error) {
        throw new Error(
          error.code === "23505" || error.message.includes("duplicate")
            ? "Você já tem uma categoria com esse nome e tipo."
            : error.message,
        );
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate([["categories"]]);
  return useMutation({
    mutationFn: async (id: string) => {
      const { count, error: countError } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id);
      if (countError) throw new Error(countError.message);
      if ((count ?? 0) > 0)
        throw new Error(
          `Esta categoria está em uso por ${count} lançamento(s). Altere-os antes de excluir.`,
        );
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export type AccountInput = {
  name: string;
  institution: string | null;
  type: string;
  balance: number;
  currency: string;
};

export function useSaveAccount(userId: string | null) {
  const invalidate = useInvalidate([["accounts"]]);
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: AccountInput }) => {
      if (id) {
        const { error } = await supabase.from("accounts").update(values).eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("accounts").insert({ ...values, user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidate([["accounts"], ["transactions"]]);
  return useMutation({
    mutationFn: async (id: string) => {
      const { count, error: countError } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("account_id", id);
      if (countError) throw new Error(countError.message);
      if ((count ?? 0) > 0)
        throw new Error(
          `Esta conta possui ${count} lançamento(s) vinculado(s). Remova ou realoque antes de excluir.`,
        );
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export type InvestmentInput = {
  symbol: string;
  name: string | null;
  asset_class: Database["public"]["Enums"]["asset_class"];
  currency: string;
};

export function useSaveInvestment(userId: string | null) {
  const invalidate = useInvalidate([["investments"]]);
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: InvestmentInput }) => {
      const payload = { ...values, symbol: values.symbol.trim().toUpperCase() };
      if (id) {
        const { error } = await supabase.from("investments").update(payload).eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("investments").insert({ ...payload, user_id: userId });
      if (error) {
        throw new Error(
          error.message.includes("duplicate")
            ? "Este ativo já está cadastrado na sua carteira."
            : error.message,
        );
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteInvestment() {
  const invalidate = useInvalidate([["investments"], ["trades"], ["dividends"]]);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: tradesError } = await supabase.from("trades").delete().eq("investment_id", id);
      if (tradesError) throw new Error(tradesError.message);
      const { error: divError } = await supabase.from("dividends").delete().eq("investment_id", id);
      if (divError) throw new Error(divError.message);
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export type TradeInput = {
  investment_id: string;
  side: "compra" | "venda";
  quantity: number;
  price: number;
  fees: number;
  traded_on: string;
  notes: string | null;
};

export function useSaveTrade(userId: string | null) {
  const invalidate = useInvalidate([["trades"]]);
  return useMutation({
    mutationFn: async (values: TradeInput) => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("trades").insert({ ...values, user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTrade() {
  const invalidate = useInvalidate([["trades"]]);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trades").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export type DividendInput = {
  investment_id: string;
  amount: number;
  kind: string;
  paid_on: string;
};

export function useSaveDividend(userId: string | null) {
  const invalidate = useInvalidate([["dividends"]]);
  return useMutation({
    mutationFn: async (values: DividendInput) => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("dividends").insert({ ...values, user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteDividend() {
  const invalidate = useInvalidate([["dividends"]]);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dividends").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}
