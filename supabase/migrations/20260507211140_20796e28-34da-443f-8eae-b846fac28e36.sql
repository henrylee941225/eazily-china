-- Block all client writes to billing-sensitive tables. Service role bypasses RLS,
-- so edge functions / webhooks using the service role key continue to work.

CREATE POLICY "No client inserts" ON public.subscriptions FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No client updates" ON public.subscriptions FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes" ON public.subscriptions FOR DELETE TO authenticated, anon USING (false);

CREATE POLICY "No client inserts" ON public.trip_passes FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No client updates" ON public.trip_passes FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes" ON public.trip_passes FOR DELETE TO authenticated, anon USING (false);

CREATE POLICY "No client inserts" ON public.wallet_transactions FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No client updates" ON public.wallet_transactions FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes" ON public.wallet_transactions FOR DELETE TO authenticated, anon USING (false);