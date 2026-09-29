// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
// Dispatcher for customer-facing transfer notifications.
//
// Every customer event key has a real send path. Dry-run is a single global
// switch (EMAIL_DRY_RUN, default false) used only for local testing, and a
// dry-run delivery is recorded as 'skipped' with last_error 'dry_run' — never
// as 'sent'. Only a real provider acceptance may set status 'sent'.
//
// Scheduled by pg_cron every minute.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import {
  notificationCopy,
  type NotificationEventKey,
} from '../_shared/notificationCopy.ts'
import { OPS_ONLY_STATUSES } from '../_shared/paymentPhase.ts'
import {
  reminderHtml,
  reminderSubject,
  reminderText,
  type ReminderKind,
  type ReminderPayload,
} from '../_shared/pickupReminderEmail.ts'
import { enqueueCustomerEmail } from '../_shared/customerEmail.ts'
import { notificationEmailHtml, notificationEmailText } from '../_shared/notificationEmail.ts'
import { sendOpsAlert } from '../_shared/ops-alert.ts'

const BATCH_SIZE = 50

// Push is parked: email only for now. The 'push' channel value and
// notification_preferences.push_enabled stay in the schema, and the push copy
// stays maintained in notificationCopy.ts — flip PUSH_ENABLED=true (plus a real
// send path) to switch the channel on without rework.
const PUSH_ENABLED = (Deno.env.get('PUSH_ENABLED') ?? 'false').toLowerCase() === 'true'

// Global testing switch only. Never per-key.
const dryRun = () => (Deno.env.get('EMAIL_DRY_RUN') ?? 'false').toLowerCase() === 'true'

const REMINDER_KEYS = ['pickup_reminder_24h', 'pickup_reminder_2h'] as const
const isReminder = (key: string): key is ReminderKind =>
  (REMINDER_KEYS as readonly string[]).includes(key)

// Every customer event key -> email_send_log template_name. This map IS the
// send-path registry: a key missing here has no send path.
const EMAIL_LABELS: Record<NotificationEventKey, string> = {
  payment_authorised: 'payment-authorised',
  payment_received: 'payment-received',
  driver_confirmed: 'driver-confirmed',
  change_confirmed: 'change-confirmed',
  booking_unavailable: 'booking-unavailable',
  payment_failed: 'payment-failed',
  booking_cancelled: 'booking-cancelled',
  hold_expiring_soon: 'hold-expiring-soon',
  pickup_reminder_24h: 'pickup-reminder-24h',
  pickup_reminder_2h: 'pickup-reminder-3h',
}

const HANDLED_KEYS = Object.keys(EMAIL_LABELS) as NotificationEventKey[]

// Startup assertion: every key notificationCopy.ts renders must have a send
// path. notificationCopy() throws/returns undefined for anything unknown, so
// asserting both directions catches drift in either file.
for (const key of HANDLED_KEYS) {
  const copy = notificationCopy(key, { taskId: 'boot-check' })
  if (!copy?.emailSubject) {
    throw new Error(`process-notification-events: no copy for handled key ${key}`)
  }
}
console.log('notification-events: handled event keys —', HANDLED_KEYS.join(', '), {
  email_dry_run: dryRun(),
  push_enabled: PUSH_ENABLED,
})

