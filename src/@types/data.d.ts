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
  driverLicenseFile?: File;
}

export interface PaymentStepProps {
  bookingData: BookingData;
  customerData: CustomerData;
  onComplete: () => void;
}

export interface CustomerData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  dateOfBirth: Date;
  driverLicenseFile?: File;
}

export interface BookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCar: CarData | null;
}
