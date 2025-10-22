export interface CardProps {
  onNavigateToBooking: () => void;
  onCarSelect: (car: any) => void;
}

export interface CarCardProps {
  id: number | string;
  name: string;
  model: string;
  brand: string;
  year: number;
  description: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  included_km_per_day: number;
  extra_km_rate: number;
  image_url: string;
  is_available: boolean;
  onNavigateToBooking: () => void
  onCarSelect: (car: any) => void
}

export interface CarData {
  id: number | string;
  name: string;
  model: string;
  brand: string;
  year: number;
  description: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  included_km_per_day: number;
  extra_km_rate: number;
  image_url: string;
  is_available: boolean;
}

export interface BookingData {
  car: CarData;
  startDateTime: Date;
  endDateTime: Date;
  pickupLocation: string;
  deliveryLocation?: string;
  totalPrice: number;
  basePrice: number;
  deliveryFee: number;
  vatAmount: number;
}

export interface CustomerData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  dateOfBirth: Date;
  driverLicenseNumber: string;
  driverLicenseFile?: File | string; // Can be either File object or URL string
}

export interface PaymentStepProps {
  bookingData: BookingData;
  customerData: CustomerData;
  onComplete: () => void;
}


export interface BookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCar: CarData | null;
}

export interface BookingProps {
  id: string;
  booking_number: string;
  start_datetime: string;
  end_datetime: string;
  pickup_location: string;
  delivery_location: string | null;
  total_price: number;
  status: string | null;
  car: {
    id: string;
    name: string;
    brand: string;
    model: string;
    image_url: string | null;
  };
}
