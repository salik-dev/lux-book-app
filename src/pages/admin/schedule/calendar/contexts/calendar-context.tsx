import { createContext, useContext, useEffect, useState } from "react";

import type { Dispatch, SetStateAction } from "react";
import type { IEvent, IUser, ICalendarCar } from "@/pages/admin/schedule/calendar/interfaces";
import type { TBadgeVariant, TCalendarView, TVisibleHours, TWorkingHours } from "@/pages/admin/schedule/calendar/types";

// Optional handlers wired up by the car-availability container. They are
// undefined in the generic/demo usage of the calendar.
export interface ICarCalendarActions {
  cars?: ICalendarCar[];
  refetch?: () => void;
  onBookCar?: (carId?: string, start?: Date, end?: Date) => void;
  onMarkUnavailable?: (carId?: string, start?: Date) => void;
  onToggleCarAvailability?: (carId: string, currentlyAvailable: boolean) => void;
  onCancelBooking?: (bookingId: string) => void;
  onDeleteBlock?: (blockId: string, carId?: string) => void;
}

interface ICalendarContext extends ICarCalendarActions {
  view: TCalendarView;
  setView: (view: TCalendarView) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date | undefined) => void;
  selectedUserId: IUser["id"] | "all";
  setSelectedUserId: (userId: IUser["id"] | "all") => void;
  badgeVariant: TBadgeVariant;
  setBadgeVariant: (variant: TBadgeVariant) => void;
  users: IUser[];
  workingHours: TWorkingHours;
  setWorkingHours: Dispatch<SetStateAction<TWorkingHours>>;
  visibleHours: TVisibleHours;
  setVisibleHours: Dispatch<SetStateAction<TVisibleHours>>;
  events: IEvent[];
  setLocalEvents: Dispatch<SetStateAction<IEvent[]>>;
}

const CalendarContext = createContext({} as ICalendarContext);

const WORKING_HOURS = {
  0: { from: 0, to: 0 },
  1: { from: 8, to: 17 },
  2: { from: 8, to: 17 },
  3: { from: 8, to: 17 },
  4: { from: 8, to: 17 },
  5: { from: 8, to: 17 },
  6: { from: 8, to: 12 },
};

const VISIBLE_HOURS = { from: 7, to: 18 };

export function CalendarProvider({
  children,
  users,
  events,
  defaultView = "month",
  cars,
  refetch,
  onBookCar,
  onMarkUnavailable,
  onToggleCarAvailability,
  onCancelBooking,
  onDeleteBlock,
}: {
  children: React.ReactNode;
  users: IUser[];
  events: IEvent[];
  defaultView?: TCalendarView;
} & ICarCalendarActions) {
  const [view, setView] = useState<TCalendarView>(defaultView);
  const [badgeVariant, setBadgeVariant] = useState<TBadgeVariant>("colored");
  const [visibleHours, setVisibleHours] = useState<TVisibleHours>(VISIBLE_HOURS);
  const [workingHours, setWorkingHours] = useState<TWorkingHours>(WORKING_HOURS);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<IUser["id"] | "all">("all");

  // This localEvents doesn't need to exists in a real scenario.
  // It's used here just to simulate the update of the events.
  // In a real scenario, the events would be updated in the backend
  // and the request that fetches the events should be refetched
  const [localEvents, setLocalEvents] = useState<IEvent[]>(events);

  // Keep local events in sync when the parent refetches real data.
  useEffect(() => {
    setLocalEvents(events);
  }, [events]);

  const handleSelectDate = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
  };

  return (
    <CalendarContext.Provider
      value={{
        view,
        setView,
        selectedDate,
        setSelectedDate: handleSelectDate,
        selectedUserId,
        setSelectedUserId,
        badgeVariant,
        setBadgeVariant,
        users,
        visibleHours,
        setVisibleHours,
        workingHours,
        setWorkingHours,
        // If you go to the refetch approach, you can remove the localEvents and pass the events directly
        events: localEvents,
        setLocalEvents,
        // Car-availability extensions (optional)
        cars,
        refetch,
        onBookCar,
        onMarkUnavailable,
        onToggleCarAvailability,
        onCancelBooking,
        onDeleteBlock,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): ICalendarContext {
  const context = useContext(CalendarContext);
  if (!context) throw new Error("useCalendar must be used within a CalendarProvider.");
  return context;
}
