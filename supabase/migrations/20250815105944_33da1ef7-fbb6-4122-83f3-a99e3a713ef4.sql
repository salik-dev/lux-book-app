-- Disable RLS on all tables for MVP
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- Add sample cars data for MVP
INSERT INTO public.cars (brand, model, name, year, base_price_per_hour, base_price_per_day, description, is_available) VALUES
('Mercedes-Benz', 'S-Class', 'Mercedes S-Class', 2023, 150, 1200, 'Luxury sedan with premium comfort and advanced technology', true),
('BMW', 'X7', 'BMW X7', 2023, 120, 950, 'Spacious luxury SUV perfect for family trips', true),
('Audi', 'A8', 'Audi A8', 2022, 140, 1100, 'Executive sedan with cutting-edge features', true),
('Porsche', '911', 'Porsche 911', 2023, 200, 1600, 'Iconic sports car delivering thrilling performance', true),
('Range Rover', 'Evoque', 'Range Rover Evoque', 2023, 130, 1000, 'Compact luxury SUV with distinctive design', true)
ON CONFLICT (id) DO NOTHING;