-- =========================================================================
-- Admin "book on behalf" feature
--
-- Adds first-class support for bookings that an admin creates on behalf of
-- an already-verified customer (BankID verified + contract signed).
--
-- Design:
--   * A new `booking_channel` enum ('self' | 'admin') on `bookings`
--   * Optional `created_by_admin_id` and `admin_notes` on `bookings`
--   * A read-only view `v_admin_eligible_customers` — the single source of
--     truth for "who may be booked on behalf of"
--   * A SECURITY DEFINER RPC `admin_create_booking_on_behalf` that
--     atomically validates eligibility + car-time overlap, inserts the
--     booking, and writes an audit row. Only `service_role` (i.e. the
--     admin edge function) may execute it.
-- =========================================================================

-- 1. Enum for booking channel ---------------------------------------------
do $$
begin
  create type public.booking_channel as enum ('self', 'admin');
exception
  when duplicate_object then null;
end $$;

-- 2. Columns on bookings (nullable / defaulted, safe to apply live) -------
alter table public.bookings
  add column if not exists booking_channel     public.booking_channel not null default 'self',
  add column if not exists created_by_admin_id uuid references public.admin_users(id) on delete set null,
  add column if not exists admin_notes         text;

create index if not exists idx_bookings_created_by_admin on public.bookings(created_by_admin_id);
create index if not exists idx_bookings_channel          on public.bookings(booking_channel);

-- 3. View: eligible customers ---------------------------------------------
-- A customer is eligible for admin-initiated booking when they have:
--   * a customers row (PII + contact)
--   * a bankid_verifications row with contract_status = true
-- Exposes only the columns the admin UI actually needs. NIN is exposed as
-- its last 4 digits only (bv.nin stays in the DB).
create or replace view public.v_admin_eligible_customers as
select
  c.id                         as customer_id,
  c.full_name,
  c.email,
  c.phone,
  c.city,
  c.driver_license_number,
  c.driver_license_file_path,
  right(bv.nin, 4)             as nin_last4,
  bv.id                        as verification_id,
  bv.contract_signed_at,
  bv.contract_file_path,
  bv.verified_at,
  (select count(*) from public.bookings b where b.customer_id = c.id) as total_bookings,
  c.created_at                 as customer_created_at
from public.customers c
join public.bankid_verifications bv
  on bv.customer_id = c.id
where bv.contract_status = true;

comment on view public.v_admin_eligible_customers is
  'Customers eligible for admin-initiated bookings: BankID verified AND contract signed.';

-- 4. RPC: admin_create_booking_on_behalf ----------------------------------
create or replace function public.admin_create_booking_on_behalf(
  p_customer_id       uuid,
  p_car_id            uuid,
  p_start             timestamptz,
  p_end               timestamptz,
  p_pickup            text,
  p_delivery          text,
  p_delivery_fee      numeric,
  p_base_price        numeric,
  p_total_price       numeric,
  p_vat_amount        numeric,
  p_admin_user_id     uuid,
  p_admin_notes       text
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_booking_number text;
begin
  if p_end <= p_start then
    raise exception 'end_datetime must be after start_datetime' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.v_admin_eligible_customers
    where customer_id = p_customer_id
  ) then
    raise exception 'Customer % is not eligible (BankID + signed contract required)', p_customer_id
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.cars where id = p_car_id and is_available = true) then
    raise exception 'Car % is not available', p_car_id using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.car_id = p_car_id
      and b.status in ('pending', 'confirmed', 'active')
      and tstzrange(b.start_datetime, b.end_datetime, '[)')
          && tstzrange(p_start, p_end, '[)')
  ) then
    raise exception 'Car % is already booked in the requested window', p_car_id
      using errcode = 'P0003';
  end if;

  begin
    v_booking_number := public.generate_booking_number();
  exception when others then
    v_booking_number := 'FJB' || to_char(now() at time zone 'utc', 'YYMMDDHH24MISS')
                         || substr(md5(random()::text), 1, 4);
  end;

  insert into public.bookings (
    booking_number, customer_id, car_id,
    start_datetime, end_datetime,
    pickup_location, delivery_location, delivery_fee,
    base_price, total_price, vat_amount,
    status, booking_channel, created_by_admin_id, admin_notes
  )
  values (
    v_booking_number, p_customer_id, p_car_id,
    p_start, p_end,
    p_pickup, p_delivery, coalesce(p_delivery_fee, 0),
    p_base_price, p_total_price, p_vat_amount,
    'pending', 'admin', p_admin_user_id, p_admin_notes
  )
  returning * into v_booking;

  insert into public.audit_logs (table_name, record_id, action, new_values, changed_by)
  select
    'bookings',
    v_booking.id,
    'ADMIN_CREATE_ON_BEHALF',
    jsonb_build_object(
      'booking_id', v_booking.id,
      'customer_id', p_customer_id,
      'car_id', p_car_id,
      'admin_notes', p_admin_notes
    ),
    au.user_id
  from public.admin_users au
  where au.id = p_admin_user_id;

  return v_booking;
end;
$$;

revoke all on function public.admin_create_booking_on_behalf(
  uuid, uuid, timestamptz, timestamptz, text, text, numeric, numeric, numeric, numeric, uuid, text
) from public, anon, authenticated;

grant execute on function public.admin_create_booking_on_behalf(
  uuid, uuid, timestamptz, timestamptz, text, text, numeric, numeric, numeric, numeric, uuid, text
) to service_role;

-- 5. Grant read on the view to service_role (anon/authenticated do NOT
--    get direct access; the admin edge function uses service_role) -------
revoke all on public.v_admin_eligible_customers from public, anon, authenticated;
grant select on public.v_admin_eligible_customers to service_role;
