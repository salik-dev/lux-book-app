-- Email OTP login for admin_users (replaces password login for the /admin/login screen)
ALTER TABLE public.admin_users
  ADD COLUMN otp_code_hash TEXT,
  ADD COLUMN otp_expires_at TIMESTAMPTZ,
  ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN otp_last_sent_at TIMESTAMPTZ;
