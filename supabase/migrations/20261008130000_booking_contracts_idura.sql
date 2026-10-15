-- Idura digital-signature contracts for customer bookings.
--
-- Flow: create-booking (server-priced, status 'pending') -> idura-contract-create
-- (PDF + Idura signature order) -> renter signs (payment unlocks) -> broker signs
-- -> order closed, signed PDF stored -> status 'signed'.
--
-- All reads/writes go through edge functions using the service role; customers have
-- no direct table access. Admins can read for back-office purposes.

-- ---------------------------------------------------------------------------
-- Bookings: idempotency key for server-side creation
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_request_id UUID,
  -- Online bookings hold the car only for a limited time until paid. NULL (legacy and
  -- admin bookings) keeps the previous behaviour: a pending booking always blocks.
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_client_request_id_unique
  ON public.bookings (client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Bookings are now created exclusively by the `create-booking` edge function, which
-- computes the price server-side. Allowing direct inserts would let a client choose
-- its own total_price.
DROP POLICY IF EXISTS "Customers can create bookings" ON public.bookings;

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN (
      'generating',         -- row reserved, PDF/order being created
      'signature_pending',  -- waiting for the renter
      'renter_signed',      -- renter signed; waiting for the broker (payment allowed)
      'signed',             -- all parties signed; signed PDF stored
      'rejected',
      'expired',
      'failed'
    )),
  idura_signature_order_id TEXT UNIQUE,
  idura_document_id TEXT,
  renter_signatory_id TEXT,
  broker_signatory_id TEXT,
  -- Snapshot of what was printed on the contract, for audit/reconciliation.
  contract_amount NUMERIC(10, 2) NOT NULL,
  unsigned_pdf_path TEXT,
  unsigned_pdf_sha256 TEXT,
  signed_pdf_path TEXT,
  signed_pdf_sha256 TEXT,
  renter_signed_at TIMESTAMPTZ,
  broker_signed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  broker_notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  -- Internal error code only (never raw provider responses or personal data).
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one live contract per booking. Failed/expired/rejected rows are kept for
-- audit and a new attempt may then be created.
CREATE UNIQUE INDEX IF NOT EXISTS booking_contracts_one_active_per_booking
  ON public.booking_contracts (booking_id)
  WHERE status IN ('generating', 'signature_pending', 'renter_signed', 'signed');

CREATE INDEX IF NOT EXISTS booking_contracts_booking_id_idx
  ON public.booking_contracts (booking_id, created_at DESC);

ALTER TABLE public.booking_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view booking contracts" ON public.booking_contracts;
CREATE POLICY "Admins can view booking contracts" ON public.booking_contracts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- A signed contract is final: its status and signed document can never change, and
-- the row can't be deleted. Status may also never move backwards out of a terminal
-- state.
CREATE OR REPLACE FUNCTION public.booking_contracts_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('renter_signed', 'signed') THEN
      RAISE EXCEPTION 'Signed contracts cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'signed' AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.signed_pdf_path IS DISTINCT FROM OLD.signed_pdf_path
    OR NEW.signed_pdf_sha256 IS DISTINCT FROM OLD.signed_pdf_sha256
    OR NEW.unsigned_pdf_sha256 IS DISTINCT FROM OLD.unsigned_pdf_sha256
    OR NEW.contract_amount IS DISTINCT FROM OLD.contract_amount
  ) THEN
    RAISE EXCEPTION 'Signed contracts are immutable';
  END IF;

  IF OLD.status IN ('rejected', 'expired', 'failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Contract status % is terminal', OLD.status;
  END IF;

  IF OLD.status = 'renter_signed' AND NEW.status NOT IN ('renter_signed', 'signed', 'expired', 'rejected') THEN
    RAISE EXCEPTION 'Invalid contract status transition % -> %', OLD.status, NEW.status;
  END IF;

  -- The document that was sent for signing is fixed once an order exists.
  IF OLD.idura_signature_order_id IS NOT NULL AND (
    NEW.idura_signature_order_id IS DISTINCT FROM OLD.idura_signature_order_id
    OR NEW.unsigned_pdf_path IS DISTINCT FROM OLD.unsigned_pdf_path
    OR NEW.unsigned_pdf_sha256 IS DISTINCT FROM OLD.unsigned_pdf_sha256
  ) THEN
    RAISE EXCEPTION 'Contract document cannot be replaced after it was sent for signing';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_contracts_guard_update ON public.booking_contracts;
CREATE TRIGGER booking_contracts_guard_update
  BEFORE UPDATE ON public.booking_contracts
  FOR EACH ROW EXECUTE FUNCTION public.booking_contracts_guard();

DROP TRIGGER IF EXISTS booking_contracts_guard_delete ON public.booking_contracts;
CREATE TRIGGER booking_contracts_guard_delete
  BEFORE DELETE ON public.booking_contracts
  FOR EACH ROW EXECUTE FUNCTION public.booking_contracts_guard();

-- ---------------------------------------------------------------------------
-- Webhook delivery log (deduplication + audit). Stores no personal data.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.idura_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_sha256 TEXT NOT NULL UNIQUE,
  event TEXT NOT NULL,
  signature_order_id TEXT,
  signatory_id TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.idura_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

-- ---------------------------------------------------------------------------
-- Private storage for unsigned and signed contract PDFs
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contracts', 'contracts', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
