-- Records when the "contract completed" email (signed PDF to the customer + admin) was
-- sent, so concurrent syncs / webhook retries don't email the same contract twice.
--
-- Updating this column on a 'signed' row is permitted by booking_contracts_guard: the
-- immutability check only protects status, the PDF paths/hashes and the amount.
ALTER TABLE public.booking_contracts
  ADD COLUMN IF NOT EXISTS completed_notified_at TIMESTAMPTZ;
