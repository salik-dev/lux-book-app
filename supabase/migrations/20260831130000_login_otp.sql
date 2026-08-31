-- Generic email OTP login (site-wide "Log In" dialog, any user, not gated on admin_users)
CREATE TABLE public.login_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  otp_code_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  otp_last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.login_otps ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_login_otps_updated_at BEFORE UPDATE ON public.login_otps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
