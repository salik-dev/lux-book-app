-- Persist the individual preference selections made in the booking form (previously only
-- the aggregate `decoration_require`/`with_driver` booleans were stored), so the booking
-- confirmation email and the admin booking preview can show which preferences were chosen.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS decoration_flowers BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS decoration_ribbon BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS decoration_red_carpets BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS decoration_driver_need BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS seat_pricing_mode TEXT DEFAULT 'flat-rate';
