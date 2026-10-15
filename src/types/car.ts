export interface Car {
  id?: string;
  name: string;
  model: string;
  brand: string;
  year: number;
  /** Normalised plate, e.g. "EN10257"; null for cars added before register verification. */
  registration_number?: string | null;
  base_price_per_hour: number;
  base_price_per_day: number;
  /** Optional monthly rate (NOK); null/0 means this vehicle isn't offered per month. */
  base_price_per_month?: number | null;
  deposit_amount?: number | null;
  included_km_per_day: number | null;
  extra_km_rate: number | null;
  description?: string;
  image_url?: string | null;
  is_available: boolean | null;
  created_at?: string;
}
