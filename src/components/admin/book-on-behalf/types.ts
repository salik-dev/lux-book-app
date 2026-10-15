export interface AdminCarOption {
  id: string;
  name: string;
  brand: string;
  model: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  base_price_per_month?: number | null;
  deposit_amount?: number | null;
  image_url: string | null;
  is_available: boolean;
}

export interface AdminBookingPricing {
  durationHours: number;
  /** Days charged (ceil of hours/24) — used for the daily/monthly duration label. */
  rentalDays: number;
  /** Whole 30-day months charged for monthly pricing (0 otherwise). */
  rentalMonths: number;
  basePrice: number;
  deliveryFee: number;
  depositAmount: number;
  vatAmount: number;
  driverSurcharge: number;
  totalPrice: number;
}

export interface CreateBookingPayload {
  customerFullName: string;
  customerLastName: string;
  customerNin: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: string | null;
  customerPostalCode?: string | null;
  customerCity?: string | null;
  licenseVerified: boolean;
  licenseCategories?: string[];
  carId: string;
  startDateTime: string;
  endDateTime: string;
  pickupLocation: string;
  deliveryLocation?: string | null;
  deliveryFee: number;
  bookingForCompany?: boolean;
  orgName?: string | null;
  orgNo?: string | null;
  withDriver?: boolean;
  decorationRequired?: boolean;
  basePrice: number;
  totalPrice: number;
  vatAmount: number;
  language?: "en" | "no";
}

export interface CreateBookingResponse {
  ok: true;
  bookingId: string;
  bookingNumber: string;
  checkoutUrl: string | null;
  stripeSessionId: string;
}
