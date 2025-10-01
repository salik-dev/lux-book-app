-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');
CREATE TYPE payment_method AS ENUM ('stripe', 'vipps');
CREATE TYPE user_role AS ENUM ('admin', 'operations', 'accountant');

-- Cars table
CREATE TABLE public.cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  brand TEXT NOT NULL,
  year INTEGER NOT NULL,
  description TEXT,
  base_price_per_hour DECIMAL(10,2) NOT NULL,
  base_price_per_day DECIMAL(10,2) NOT NULL,
  included_km_per_day INTEGER DEFAULT 200,
  extra_km_rate DECIMAL(5,2) DEFAULT 5.00,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers table (separate from auth users for GDPR and data management)
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  date_of_birth DATE,
  driver_license_number TEXT,
  driver_license_file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin users table
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'operations',
  full_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  car_id UUID REFERENCES public.cars(id) ON DELETE RESTRICT,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  pickup_location TEXT NOT NULL,
  delivery_location TEXT,
  delivery_distance_km DECIMAL(8,2),
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  base_price DECIMAL(10,2) NOT NULL,
  extra_km_price DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) NOT NULL,
  status booking_status DEFAULT 'pending',
  contract_signed_at TIMESTAMPTZ,
  contract_file_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'NOK',
  method payment_method NOT NULL,
  status payment_status DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  vipps_order_id TEXT,
  transaction_id TEXT,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pricing rules table
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'base_pricing', 'delivery_zone', 'extra_km'
  zone_name TEXT, -- for delivery zones
  min_distance_km DECIMAL(8,2),
  max_distance_km DECIMAL(8,2),
  price_per_km DECIMAL(5,2),
  flat_fee DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Settings table for app configuration
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cars (public read, admin write)
CREATE POLICY "Cars are viewable by everyone" ON public.cars
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify cars" ON public.cars
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policies for customers (own data + admin access)
CREATE POLICY "Customers can view own data" ON public.customers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Customers can update own data" ON public.customers
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all customers" ON public.customers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can modify all customers" ON public.customers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policies for admin_users
CREATE POLICY "Admin users can view themselves" ON public.admin_users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Only admin role can manage admin users" ON public.admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- RLS Policies for bookings
CREATE POLICY "Customers can view own bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.customers 
      WHERE id = bookings.customer_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers 
      WHERE id = bookings.customer_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can modify all bookings" ON public.bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policies for payments
CREATE POLICY "Customers can view own payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.customers c ON b.customer_id = c.id
      WHERE b.id = payments.booking_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can modify payments" ON public.payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policies for pricing_rules (admin only)
CREATE POLICY "Pricing rules viewable by admins" ON public.pricing_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Only admins can modify pricing rules" ON public.pricing_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policies for audit_logs (admin read only)
CREATE POLICY "Audit logs viewable by admins" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policies for app_settings (admin only)
CREATE POLICY "App settings viewable by admins" ON public.app_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Only admins can modify app settings" ON public.app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Create indexes for performance
CREATE INDEX idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX idx_bookings_car_id ON public.bookings(car_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_dates ON public.bookings(start_datetime, end_datetime);
CREATE INDEX idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX idx_customers_user_id ON public.customers(user_id);
CREATE INDEX idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cars_updated_at BEFORE UPDATE ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate booking numbers
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'FJB';
  year_suffix TEXT := to_char(now(), 'YY');
  sequence_num INTEGER;
  booking_number TEXT;
BEGIN
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(booking_number FROM '\d+$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.bookings
  WHERE booking_number LIKE prefix || year_suffix || '%';
  
  booking_number := prefix || year_suffix || LPAD(sequence_num::TEXT, 4, '0');
  RETURN booking_number;
END;
$$ LANGUAGE plpgsql;

-- Insert default pricing rules
INSERT INTO public.pricing_rules (name, rule_type, zone_name, max_distance_km, price_per_km, flat_fee) VALUES
('Free delivery zone', 'delivery_zone', 'Oslo Center', 10, 0, 0),
('Standard delivery zone', 'delivery_zone', 'Greater Oslo', 50, 15, 0),
('Extended delivery zone', 'delivery_zone', 'Regional', 200, 25, 500);

-- Insert default app settings
INSERT INTO public.app_settings (key, value, description) VALUES
('vat_rate', '0.25', 'Norwegian VAT rate (25%)'),
('free_km_distance', '10', 'Free delivery distance in KM'),
('cancellation_hours', '24', 'Hours before booking to allow free cancellation'),
('min_booking_hours', '4', 'Minimum booking duration in hours'),
('buffer_minutes', '30', 'Buffer time between bookings in minutes');

-- Insert sample luxury cars
INSERT INTO public.cars (name, model, brand, year, description, base_price_per_hour, base_price_per_day, included_km_per_day, extra_km_rate) VALUES
('BMW X7 M50i', 'X7 M50i', 'BMW', 2024, 'Ultimate luxury SUV with premium comfort and performance', 1200, 8900, 300, 8.50),
('Mercedes S-Class AMG', 'S 63 AMG', 'Mercedes-Benz', 2024, 'The pinnacle of luxury sedans with cutting-edge technology', 1500, 11500, 250, 10.00),
('Audi RS Q8', 'RS Q8', 'Audi', 2024, 'High-performance luxury SUV with quattro all-wheel drive', 1400, 10200, 280, 9.25),
('Porsche Cayenne Turbo', 'Cayenne Turbo', 'Porsche', 2024, 'Sports car performance in a luxury SUV package', 1600, 12000, 200, 12.00),
('Range Rover Autobiography', 'Range Rover Autobiography', 'Land Rover', 2024, 'British luxury with unparalleled off-road capability', 1300, 9800, 250, 9.50);

-- Function to create admin user after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Only create admin user if email contains admin domain or is whitelisted
  IF NEW.email LIKE '%@fjordfleet.no' OR NEW.email = 'admin@example.com' THEN
    INSERT INTO public.admin_users (user_id, email, role, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      'admin',
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-create admin users
CREATE TRIGGER on_auth_admin_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_user();

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES 
('driver-licenses', 'driver-licenses', false),
('contracts', 'contracts', false),
('car-images', 'car-images', true);

-- Storage policies for driver licenses (private)
CREATE POLICY "Users can upload their own driver license" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'driver-licenses' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own driver license" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'driver-licenses' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all driver licenses" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'driver-licenses' AND
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Storage policies for contracts (private)
CREATE POLICY "Admins can manage contracts" ON storage.objects
  FOR ALL USING (
    bucket_id = 'contracts' AND
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Storage policies for car images (public)
CREATE POLICY "Car images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'car-images');

CREATE POLICY "Admins can manage car images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'car-images' AND
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );