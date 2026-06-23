import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/pages/admin/schedule/components/ui/avatar";

import type { ICalendarCar } from "@/pages/admin/schedule/calendar/interfaces";

/** Shared search-filter state for the car pickers (Add Event, calendar filter, Mark unavailable). */
export function useCarSearch(cars: ICalendarCar[]) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cars;
    return cars.filter(
      (c) => c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q) || c.model.toLowerCase().includes(q)
    );
  }, [cars, query]);

  return { query, setQuery, filtered };
}

/** Sticky search box meant to sit at the top of a Select/dropdown's scroll area. */
export function CarSearchBox({
  value,
  onChange,
  placeholder = "Search vehicle…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="sticky -top-1 z-10 -mx-1 mb-1 bg-popover px-1 pb-2 pt-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={placeholder}
          className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}

/** Compact car avatar, used so every car dropdown looks consistent. */
export function CarThumbnail({ car, className = "size-6" }: { car: Pick<ICalendarCar, "name" | "image_url">; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={car.image_url ?? undefined} alt={car.name} className="object-cover" />
      <AvatarFallback className="text-xxs">{car.name[0]}</AvatarFallback>
    </Avatar>
  );
}

export function CarEmptyState({ text = "No vehicles found" }: { text?: string }) {
  return <p className="px-2 py-3 text-center text-sm text-muted-foreground">{text}</p>;
}
