export interface HomePageProps {
  onNavigateToBooking: () => void;
  onCarSelect: (car: any) => void;
}

export interface CarCardProps {
  image: string
  price: string
  transmission: string
  fuel: string
  category: string
  name?: string
  vehicleType?: string
  doors?: string
  moreInfo?: string[]
  index: number
  isExpanded: boolean
  onToggleExpand: (index: number) => void
  onCarSelect: (car: any) => void
}