ALTER TABLE public.trip_passes
  ADD COLUMN IF NOT EXISTS charge_amount_cents integer,
  ADD COLUMN IF NOT EXISTS charge_currency text,
  ADD COLUMN IF NOT EXISTS quoted_gbp_cents integer,
  ADD COLUMN IF NOT EXISTS fx_rate_used numeric;

COMMENT ON COLUMN public.trip_passes.amount_paid_usd_cents IS
  'Legacy column name. Now stores the canonical GBP cents (9.99 → 999). Kept for backward compatibility.';
COMMENT ON COLUMN public.trip_passes.charge_amount_cents IS
  'Amount actually charged in charge_currency (minor units). Set by create-pass-checkout via fx-lock.';
COMMENT ON COLUMN public.trip_passes.charge_currency IS
  'ISO currency the Stripe session was created in (e.g. USD, EUR). Locked at checkout time.';
COMMENT ON COLUMN public.trip_passes.quoted_gbp_cents IS
  'Canonical GBP quoted price (999 = £9.99). Same as amount_paid_usd_cents but named consistently with concierge_tasks.';
COMMENT ON COLUMN public.trip_passes.fx_rate_used IS
  '1 GBP = fx_rate_used charge_currency, post-3% markup. 1 for GBP.';