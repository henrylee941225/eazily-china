REVOKE EXECUTE ON FUNCTION public.booking_entitlement_state(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_booking_allowance(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.booking_entitlement_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_booking_allowance(uuid) TO service_role;