-- Guest checkout: bookings created by `create-booking` are authorised with a secret
-- key held by the customer's browser. Only the SHA-256 hash of the key is stored.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS access_key_hash TEXT;
