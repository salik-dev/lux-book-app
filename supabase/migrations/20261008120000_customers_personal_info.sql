-- Store the split name and national ID number captured on the booking customer form.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS nin TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_nin ON public.customers(nin);
