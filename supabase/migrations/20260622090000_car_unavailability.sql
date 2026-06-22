-- =========================================================================
-- Car unavailability blocks
--
-- Lets admins mark a car as unavailable for a bounded time window directly
-- from the admin calendar (separate from the global `cars.is_available`
-- flag, which disables a car indefinitely until manually re-enabled).
--
-- Design mirrors the original schema (see 20250815100838_*.sql):
--   * public read  — so customer-facing availability checks can also honor
--     blocks later, consistent with `cars` being publicly readable
--   * admin write  — only active admin_users may create/modify/delete blocks
-- =========================================================================

create table if not exists public.car_unavailability (
  id             uuid primary key default gen_random_uuid(),
  car_id         uuid not null references public.cars(id) on delete cascade,
  start_datetime timestamptz not null,
  end_datetime   timestamptz not null,
  reason         text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.car_unavailability enable row level security;

-- Public read (matches "Cars are viewable by everyone")
drop policy if exists "Unavailability viewable by everyone" on public.car_unavailability;
create policy "Unavailability viewable by everyone" on public.car_unavailability
  for select using (true);

-- Admin write (matches "Only admins can modify cars")
drop policy if exists "Only admins manage unavailability" on public.car_unavailability;
create policy "Only admins manage unavailability" on public.car_unavailability
  for all using (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid() and is_active = true
    )
  );

create index if not exists idx_car_unavailability_car   on public.car_unavailability(car_id);
create index if not exists idx_car_unavailability_dates on public.car_unavailability(start_datetime, end_datetime);

create trigger update_car_unavailability_updated_at
  before update on public.car_unavailability
  for each row execute function public.update_updated_at_column();