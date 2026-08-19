-- Tracks the admin-initiated "extra kilometer charge" flow: an overage amount deducted
-- from the customer's deposit, invoiced via a dedicated Stripe Checkout link.
-- `extra_km_price` already exists (added in the initial schema) and is repurposed here
-- as the confirmed charge amount.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS extra_km_driven INTEGER,
  ADD COLUMN IF NOT EXISTS extra_km_charge_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS extra_km_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS extra_km_session_id TEXT,
  ADD COLUMN IF NOT EXISTS extra_km_charged_at TIMESTAMPTZ;

-- Snapshot of the car's deposit amount at booking time. Later overwritten with the
-- confirmed extra-km charge amount once an admin creates one (see create-extra-km-charge).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_deposit NUMERIC(10, 2);

-- Whether the extra-km-charge Stripe checkout has been paid (true = confirmed, the
-- default false = pending).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deposit_amount_status BOOLEAN DEFAULT false;

ALTER TABLE bookings
 ADD COLUMN IF NOT EXISTS demage_amount INTEGER;