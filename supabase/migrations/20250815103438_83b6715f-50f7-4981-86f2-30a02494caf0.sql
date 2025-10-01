-- Fix RLS recursion issue by creating security definer function
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = $1 
    AND admin_users.is_active = true 
    AND admin_users.role = 'admin'
  );
$$;

-- Drop existing problematic RLS policies
DROP POLICY IF EXISTS "Only admin role can manage admin users" ON public.admin_users;

-- Create new safe RLS policy using security definer function
CREATE POLICY "Only admin role can manage admin users" 
ON public.admin_users 
FOR ALL 
USING (public.is_admin_user(auth.uid()));

-- Delete existing admin entry for this user if exists, then add as admin
DELETE FROM public.admin_users WHERE user_id = 'c1ae099e-d8c6-40cd-8888-069e5f4607de';
INSERT INTO public.admin_users (user_id, email, role, full_name, is_active)
VALUES (
  'c1ae099e-d8c6-40cd-8888-069e5f4607de',
  'tayyab.ali@absoluit.com',
  'admin',
  'Tayyab Ali',
  true
);

-- Add more admin users
INSERT INTO public.admin_users (user_id, email, role, full_name, is_active) VALUES
  (gen_random_uuid(), 'admin@fjordfleet.no', 'admin', 'Fleet Manager', true),
  (gen_random_uuid(), 'operations@fjordfleet.no', 'operations', 'Operations Lead', true),
  (gen_random_uuid(), 'accountant@fjordfleet.no', 'accountant', 'Chief Accountant', true);

-- Add customer placeholder data
INSERT INTO public.customers (id, user_id, full_name, email, phone, address, postal_code, city, date_of_birth, driver_license_number) VALUES
  (gen_random_uuid(), null, 'Erik Nordahl', 'erik.nordahl@gmail.com', '+47 98765432', 'Storgata 15', '0155', 'Oslo', '1985-03-15', 'NO12345678'),
  (gen_random_uuid(), null, 'Ingrid Larsen', 'ingrid.larsen@outlook.com', '+47 91234567', 'Kongens gate 8', '7011', 'Trondheim', '1990-07-22', 'NO23456789'),
  (gen_random_uuid(), null, 'Ole Hansen', 'ole.hansen@hotmail.com', '+47 95678901', 'Bryggen 3', '5003', 'Bergen', '1978-11-08', 'NO34567890'),
  (gen_random_uuid(), null, 'Astrid Solberg', 'astrid.solberg@gmail.com', '+47 92345678', 'Torggata 12', '4006', 'Stavanger', '1982-05-14', 'NO45678901'),
  (gen_random_uuid(), null, 'Magnus Haugen', 'magnus.haugen@yahoo.com', '+47 97890123', 'Parkveien 25', '9008', 'Tromsø', '1975-09-30', 'NO56789012'),
  (gen_random_uuid(), null, 'Kari Johnsen', 'kari.johnsen@gmail.com', '+47 94567890', 'Hovedgata 7', '1530', 'Moss', '1988-12-03', 'NO67890123'),
  (gen_random_uuid(), null, 'Lars Andersen', 'lars.andersen@hotmail.com', '+47 99876543', 'Strandpromenaden 18', '3187', 'Horten', '1983-02-18', 'NO78901234'),
  (gen_random_uuid(), null, 'Silje Nilsen', 'silje.nilsen@outlook.com', '+47 96543210', 'Slottsparken 4', '3044', 'Drammen', '1991-06-27', 'NO89012345'),
  (gen_random_uuid(), null, 'Bjørn Kristiansen', 'bjorn.kristiansen@gmail.com', '+47 93210987', 'Fjellveien 33', '2815', 'Gjøvik', '1980-10-12', 'NO90123456'),
  (gen_random_uuid(), null, 'Marte Olsen', 'marte.olsen@yahoo.com', '+47 98123456', 'Sentrum 9', '2317', 'Hamar', '1987-04-05', 'NO01234567');

-- Add pricing rules
INSERT INTO public.pricing_rules (id, name, rule_type, zone_name, min_distance_km, max_distance_km, flat_fee, price_per_km, is_active) VALUES
  (gen_random_uuid(), 'Oslo City Delivery', 'delivery', 'Oslo Center', 0, 5, 300.00, null, true),
  (gen_random_uuid(), 'Oslo Extended Area', 'delivery', 'Oslo Extended', 5, 15, 500.00, 8.00, true),
  (gen_random_uuid(), 'Bergen City Delivery', 'delivery', 'Bergen Center', 0, 3, 250.00, null, true),
  (gen_random_uuid(), 'Long Distance Delivery', 'delivery', 'National', 15, null, 800.00, 12.00, true),
  (gen_random_uuid(), 'Weekend Premium', 'time_based', null, null, null, 1000.00, null, true),
  (gen_random_uuid(), 'Airport Pickup Fee', 'location', 'Airports', null, null, 400.00, null, true);

-- Add app settings
INSERT INTO public.app_settings (id, key, value, description, updated_by) VALUES
  (gen_random_uuid(), 'company_name', '"Fjord Fleet"', 'Company display name', 'c1ae099e-d8c6-40cd-8888-069e5f4607de'),
  (gen_random_uuid(), 'default_currency', '"NOK"', 'Default currency for pricing', 'c1ae099e-d8c6-40cd-8888-069e5f4607de'),
  (gen_random_uuid(), 'vat_rate', '0.25', 'VAT rate (25%)', 'c1ae099e-d8c6-40cd-8888-069e5f4607de'),
  (gen_random_uuid(), 'booking_lead_time_hours', '2', 'Minimum hours before pickup', 'c1ae099e-d8c6-40cd-8888-069e5f4607de'),
  (gen_random_uuid(), 'max_booking_days', '30', 'Maximum booking duration in days', 'c1ae099e-d8c6-40cd-8888-069e5f4607de'),
  (gen_random_uuid(), 'email_notifications', 'true', 'Enable email notifications', 'c1ae099e-d8c6-40cd-8888-069e5f4607de'),
  (gen_random_uuid(), 'maintenance_mode', 'false', 'System maintenance mode', 'c1ae099e-d8c6-40cd-8888-069e5f4607de');