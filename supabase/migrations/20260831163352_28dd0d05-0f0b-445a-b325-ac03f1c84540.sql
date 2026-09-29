REVOKE ALL ON FUNCTION public.expire_authorised_holds_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_authorised_holds_dispatch() TO postgres, service_role;