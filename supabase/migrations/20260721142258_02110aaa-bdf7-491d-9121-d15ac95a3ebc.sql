CREATE OR REPLACE FUNCTION public.ops_pass_holders(user_ids uuid[])
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'concierge_assistant'::app_role) THEN
    RAISE EXCEPTION 'ops access required';
  END IF;
  RETURN QUERY
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.user_id = ANY(user_ids)
      AND (
        (p.trip_pass_active_until IS NOT NULL AND p.trip_pass_active_until > now())
        OR (p.annual_active_until IS NOT NULL AND p.annual_active_until > now())
      );
END;
$$;

REVOKE ALL ON FUNCTION public.ops_pass_holders(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_pass_holders(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_pass_holders(uuid[]) TO service_role;