export interface CardProps {
  onNavigateToBooking: () => void;
  onCarSelect: (car: any) => void;
}

export interface CarCardProps {
  // id: string
  name?: string
  image_url: string
  price: string
  transmission: string
  fuel: string
  category: string
  vehicleType?: string
  doors?: string
  moreInfo?: string[]
  index: number
  isExpanded: boolean
  onToggleExpand: (index: number) => void
  onNavigateToBooking: () => void
  onCarSelect: (car: any) => void
}

export interface CarData {
  name: string;
  image_url: string;
  price: string;
  vehicleType: string;
  doors: string;
  transmission: string;
  fuel: string;
  category: string;
  moreInfo: string[];
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
