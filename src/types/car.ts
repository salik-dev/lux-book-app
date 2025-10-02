export interface Car {
  id?: string;
  name: string;
  model: string;
  brand: string;
  year: number;
  base_price_per_hour: number;
  base_price_per_day: number;
  included_km_per_day: number | null;
  extra_km_rate: number | null;
  description?: string;
  image_url?: string | null;
  is_available: boolean | null;
  created_at?: string;
}
