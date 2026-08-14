-- Uniqueness guards (idempotent, no destructive changes)
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_kind_uidx
  ON public.categories (user_id, lower(name), kind);

CREATE UNIQUE INDEX IF NOT EXISTS bank_connections_user_item_uidx
  ON public.bank_connections (user_id, item_id);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_user_external_uidx
  ON public.accounts (user_id, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_external_uidx
  ON public.transactions (user_id, external_id) WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS investments_user_symbol_uidx
  ON public.investments (user_id, upper(symbol));

-- Performance indexes
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON public.transactions (user_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS transactions_category_idx ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS transactions_account_idx ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS accounts_user_idx ON public.accounts (user_id);
CREATE INDEX IF NOT EXISTS trades_user_investment_idx ON public.trades (user_id, investment_id, traded_on);
CREATE INDEX IF NOT EXISTS dividends_user_paid_idx ON public.dividends (user_id, paid_on DESC);
CREATE INDEX IF NOT EXISTS bank_connections_user_idx ON public.bank_connections (user_id);