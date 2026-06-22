import { Columns, Grid3x3, List, Plus, Grid2x2, CalendarRange, CalendarPlus, Ban } from "lucide-react";

import { Button } from "@/pages/admin/schedule/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/pages/admin/schedule/components/ui/tooltip";

import { useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";
import { UserSelect } from "@/pages/admin/schedule/calendar/components/header/user-select";
import { TodayButton } from "@/pages/admin/schedule/calendar/components/header/today-button";
import { DateNavigator } from "@/pages/admin/schedule/calendar/components/header/date-navigator";
import { AddEventDialog } from "@/pages/admin/schedule/calendar/components/dialogs/add-event-dialog";

import { cn } from "@/pages/admin/schedule/lib/utils";

import type { LucideIcon } from "lucide-react";
import type { IEvent } from "@/pages/admin/schedule/calendar/interfaces";
import type { TCalendarView } from "@/pages/admin/schedule/calendar/types";

interface IProps {
  view: TCalendarView;
  events: IEvent[];
}

const VIEW_OPTIONS: { value: TCalendarView; label: string; icon: LucideIcon }[] = [
  { value: "day", label: "Day view", icon: List },
  { value: "week", label: "Week view", icon: Columns },
  { value: "month", label: "Month view", icon: Grid2x2 },
  { value: "year", label: "Year view", icon: Grid3x3 },
  { value: "agenda", label: "Agenda view", icon: CalendarRange },
];

export function CalendarHeader({ view, events }: IProps) {
  const { setView, onBookCar, onMarkUnavailable, selectedUserId, selectedDate } = useCalendar();

  // Car-availability mode: surface booking / blocking actions instead of the
  // generic "Add Event" dialog. Pre-seed with the filtered car + selected date.
  const isCarCalendar = !!onBookCar || !!onMarkUnavailable;
  const seedCarId = selectedUserId !== "all" ? selectedUserId : undefined;

  return (
    <div className="flex flex-col gap-4 border-b border-neutral-200 bg-neutral-50 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <TodayButton />
        <div className="h-6 w-px bg-neutral-200"></div>
        <DateNavigator view={view} events={events} />
      </div>

      <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
        <div className="flex w-full items-center gap-1.5">
          <div className="inline-flex">
            {VIEW_OPTIONS.map(({ value, label, icon: Icon }, index) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={() => setView(value)}
                    aria-label={label}
                    size="icon"
                    variant={view === value ? "default" : "outline"}
                    className={cn(
                      "[&_svg]:size-5",
                      index === 0 && "rounded-r-none",
                      index > 0 && index < VIEW_OPTIONS.length - 1 && "-ml-px rounded-none",
                      index === VIEW_OPTIONS.length - 1 && "-ml-px rounded-l-none"
                    )}
                  >
                    <Icon strokeWidth={1.8} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <UserSelect />
        </div>

        {isCarCalendar ? (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {onMarkUnavailable && (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onMarkUnavailable(seedCarId, selectedDate)}
              >
                <Ban />
                Mark unavailable
              </Button>
            )}
            {onBookCar && (
              <Button type="button" className="w-full sm:w-auto" onClick={() => onBookCar(seedCarId, selectedDate)}>
                <CalendarPlus />
                Book a car
              </Button>
            )}
          </div>
        ) : (
          <AddEventDialog>
            <Button className="w-full sm:w-auto">
              <Plus />
              Add Event
            </Button>
          </AddEventDialog>
        )}
      </div>
    </div>
  );
}
