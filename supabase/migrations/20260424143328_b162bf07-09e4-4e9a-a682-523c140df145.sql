ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS fee_cny_fen integer NOT NULL DEFAULT 0;

-- No CHECK constraint on type so we can use 'topup' or 'withdrawal' freely.
COMMENT ON COLUMN public.wallet_transactions.type IS
  'topup | withdrawal — withdrawal rows have a negative amount_cny_fen.';
COMMENT ON COLUMN public.wallet_transactions.fee_cny_fen IS
  'Fee charged for the transaction in CNY fen (always >= 0).';