type EventRow = {
  id: string
  task_id: string
  user_id: string
  event_key: string
  from_status: string | null
  to_status: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

// deno-lint-ignore no-explicit-any
const upsertDelivery = async (supabase: any, row: Record<string, unknown>) => {
  const { error } = await supabase
    .from('notification_deliveries')
    .upsert(row, { onConflict: 'event_id,channel' })
  if (error) console.error('notification-events: delivery upsert failed', { row, error })
}

// Real email delivery for every customer event key. Pickup reminders render
// the fully self-contained reminder layout (the traveller may be on a mainland
// network with no way to open the app); everything else uses the branded
// copy-driven template.
const deliverEmail = async (
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ev: EventRow,
  // deno-lint-ignore no-explicit-any
  copy: any,
  label: string,
): Promise<boolean> => {
  const fail = async (reason: string) => {
    console.error('notification-events: email failed', { id: ev.id, key: ev.event_key, reason })
    await upsertDelivery(supabase, {
      event_id: ev.id,
      channel: 'email',
      status: 'failed',
      attempts: 1,
      last_error: reason.slice(0, 500),
    })
    return false
  }

  const { data: userRes, error: userError } = await supabase.auth.admin.getUserById(ev.user_id)
  const to = userRes?.user?.email as string | undefined
  if (userError || !to) return await fail(`no_recipient_email:${userError?.message ?? 'unknown'}`)

  const payload = (ev.payload ?? {}) as Record<string, unknown>
  const ref = (payload.booking_reference as string | null) ?? null

  // The reminder CTA deep-links to the booking, so the task id travels with
  // the payload the renderer sees.
  const reminderPayload = { ...payload, task_id: ev.task_id } as ReminderPayload

  const subject = isReminder(ev.event_key)
    ? reminderSubject(ev.event_key, reminderPayload)
    : copy.emailSubject
  const html = isReminder(ev.event_key)
    ? reminderHtml(ev.event_key, reminderPayload)
    : notificationEmailHtml(copy, ref)
  const text = isReminder(ev.event_key)
    ? reminderText(ev.event_key, reminderPayload)
    : notificationEmailText(copy, ref)

  if (dryRun()) {
    console.log('notification-events: DRY RUN, nothing sent', {
      event_id: ev.id,
      event_key: ev.event_key,
      to,
      subject,
    })
    await upsertDelivery(supabase, {
      event_id: ev.id,
      channel: 'email',
      status: 'skipped',
      attempts: 0,
      last_error: 'dry_run',
    })
    return true
  }

  const result = await enqueueCustomerEmail(supabase, {
    to,
    subject,
    html,
    text,
    label,
    idempotencyKey: `notif-${ev.id}-email`,
  })
  if (!result.ok) return await fail(result.error)

  await upsertDelivery(supabase, {
    event_id: ev.id,
    channel: 'email',
    status: 'sent',
    attempts: 1,
    sent_at: new Date().toISOString(),
    provider_message_id: result.messageId,
  })
  return true
}

Deno.serve(withCors(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const isDryRun = dryRun()
  console.log('notification-events: run start', {
    email_dry_run: isDryRun,
    push_enabled: PUSH_ENABLED,
    handled_keys: HANDLED_KEYS.length,
  })

  const { data: events, error } = await supabase
    .from('notification_events')
    .select('id, task_id, user_id, event_key, from_status, to_status, payload, created_at')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('notification-events: read failed', error)
    return new Response(JSON.stringify({ error: 'read_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let processed = 0
  let skipped = 0
  let sent = 0
  let failed = 0

  for (const ev of (events ?? []) as EventRow[]) {
    const payload = ev.payload ?? {}
    const category = String(payload.category ?? '')
    const stamp = async () => {
      const { error: stampError } = await supabase
        .from('notification_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', ev.id)
      if (stampError) console.error('notification-events: stamp failed', { id: ev.id, stampError })
    }

    // Transfers only in this step; ops-only statuses never notify the traveller.
    if (category !== 'transfer' || OPS_ONLY_STATUSES.includes(String(ev.to_status ?? ''))) {
      await upsertDelivery(supabase, { event_id: ev.id, channel: 'inapp', status: 'skipped' })
      await stamp()
      skipped++
      continue
    }

    const label = EMAIL_LABELS[ev.event_key as NotificationEventKey]
    const copy = label
      ? notificationCopy(ev.event_key as NotificationEventKey, { taskId: ev.task_id })
      : null

    // No send path: fail loudly, never silently.
    if (!label || !copy) {
      console.error('notification-events: no send path', { id: ev.id, event_key: ev.event_key })
      await upsertDelivery(supabase, {
        event_id: ev.id,
        channel: 'email',
        status: 'failed',
        attempts: 1,
        last_error: `no_send_path:${ev.event_key}`,
      })
      sendOpsAlert({
        event: 'notification_no_send_path',
        subject: `Notification has no send path: ${ev.event_key}`,
        headline: 'Notification not delivered',
        intro: 'The dispatcher met an event key with no send path. No customer email was sent.',
        lines: [
          { label: 'Event key', value: ev.event_key },
          { label: 'Event id', value: ev.id },
          { label: 'Task', value: ev.task_id },
        ],
        taskId: ev.task_id,
        category: category || null,
      })
      await stamp()
      failed++
      continue
    }

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('email_enabled, push_enabled, locale')
      .eq('user_id', ev.user_id)
      .maybeSingle()

    const emailEnabled = prefs?.email_enabled ?? true
    const pushEnabled = prefs?.push_enabled ?? true

    const channels: { channel: 'email' | 'push' | 'inapp'; enabled: boolean }[] = [
      { channel: 'email', enabled: emailEnabled },
      // While PUSH_ENABLED is false no 'push' delivery row is created at all.
      ...(PUSH_ENABLED ? [{ channel: 'push' as const, enabled: pushEnabled }] : []),
      { channel: 'inapp', enabled: true },
    ]

    for (const { channel, enabled } of channels) {
      if (!enabled) {
        await upsertDelivery(supabase, {
          event_id: ev.id,
          channel,
          status: 'skipped',
          last_error: 'channel_disabled',
        })
        continue
      }

      if (channel === 'email') {
        const ok = await deliverEmail(supabase, ev, copy, label)
        if (ok) sent++
        else failed++
        continue
      }

      if (channel === 'inapp') {
        // In-app is read straight from notification_events by the app; the
        // delivery row records that the event was surfaced.
        await upsertDelivery(supabase, {
          event_id: ev.id,
          channel: 'inapp',
          status: 'sent',
          attempts: 1,
          sent_at: new Date().toISOString(),
        })
        continue
      }

      // Push has no send path yet and is gated off above; if it is ever
      // enabled without a sender, record that rather than pretending success.
      await upsertDelivery(supabase, {
        event_id: ev.id,
        channel,
        status: 'failed',
        attempts: 1,
        last_error: 'no_send_path:push',
      })
      failed++
    }

    await stamp()
    processed++
  }

  return new Response(
    JSON.stringify({ processed, skipped, emails_sent: sent, failures: failed, email_dry_run: isDryRun }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}))
