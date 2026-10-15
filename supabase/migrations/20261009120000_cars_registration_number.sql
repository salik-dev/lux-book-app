-- Fleet vehicles are verified against the Statens vegvesen register by registration
-- number. Stored normalised (uppercase, no spaces/dashes, e.g. "EN10257") and unique,
-- so the same car can't be added to the fleet twice. Existing cars stay NULL until
-- they are next edited and verified.
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS registration_number TEXT;

ALTER TABLE public.cars
  DROP CONSTRAINT IF EXISTS cars_registration_number_format;
ALTER TABLE public.cars
  ADD CONSTRAINT cars_registration_number_format
  CHECK (registration_number IS NULL OR registration_number ~ '^[A-ZÆØÅ0-9]{2,7}$');

CREATE UNIQUE INDEX IF NOT EXISTS cars_registration_number_key
  ON public.cars (registration_number);
