import { TEventColor } from "./types";

export interface IUser {
  id: string;
  name: string;
  picturePath: string | null;
}

export interface IEvent {
  id: number;
  startDate: string;
  endDate: string;
  title: string;
  color: TEventColor;
  description: string;
  user: IUser;

  // Car-calendar extensions (additive — generic template code ignores these).
  // `kind` distinguishes a real booking from an admin unavailability block.
  kind?: "booking" | "block";
  // UUID of the underlying booking / car_unavailability row.
  referenceId?: string;
  // Owning car id (same as `user.id`, kept explicit for clarity).
  carId?: string;
  // Booking status (pending | confirmed | active | completed | cancelled).
  status?: string;
  // Extra display metadata surfaced in the details dialog.
  meta?: {
    bookingNumber?: string;
    customerName?: string | null;
    customerEmail?: string | null;
    total?: number;
    reason?: string | null;
  };
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}

// A car as surfaced to the car-availability calendar.
export interface ICalendarCar {
  id: string;
  name: string;
  brand: string;
  model: string;
  image_url: string | null;
  is_available: boolean;
  base_price_per_hour: number;
  base_price_per_day: number;
}
