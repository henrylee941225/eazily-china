-- Wallet transactions: top-ups via Stripe and (optionally) merchant payments
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  type text NOT NULL DEFAULT 'topup',                 -- 'topup' | 'payment'
  status text NOT NULL DEFAULT 'pending',             -- 'pending' | 'succeeded' | 'failed'
  amount_cny_fen integer NOT NULL,                    -- credited amount in CNY fen (1 yuan = 100 fen)
  charge_amount integer,                              -- original charge amount (smallest unit of charge_currency)
  charge_currency text,                               -- e.g. 'gbp', 'usd', 'eur'
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_transactions_user_idx ON public.wallet_transactions (user_id, created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own transactions
CREATE POLICY "Users can view own transactions"
ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies for end users — only the service role
-- (used by edge functions / webhooks) can write. This prevents privilege
-- escalation where a client could grant themselves a top-up.

-- Keep updated_at fresh
CREATE TRIGGER update_wallet_transactions_updated_at
BEFORE UPDATE ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();