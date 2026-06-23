import { Time } from "@internationalized/date";

import { SingleDayPicker } from "@/pages/admin/schedule/components/ui/single-day-picker";
import { TimeSelect } from "@/pages/admin/schedule/components/ui/time-select";

interface IProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
}

/**
 * Date + 24-hour time picker. Native `<input type="datetime-local">` renders
 * its time portion using the OS locale (often 12h AM/PM), which doesn't match
 * Norwegian 24h convention — so we compose an explicit date + 24h time select.
 */
export function DateTime24hField({ value, onChange, placeholder = "Select a date" }: IProps) {
  const time = value ? new Time(value.getHours(), value.getMinutes()) : null;

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const next = new Date(date);
    if (value) next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    else next.setHours(12, 0, 0, 0);
    onChange(next);
  };

  const handleTimeChange = (next?: Time) => {
    if (!next) return;
    const base = value ? new Date(value) : new Date();
    base.setHours(next.hour, next.minute, 0, 0);
    onChange(base);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <SingleDayPicker
        value={value ?? undefined}
        onSelect={handleDateSelect}
        placeholder={placeholder}
        labelVariant="PP"
        className="min-w-0"
      />
      <div className="w-[6.5rem] shrink-0">
        <TimeSelect value={time} onChange={handleTimeChange} />
      </div>
    </div>
  );
}
