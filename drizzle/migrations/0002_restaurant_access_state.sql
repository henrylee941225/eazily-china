COMMENT ON COLUMN public.profiles.free_booking_used_at IS 'Free first booking is set aside: only accounts created before 2026-09-28 16:42 UTC that have not used it still qualify (see restaurant_access_state). Kept so the behaviour can be restored.';

CREATE OR REPLACE FUNCTION public.restaurant_access_state(user_uuid uuid)
RETURNS TABLE(has_pass boolean, free_booking_available boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> user_uuid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    EXISTS (SELECT 1 FROM public.booking_entitlement_state(user_uuid) s WHERE s.id IS NOT NULL),
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_uuid
        AND p.free_booking_used_at IS NULL
        AND p.created_at < '2026-09-28 16:42:00+00'::timestamptz
    );
END;
$$;

REVOKE ALL ON FUNCTION public.restaurant_access_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurant_access_state(uuid) TO authenticated, service_role;