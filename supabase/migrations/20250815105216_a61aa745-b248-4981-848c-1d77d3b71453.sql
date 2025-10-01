-- Drop the problematic RLS policy causing infinite recursion
DROP POLICY IF EXISTS "Only admin role can manage admin users" ON public.admin_users;

-- Drop the function causing recursion
DROP FUNCTION IF EXISTS public.is_admin_user(uuid);

-- Create simple, safe RLS policies for admin_users
-- Admins can view all admin users
CREATE POLICY "Admins can view admin users" 
ON public.admin_users 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.is_active = true 
    AND au.role IN ('admin', 'operations')
  )
);

-- Admins can manage admin users (insert, update, delete)
CREATE POLICY "Admins can manage admin users" 
ON public.admin_users 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.is_active = true 
    AND au.role = 'admin'
  )
);

-- Update the admin user record with the correct user_id for tayyab.ali@absoluit.com
UPDATE public.admin_users 
SET user_id = 'c1ae099e-d8c6-40cd-8888-069e5f4607de'
WHERE email = 'tayyab.ali@absoluit.com';

-- If the record doesn't exist, create it
INSERT INTO public.admin_users (user_id, email, role, full_name, is_active)
VALUES (
  'c1ae099e-d8c6-40cd-8888-069e5f4607de',
  'tayyab.ali@absoluit.com',
  'admin',
  'Tayyab Ali',
  true
)
ON CONFLICT (email) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  is_active = EXCLUDED.is_active,
  role = EXCLUDED.role;