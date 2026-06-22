import { useEffect, useState } from "react";
import { ArrowRight, CalendarPlus, Car } from "lucide-react";

import { Button } from "@/pages/admin/schedule/components/ui/button";
import { Input } from "@/pages/admin/schedule/components/ui/input";
import { Label } from "@/pages/admin/schedule/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/pages/admin/schedule/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/pages/admin/schedule/components/ui/select";

import type { ICalendarCar } from "@/pages/admin/schedule/calendar/interfaces";

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

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookCarDialog({ open, onOpenChange, cars, defaultCarId, defaultStart, onConfirm }: IProps) {
  const [carId, setCarId] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");

  useEffect(() => {
    if (!open) return;
    const start = defaultStart ? new Date(defaultStart) : new Date();
    start.setHours(start.getHours() + 2, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    setCarId(defaultCarId && cars.some((c) => c.id === defaultCarId) ? defaultCarId : "");
    setStartLocal(toLocalInput(start));
    setEndLocal(toLocalInput(end));
  }, [open, defaultCarId, defaultStart, cars]);

  const start = startLocal ? new Date(startLocal) : null;
  const end = endLocal ? new Date(endLocal) : null;
  const canSubmit = !!carId && !!start && !!end && end > start;

  const handleContinue = () => {
    if (!carId || !start || !end) return;
    onOpenChange(false);
    onConfirm(carId, start, end);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-5" />
            Book a car
          </DialogTitle>
          <DialogDescription>
            Pick the vehicle and period, then continue to select the customer and complete the booking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            <Select value={carId} onValueChange={setCarId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {cars.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No available vehicles</div>
                ) : (
                  cars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <Car className="size-3.5" />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Pickup</Label>
              <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Return</Label>
              <Input type="datetime-local" value={endLocal} min={startLocal} onChange={(e) => setEndLocal(e.target.value)} />
            </div>
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
