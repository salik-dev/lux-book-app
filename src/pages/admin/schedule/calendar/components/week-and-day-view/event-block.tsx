import { cva } from "class-variance-authority";
import { format, differenceInMinutes, parseISO } from "date-fns";

import { useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";

import { DraggableEvent } from "@/pages/admin/schedule/calendar/components/dnd/draggable-event";
import { EventDetailsDialog } from "@/pages/admin/schedule/calendar/components/dialogs/event-details-dialog";

import { cn } from "@/pages/admin/schedule/lib/utils";

import type { HTMLAttributes } from "react";
import type { IEvent } from "@/pages/admin/schedule/calendar/interfaces";
import type { VariantProps } from "class-variance-authority";

const calendarWeekEventCardVariants = cva(
  "flex cursor-pointer select-none flex-col gap-0.5 truncate whitespace-nowrap rounded-md border px-2 py-1.5 text-xs transition-shadow duration-150 hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      color: {
        // Colored and mixed variants with transparent backgrounds (light theme only)
        blue: "border-blue-300 bg-blue-100/50 text-blue-700 [&_.event-dot]:fill-blue-600 hover:bg-blue-200/90",
        green: "border-green-300 bg-green-100/50 text-green-700 [&_.event-dot]:fill-green-600 hover:bg-green-200/90",
        red: "border-red-300 bg-red-100/50 text-red-700 [&_.event-dot]:fill-red-600 hover:bg-red-200/90",
        yellow: "border-yellow-300 bg-yellow-100/50 text-yellow-700 [&_.event-dot]:fill-yellow-600 hover:bg-yellow-200/90",
        purple: "border-purple-300 bg-purple-100/50 text-purple-700 [&_.event-dot]:fill-purple-600 hover:bg-purple-200/90",
        orange: "border-orange-300 bg-orange-100/50 text-orange-700 [&_.event-dot]:fill-orange-600 hover:bg-orange-200/90",
        gray: "border-neutral-300 bg-neutral-100/50 text-neutral-700 [&_.event-dot]:fill-neutral-600 hover:bg-neutral-200/90",

        // Dot variants with transparent backgrounds (light theme only)
        "blue-dot": "border-blue-200 bg-blue-100/40 text-blue-700 [&_.event-dot]:fill-blue-600 hover:bg-blue-200/80",
        "green-dot": "border-green-200 bg-green-100/40 text-green-700 [&_.event-dot]:fill-green-600 hover:bg-green-200/80",
        "red-dot": "border-red-200 bg-red-100/40 text-red-700 [&_.event-dot]:fill-red-600 hover:bg-red-200/80",
        "orange-dot": "border-orange-200 bg-orange-100/40 text-orange-700 [&_.event-dot]:fill-orange-600 hover:bg-orange-200/80",
        "purple-dot": "border-purple-200 bg-purple-100/40 text-purple-700 [&_.event-dot]:fill-purple-600 hover:bg-purple-200/80",
        "yellow-dot": "border-yellow-200 bg-yellow-100/40 text-yellow-700 [&_.event-dot]:fill-yellow-600 hover:bg-yellow-200/80",
        "gray-dot": "border-neutral-200 bg-neutral-100/40 text-neutral-700 [&_.event-dot]:fill-neutral-600 hover:bg-neutral-200/80",
      },
    },
    defaultVariants: {
      color: "blue-dot",
    },
  }
);

interface IProps extends HTMLAttributes<HTMLDivElement>, Omit<VariantProps<typeof calendarWeekEventCardVariants>, "color"> {
  event: IEvent;
}

export function EventBlock({ event, className }: IProps) {
  const { badgeVariant } = useCalendar();

  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const durationInMinutes = differenceInMinutes(end, start);
  const heightInPixels = (durationInMinutes / 60) * 96 - 8;

  const color = (badgeVariant === "dot" ? `${event.color}-dot` : event.color) as VariantProps<typeof calendarWeekEventCardVariants>["color"];

  const calendarWeekEventCardClasses = cn(calendarWeekEventCardVariants({ color, className }), durationInMinutes < 35 && "py-0 justify-center");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.click();
    }
  };

  return (
    <DraggableEvent event={event}>
      <EventDetailsDialog event={event}>
        <div role="button" tabIndex={0} className={calendarWeekEventCardClasses} style={{ height: `${heightInPixels}px` }} onKeyDown={handleKeyDown}>
          <div className="flex items-center gap-1.5 truncate">
            {["mixed", "dot"].includes(badgeVariant) && (
              <svg width="8" height="8" viewBox="0 0 8 8" className="event-dot shrink-0">
                <circle cx="4" cy="4" r="4" />
              </svg>
            )}

            <p className="truncate font-semibold">{event.title}</p>
          </div>

          {durationInMinutes > 25 && (
            <p>
              {format(start, "HH:mm")} - {format(end, "HH:mm")}
            </p>
          )}
        </div>
      </EventDetailsDialog>
    </DraggableEvent>
  );
}
