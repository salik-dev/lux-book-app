// Drag-and-drop is disabled for now. The react-dnd wiring below is kept commented out
// so it can be re-enabled later without reconstructing it.
// import { useDrop } from "react-dnd";
// import { parseISO, differenceInMilliseconds } from "date-fns";

// import { useUpdateEvent } from "@/pages/admin/schedule/calendar/hooks/use-update-event";

// import { cn } from "@/pages/admin/schedule/lib/utils";
// import { ItemTypes } from "@/pages/admin/schedule/calendar/components/dnd/draggable-event";

import type { IEvent } from "@/pages/admin/schedule/calendar/interfaces";

interface DroppableTimeBlockProps {
  date: Date;
  hour: number;
  minute: number;
  children: React.ReactNode;
}

export function DroppableTimeBlock({ children }: DroppableTimeBlockProps) {
  return <div className="h-[24px]">{children}</div>;

  // Previous drop-enabled implementation:
  // const { updateEvent } = useUpdateEvent();
  //
  // const [{ isOver, canDrop }, drop] = useDrop(
  //   () => ({
  //     accept: ItemTypes.EVENT,
  //     drop: (item: { event: IEvent }) => {
  //       const droppedEvent = item.event;
  //
  //       const eventStartDate = parseISO(droppedEvent.startDate);
  //       const eventEndDate = parseISO(droppedEvent.endDate);
  //
  //       const eventDurationMs = differenceInMilliseconds(eventEndDate, eventStartDate);
  //
  //       const newStartDate = new Date(date);
  //       newStartDate.setHours(hour, minute, 0, 0);
  //       const newEndDate = new Date(newStartDate.getTime() + eventDurationMs);
  //
  //       updateEvent({
  //         ...droppedEvent,
  //         startDate: newStartDate.toISOString(),
  //         endDate: newEndDate.toISOString(),
  //       });
  //
  //       return { moved: true };
  //     },
  //     collect: monitor => ({
  //       isOver: monitor.isOver(),
  //       canDrop: monitor.canDrop(),
  //     }),
  //   }),
  //   [date, hour, minute, updateEvent]
  // );
  //
  // return (
  //   <div ref={drop as unknown as React.RefObject<HTMLDivElement>} className={cn("h-[24px]", isOver && canDrop && "bg-accent/50")}>
  //     {children}
  //   </div>
  // );
}
