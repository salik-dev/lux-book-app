import { forwardRef } from "react";
import { Time } from "@internationalized/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/pages/admin/schedule/components/ui/select";
import { cn } from "@/pages/admin/schedule/lib/utils";

// ================================== //

type TTimeSelectRef = HTMLButtonElement;
type TTimeSelectProps = {
  readonly value?: Time | null;
  readonly onChange?: (time?: Time) => void;
  readonly disabled?: boolean;
  readonly "data-invalid"?: boolean;
  readonly className?: string;
};

// Generate 24-hour time options (00:00 - 23:45)
const generateTimeOptions = () => {
  const times: Array<{ label: string; value: string }> = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const hourStr = String(hour).padStart(2, "0");
      const minuteStr = String(minute).padStart(2, "0");
      const timeStr = `${hourStr}:${minuteStr}`;
      times.push({ label: timeStr, value: timeStr });
    }
  }
  return times;
};

const TIME_OPTIONS = generateTimeOptions();

const TimeSelect = forwardRef<TTimeSelectRef, TTimeSelectProps>(
  ({ value, onChange, disabled, "data-invalid": dataInvalid, className }, ref) => {
    const timeString = value ? `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}` : "";

    const handleSelect = (timeStr: string) => {
      const [hourStr, minuteStr] = timeStr.split(":");
      const newTime = new Time(parseInt(hourStr), parseInt(minuteStr));
      onChange?.(newTime);
    };

    return (
      <Select value={timeString} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger
          ref={ref}
          data-invalid={dataInvalid}
          className={cn("h-9 w-full rounded-md border bg-background px-3 py-2 text-sm", className)}
        >
          <SelectValue placeholder="Select time" />
        </SelectTrigger>

        <SelectContent className="max-h-64">
          {TIME_OPTIONS.map(({ label, value }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
);

TimeSelect.displayName = "TimeSelect";

// ================================== //

export { TimeSelect };
