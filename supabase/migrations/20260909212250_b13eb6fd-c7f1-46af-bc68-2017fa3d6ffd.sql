CREATE TABLE public.ai_usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  cost_units integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client reads" ON public.ai_usage_events FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "No client inserts" ON public.ai_usage_events FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No client updates" ON public.ai_usage_events FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "No client deletes" ON public.ai_usage_events FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX ai_usage_events_user_created_idx ON public.ai_usage_events (user_id, created_at DESC);
CREATE INDEX ai_usage_events_user_fn_created_idx ON public.ai_usage_events (user_id, function_name, created_at DESC);

-- Atomic rate-limit + daily-spend check. Counts the caller's usage inside the
-- rolling windows and, when both ceilings allow it, records the call. Returns
-- the decision plus the counters so the edge function can log/alert.
CREATE OR REPLACE FUNCTION public.ai_rate_check(
  _user_id uuid,
  _function_name text,
  _hourly_limit integer,
  _cost_units integer,
  _daily_unit_cap integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hourly_count integer;
  v_daily_units integer;
  v_oldest timestamptz;
  v_retry integer;
BEGIN
  SELECT count(*), min(created_at)
    INTO v_hourly_count, v_oldest
    FROM public.ai_usage_events
   WHERE user_id = _user_id
     AND function_name = _function_name
     AND created_at > now() - interval '1 hour';

  SELECT COALESCE(sum(cost_units), 0)
    INTO v_daily_units
    FROM public.ai_usage_events
   WHERE user_id = _user_id
     AND created_at > now() - interval '24 hours';

  IF _hourly_limit > 0 AND v_hourly_count >= _hourly_limit THEN
    v_retry := GREATEST(
      1,
      CEIL(EXTRACT(epoch FROM (v_oldest + interval '1 hour' - now())))::integer
    );
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'hourly',
      'hourly_count', v_hourly_count, 'hourly_limit', _hourly_limit,
      'daily_units', v_daily_units, 'daily_unit_cap', _daily_unit_cap,
      'retry_after_seconds', v_retry
    );
  END IF;

  IF _daily_unit_cap > 0 AND v_daily_units + _cost_units > _daily_unit_cap THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'daily',
      'hourly_count', v_hourly_count, 'hourly_limit', _hourly_limit,
      'daily_units', v_daily_units, 'daily_unit_cap', _daily_unit_cap,
      'retry_after_seconds', 3600
    );
  END IF;

  INSERT INTO public.ai_usage_events (user_id, function_name, cost_units)
  VALUES (_user_id, _function_name, GREATEST(1, _cost_units));

  RETURN jsonb_build_object(
    'allowed', true, 'reason', null,
    'hourly_count', v_hourly_count + 1, 'hourly_limit', _hourly_limit,
    'daily_units', v_daily_units + _cost_units, 'daily_unit_cap', _daily_unit_cap,
    'retry_after_seconds', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_rate_check(uuid, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_rate_check(uuid, text, integer, integer, integer) TO service_role;