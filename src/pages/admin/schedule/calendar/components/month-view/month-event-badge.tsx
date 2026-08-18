import { cva } from "class-variance-authority";
import { endOfDay, format, isSameDay, parseISO, startOfDay } from "date-fns";

import { useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";

import { DraggableEvent } from "@/pages/admin/schedule/calendar/components/dnd/draggable-event";
import { EventDetailsDialog } from "@/pages/admin/schedule/calendar/components/dialogs/event-details-dialog";

import { cn } from "@/pages/admin/schedule/lib/utils";

import type { IEvent } from "@/pages/admin/schedule/calendar/interfaces";
import type { VariantProps } from "class-variance-authority";

const eventBadgeVariants = cva(
  "mx-1 flex size-auto h-6.5 cursor-pointer select-none items-center justify-between gap-1.5 truncate whitespace-nowrap rounded-md border px-2 text-xs transition-shadow duration-150 hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      color: {
        // Colored and mixed variants with transparent backgrounds (light theme only)
        blue: "border-blue-300 bg-blue-100/50 text-blue-700 [&_.event-dot]:fill-blue-600 hover:bg-blue-100/70",
        green: "border-green-300 bg-green-100/50 text-green-700 [&_.event-dot]:fill-green-600 hover:bg-green-100/70",
        red: "border-red-300 bg-red-100/50 text-red-700 [&_.event-dot]:fill-red-600 hover:bg-red-100/70",
        yellow: "border-yellow-300 bg-yellow-100/50 text-yellow-700 [&_.event-dot]:fill-yellow-600 hover:bg-yellow-100/70",
        purple: "border-purple-300 bg-purple-100/50 text-purple-700 [&_.event-dot]:fill-purple-600 hover:bg-purple-100/70",
        orange: "border-orange-300 bg-orange-100/50 text-orange-700 [&_.event-dot]:fill-orange-600 hover:bg-orange-100/70",
        gray: "border-neutral-300 bg-neutral-100/50 text-neutral-700 [&_.event-dot]:fill-neutral-600 hover:bg-neutral-100/70",

        // Dot variants with transparent backgrounds (light theme only)
        "blue-dot": "border-blue-200 bg-blue-100/40 text-blue-700 [&_.event-dot]:fill-blue-600 hover:bg-blue-100/60",
        "green-dot": "border-green-200 bg-green-100/40 text-green-700 [&_.event-dot]:fill-green-600 hover:bg-green-100/60",
        "red-dot": "border-red-200 bg-red-100/40 text-red-700 [&_.event-dot]:fill-red-600 hover:bg-red-100/60",
        "yellow-dot": "border-yellow-200 bg-yellow-100/40 text-yellow-700 [&_.event-dot]:fill-yellow-600 hover:bg-yellow-100/60",
        "purple-dot": "border-purple-200 bg-purple-100/40 text-purple-700 [&_.event-dot]:fill-purple-600 hover:bg-purple-100/60",
        "orange-dot": "border-orange-200 bg-orange-100/40 text-orange-700 [&_.event-dot]:fill-orange-600 hover:bg-orange-100/60",
        "gray-dot": "border-neutral-200 bg-neutral-100/40 text-neutral-700 [&_.event-dot]:fill-neutral-600 hover:bg-neutral-100/60",
      },
      multiDayPosition: {
        first: "relative z-10 mr-0 w-[calc(100%_-_3px)] rounded-r-none border-r-0 [&>span]:mr-2.5",
        middle: "relative z-10 mx-0 w-[calc(100%_+_1px)] rounded-none border-x-0",
        last: "ml-0 rounded-l-none border-l-0",
        none: "",
      },
    },
    defaultVariants: {
      color: "blue-dot",
    },
  }
);

interface IProps extends Omit<VariantProps<typeof eventBadgeVariants>, "color" | "multiDayPosition"> {
  event: IEvent;
  cellDate: Date;
  eventCurrentDay?: number;
  eventTotalDays?: number;
  className?: string;
  position?: "first" | "middle" | "last" | "none";
}

export function MonthEventBadge({ event, cellDate, eventCurrentDay, eventTotalDays, className, position: propPosition }: IProps) {
  const { badgeVariant } = useCalendar();

  const itemStart = startOfDay(parseISO(event.startDate));
  const itemEnd = endOfDay(parseISO(event.endDate));

  if (cellDate < itemStart || cellDate > itemEnd) return null;

  let position: "first" | "middle" | "last" | "none" | undefined;

  if (propPosition) {
    position = propPosition;
  } else if (eventCurrentDay && eventTotalDays) {
    position = "none";
  } else if (isSameDay(itemStart, itemEnd)) {
    position = "none";
  } else if (isSameDay(cellDate, itemStart)) {
    position = "first";
  } else if (isSameDay(cellDate, itemEnd)) {
    position = "last";
  } else {
    position = "middle";
  }

  const renderBadgeText = ["first", "none"].includes(position);

  const color = (badgeVariant === "dot" ? `${event.color}-dot` : event.color) as VariantProps<typeof eventBadgeVariants>["color"];

  const eventBadgeClasses = cn(eventBadgeVariants({ color, multiDayPosition: position, className }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.click();
    }
  };

  return (
    <DraggableEvent event={event}>
      <EventDetailsDialog event={event}>
        <div role="button" tabIndex={0} className={eventBadgeClasses} onKeyDown={handleKeyDown}>
          <div className="flex items-center gap-1.5 truncate">
            {!["middle", "last"].includes(position) && ["mixed", "dot"].includes(badgeVariant) && (
              <svg width="8" height="8" viewBox="0 0 8 8" className="event-dot shrink-0">
                <circle cx="4" cy="4" r="4" />
              </svg>
            )}

            {renderBadgeText && (
              <p className="flex-1 truncate font-semibold">
                {eventCurrentDay && (
                  <span className="text-xs">
                    Day {eventCurrentDay} of {eventTotalDays} •{" "}
                  </span>
                )}
                {event.title}
              </p>
            )}
          </div>

          {renderBadgeText && <span>{format(new Date(event.startDate), "HH:mm")}</span>}
        </div>
      </EventDetailsDialog>
    </DraggableEvent>
  );
}
