-- Subscriptions table for Annual Pass
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_stripe_id on public.subscriptions(stripe_subscription_id);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

-- Trip Pass / Annual Pass entitlement timestamps on profiles
alter table public.profiles
  add column if not exists trip_pass_active_until timestamptz,
  add column if not exists annual_active_until timestamptz;

-- Helper: does this user have active AI access right now?
create or replace function public.has_ai_access(user_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = user_uuid
      and (
        (trip_pass_active_until is not null and trip_pass_active_until > now())
        or (annual_active_until is not null and annual_active_until > now())
      )
  );
$$;