export interface EligibleCustomer {
  customer_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  driver_license_number: string | null;
  nin_last4: string | null;
  verification_id: string;
  contract_signed_at: string | null;
  total_bookings: number;
  customer_created_at: string;
}

export interface EligibleCustomerPage {
  items: EligibleCustomer[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface AdminCarOption {
  id: string;
  name: string;
  brand: string;
  model: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  image_url: string | null;
  is_available: boolean;
}

export interface AdminBookingPricing {
  durationHours: number;
  basePrice: number;
  deliveryFee: number;
  vatAmount: number;
  totalPrice: number;
}

export interface CreateBookingPayload {
  customerId: string;
  carId: string;
  startDateTime: string;
  endDateTime: string;
  pickupLocation: string;
  deliveryLocation?: string | null;
  deliveryFee: number;
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
