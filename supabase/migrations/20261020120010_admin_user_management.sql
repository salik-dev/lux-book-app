-- User Management (super-admin only): adds a username field, a non-recursive
-- super-admin check for RLS, management policies, and seeds the first super admin.

-- 1. Username column (display handle shown in the admin User Management table).
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Backfill existing rows so username is never empty for legacy records.
UPDATE public.admin_users
  SET username = full_name
  WHERE username IS NULL OR username = '';

-- 2. SECURITY DEFINER helper: avoids recursive RLS evaluation when a policy on
--    admin_users needs to look at admin_users to decide access.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

-- 3. RLS policies (defence in depth — privileged CRUD runs through an edge
--    function with the service role, but these keep direct access locked down).
DROP POLICY IF EXISTS "Super admins read admin users" ON public.admin_users;
CREATE POLICY "Super admins read admin users" ON public.admin_users
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins manage admin users" ON public.admin_users;
CREATE POLICY "Super admins manage admin users" ON public.admin_users
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 4. Seed / promote the bootstrap super admin. user_id is linked on first login
--    (the auth user is provisioned by the admin-verify-otp edge function).
INSERT INTO public.admin_users (email, role, full_name, username, is_active)
VALUES ('bahadur.ali@absoluit.com', 'super_admin', 'Bahadur Ali', 'bahadur.ali', true)
ON CONFLICT (email) DO UPDATE
  SET role = 'super_admin',
      is_active = true,
      username = COALESCE(NULLIF(public.admin_users.username, ''), EXCLUDED.username);
