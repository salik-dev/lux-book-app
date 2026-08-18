-- One verification row per NIN (Norwegian national id); allows multiple NULL nin if any legacy rows exist.
CREATE UNIQUE INDEX IF NOT EXISTS bankid_verifications_nin_unique
  ON public.bankid_verifications (nin)
  WHERE nin IS NOT NULL;
