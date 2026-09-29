
create table if not exists public.trip_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  purchased_at timestamptz not null default now(),
  trip_start_date date not null,
  trip_end_date date not null,
  days_total integer not null,
  days_billed integer not null,
  amount_paid_usd_cents integer not null,
  status text not null default 'pending',
  stripe_session_id text,
  stripe_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trip_passes_user_id on public.trip_passes(user_id);
create index if not exists idx_trip_passes_session on public.trip_passes(stripe_session_id);

alter table public.trip_passes enable row level security;

create policy "Users can view own trip passes"
  on public.trip_passes for select
  to authenticated
  using (auth.uid() = user_id);

create trigger trip_passes_updated_at
  before update on public.trip_passes
  for each row execute function public.update_updated_at_column();

-- Grace period: 48h after trip_pass_active_until
create or replace function public.has_ai_access(user_uuid uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = user_uuid
      and (
        (trip_pass_active_until is not null and trip_pass_active_until + interval '48 hours' > now())
        or (annual_active_until is not null and annual_active_until > now())
      )
  );
$$;
