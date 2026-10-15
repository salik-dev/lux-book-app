-- Adds an optional monthly rental rate to vehicles.
--
-- Nullable on purpose: existing cars have no monthly price, and the "Per month" pricing
-- option (customer booking + admin book-on-behalf) is only offered for cars where this is
-- set to a positive amount. Shares the DECIMAL(10,2) shape of the hourly/daily rates.
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS base_price_per_month DECIMAL(10,2);

COMMENT ON COLUMN public.cars.base_price_per_month IS
  'Optional monthly rental rate (NOK). NULL / 0 means the vehicle is not offered on a per-month basis.';
