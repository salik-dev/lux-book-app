import { useEffect, useState } from "react";
import { ArrowRight, CalendarPlus } from "lucide-react";

import { Button } from "@/pages/admin/schedule/components/ui/button";
import { Label } from "@/pages/admin/schedule/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/pages/admin/schedule/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/pages/admin/schedule/components/ui/select";

import { DateTime24hField } from "@/pages/admin/schedule/calendar/components/ui/datetime-24h-field";
import { CarSearchBox, CarThumbnail, CarEmptyState, useCarSearch } from "@/pages/admin/schedule/calendar/components/ui/car-search-select";

import { isPickupLeadTimeValid, MIN_PICKUP_LEAD_HOURS } from "@/lib/booking-time";
import { useUnavailableCarIds } from "@/lib/car-availability";

import type { ICalendarCar } from "@/pages/admin/schedule/calendar/interfaces";

/** Compact monthly-rate label for the vehicle dropdown, e.g. "NOK 20 000/mo". */
const formatNokPerMonth = (amount: number) =>
  `${new Intl.NumberFormat("no-NO", { style: "currency", currency: "NOK", minimumFractionDigits: 0 }).format(amount)}/mo`;

interface IProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only bookable (available) cars should be passed in. */
  cars: ICalendarCar[];
  defaultCarId?: string;
  defaultStart?: Date;
  /** Hands the selection off to the book-on-behalf wizard. */
  onConfirm: (carId: string, start: Date, end: Date) => void;
}

export function BookCarDialog({ open, onOpenChange, cars, defaultCarId, defaultStart, onConfirm }: IProps) {
  const [carId, setCarId] = useState("");
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);

  const { query, setQuery, filtered } = useCarSearch(cars);

  // Disable vehicles already booked/blocked for the selected window, and drop a selection
  // that becomes unavailable after the dates change.
  const { unavailableIds } = useUnavailableCarIds(start, end);
  useEffect(() => {
    if (carId && unavailableIds.has(carId)) setCarId("");
  }, [carId, unavailableIds]);

  useEffect(() => {
    if (!open) return;
    const from = defaultStart ? new Date(defaultStart) : new Date();
    from.setHours(from.getHours() + 2, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    setCarId(defaultCarId && cars.some((c) => c.id === defaultCarId) ? defaultCarId : "");
    setStart(from);
    setEnd(to);
    setQuery("");
  }, [open, defaultCarId, defaultStart, cars, setQuery]);

  const pickupValid = isPickupLeadTimeValid(start);
  const canSubmit = !!carId && !!start && !!end && end > start && pickupValid;

  const handleContinue = () => {
    if (!carId || !start || !end) return;
    onOpenChange(false);
    onConfirm(carId, start, end);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-5" />
            Book a car
          </DialogTitle>
          <DialogDescription>
            Pick the vehicle and period, then continue to select the customer and complete the booking.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5 py-1">
          {/* Pickup / Return first — the vehicle list below reflects availability for this window. */}
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label>Pickup</Label>
              <DateTime24hField value={start} onChange={setStart} placeholder="Pickup date" />
              {start && !pickupValid && (
                <p className="text-xs text-red-600">
                  Pickup must be at least {MIN_PICKUP_LEAD_HOURS} hour from now.
                </p>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Return</Label>
              <DateTime24hField value={end} onChange={setEnd} placeholder="Return date" />
            </div>
          </div>

          <div className="min-w-0 space-y-1.5">
            <Label>Vehicle</Label>
            <Select value={carId} onValueChange={setCarId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vehicle" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <CarSearchBox value={query} onChange={setQuery} />
                {filtered.length === 0 ? (
                  <CarEmptyState text={cars.length === 0 ? "No available vehicles" : "No vehicles found"} />
                ) : (
                  filtered.map((c) => {
                    const booked = unavailableIds.has(c.id);
                    return (
                      <SelectItem key={c.id} value={c.id} disabled={booked}>
                        <span className="flex w-full items-center gap-2">
                          <CarThumbnail car={c} />
                          <span className="truncate">{c.name}</span>
                          {Number(c.base_price_per_month ?? 0) > 0 && !booked && (
                            <span className="ml-auto shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {formatNokPerMonth(Number(c.base_price_per_month))}
                            </span>
                          )}
                          {booked && (
                            <span className="ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Booked
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleContinue} disabled={!canSubmit}>
            Continue
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
