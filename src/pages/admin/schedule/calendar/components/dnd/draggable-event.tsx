// Drag-and-drop is disabled for now. The react-dnd wiring below is kept commented out
// so it can be re-enabled later without reconstructing it.
// import { useDrag } from "react-dnd";
// import { useRef, useEffect } from "react";
// import { getEmptyImage } from "react-dnd-html5-backend";

// import { cn } from "@/pages/admin/schedule/lib/utils";

import type { IEvent } from "@/pages/admin/schedule/calendar/interfaces";

export const ItemTypes = {
  EVENT: "event",
};

interface DraggableEventProps {
  event: IEvent;
  children: React.ReactNode;
}

export function DraggableEvent({ children }: DraggableEventProps) {
  return <div>{children}</div>;

  // Previous drag-enabled implementation:
  // const ref = useRef<HTMLDivElement>(null);
  //
  // const [{ isDragging }, drag, preview] = useDrag(() => ({
  //   type: ItemTypes.EVENT,
  //   item: () => {
  //     const width = ref.current?.offsetWidth || 0;
  //     const height = ref.current?.offsetHeight || 0;
  //     return { event, children, width, height };
  //   },
  //   collect: monitor => ({ isDragging: monitor.isDragging() }),
  // }));
  //
  // // Hide the default drag preview
  // useEffect(() => {
  //   preview(getEmptyImage(), { captureDraggingState: true });
  // }, [preview]);
  //
  // drag(ref);
  //
  // return (
  //   <div ref={ref} className={cn(isDragging && "opacity-40")}>
  //     {children}
  //   </div>
  // );
}
