-- Stop public listing of pick-images bucket. Public URLs still work via CDN.
DROP POLICY IF EXISTS "Public read access for pick-images" ON storage.objects;

-- Revoke direct EXECUTE on SECURITY DEFINER functions from client roles.
-- These are used as triggers / called by service role, not by clients.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_ai_access(uuid) FROM anon, authenticated;