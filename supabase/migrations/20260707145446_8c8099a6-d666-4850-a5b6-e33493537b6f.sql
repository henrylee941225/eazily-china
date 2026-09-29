-- update_updated_at_column: switch to SECURITY INVOKER (safe for triggers, silences linter)
ALTER FUNCTION public.update_updated_at_column() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- handle_new_user: keep DEFINER, ensure no client EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role: keep DEFINER, revoke anon+public, keep authenticated (needed by RLS policies)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- has_ai_access: keep DEFINER, revoke anon+authenticated+public, only service_role
REVOKE EXECUTE ON FUNCTION public.has_ai_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_ai_access(uuid) TO service_role;

-- concierge_tasks_guard_user_update: keep DEFINER, revoke all client EXECUTE (runs via trigger)
REVOKE EXECUTE ON FUNCTION public.concierge_tasks_guard_user_update() FROM PUBLIC, anon, authenticated;
