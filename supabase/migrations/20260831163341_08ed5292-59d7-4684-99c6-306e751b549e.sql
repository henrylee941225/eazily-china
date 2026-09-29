CREATE OR REPLACE FUNCTION public.expire_authorised_holds_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://jraltaobsyrnoaeugkho.supabase.co/functions/v1/expire-authorised-holds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$function$;

SELECT cron.schedule(
  'expire-authorised-holds',
  '7 * * * *',
  $cron$ SELECT public.expire_authorised_holds_dispatch(); $cron$
);