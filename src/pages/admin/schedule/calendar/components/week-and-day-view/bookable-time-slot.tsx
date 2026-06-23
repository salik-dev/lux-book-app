import { useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";

import { AddEventDialog } from "@/pages/admin/schedule/calendar/components/dialogs/add-event-dialog";

interface IProps {
  date: Date;
  hour: number;
  minute: number;
  className: string;
}

/**
 * Empty-slot trigger for the day/week grids. In the car-availability
 * calendar this opens "Book a car" pre-seeded with the clicked slot
 * instead of the generic demo "Add Event" form; the non-car calendar
 * (no onBookCar wired) falls back to the original behavior.
 */
export function BookableTimeSlot({ date, hour, minute, className }: IProps) {
  const { onBookCar, selectedUserId } = useCalendar();

  if (!onBookCar) {
    return (
      <AddEventDialog startDate={date} startTime={{ hour, minute }}>
        <div className={className} />
      </AddEventDialog>
    );
  }

  const handleClick = () => {
    const start = new Date(date);
    start.setHours(hour, minute, 0, 0);
    onBookCar(selectedUserId !== "all" ? selectedUserId : undefined, start);
  };

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    />
  );
}
