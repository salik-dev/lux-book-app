import { useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/pages/admin/schedule/components/ui/select";

import type { TBookingStatusFilter } from "@/pages/admin/schedule/calendar/contexts/calendar-context";

/** Dot colors mirror the booking status colors used on calendar events. */
const STATUS_OPTIONS: { value: TBookingStatusFilter; label: string; dot: string }[] = [
  { value: "all", label: "All statuses", dot: "bg-neutral-400" },
  { value: "pending", label: "Pending", dot: "bg-amber-400" },
  { value: "confirmed", label: "Confirmed", dot: "bg-blue-500" },
  { value: "active", label: "Active", dot: "bg-emerald-500" },
  { value: "completed", label: "Completed", dot: "bg-neutral-400" },
];

export function StatusSelect() {
  const { selectedStatus, setSelectedStatus } = useCalendar();
  const current = STATUS_OPTIONS.find(o => o.value === selectedStatus) ?? STATUS_OPTIONS[0];

  return (
    <Select value={selectedStatus} onValueChange={v => setSelectedStatus(v as TBookingStatusFilter)}>
      <SelectTrigger className="w-full sm:w-40" aria-label="Filter by booking status">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${current.dot}`} />
            <span className="truncate">{current.label}</span>
          </span>
        </SelectValue>
      </SelectTrigger>

      <SelectContent align="end">
        {STATUS_OPTIONS.map(o => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2">
              <span className={`size-2 shrink-0 rounded-full ${o.dot}`} />
              <span>{o.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
