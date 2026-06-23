import { useEffect, useState } from "react";
import { Ban, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

import { Button } from "@/pages/admin/schedule/components/ui/button";
import { Label } from "@/pages/admin/schedule/components/ui/label";
import { Textarea } from "@/pages/admin/schedule/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/pages/admin/schedule/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/pages/admin/schedule/components/ui/select";

import { DateTime24hField } from "@/pages/admin/schedule/calendar/components/ui/datetime-24h-field";
import { CarSearchBox, CarThumbnail, CarEmptyState, useCarSearch } from "@/pages/admin/schedule/calendar/components/ui/car-search-select";

import type { ICalendarCar } from "@/pages/admin/schedule/calendar/interfaces";

interface IProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cars: ICalendarCar[];
  defaultCarId?: string;
  defaultStart?: Date;
  onCreated?: () => void;
}

export function MarkUnavailableDialog({ open, onOpenChange, cars, defaultCarId, defaultStart, onCreated }: IProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [carId, setCarId] = useState("");
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const { query, setQuery, filtered } = useCarSearch(cars);

  // Seed the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    const from = defaultStart ? new Date(defaultStart) : new Date();
    from.setHours(from.getHours() + 1, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    setCarId(defaultCarId ?? "");
    setStart(from);
    setEnd(to);
    setReason("");
    setQuery("");
  }, [open, defaultCarId, defaultStart, setQuery]);

  const canSubmit = !!carId && !!start && !!end && end > start && !saving;

  const handleSubmit = async () => {
    if (!carId || !start || !end) return;
    if (end <= start) {
      toast({ title: "Invalid period", description: "End must be after start.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("car_unavailability").insert({
        car_id: carId,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        reason: reason.trim() || null,
        created_by: user?.id ?? null,
      });

      if (error) throw error;

      // Marking a block also takes the car off the available fleet until an
      // admin explicitly re-enables it.
      const { error: carError } = await supabase.from("cars").update({ is_available: false }).eq("id", carId);
      if (carError) console.error("Failed to flag car unavailable:", carError);

      toast({ title: "Marked unavailable", description: "The car is blocked for the selected period and set to unavailable." });
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error("Failed to mark car unavailable:", err);
      toast({
        title: "Failed to mark unavailable",
        description: err instanceof Error ? err.message : "Unknown error. Has the migration been applied?",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="size-5 text-orange-500" />
            Mark a car unavailable
          </DialogTitle>
          <DialogDescription>Block this vehicle for a period — it will be hidden from new bookings until re-enabled.</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="min-w-0 space-y-1.5">
            <Label>Vehicle</Label>
            <Select value={carId} onValueChange={setCarId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vehicle" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <CarSearchBox value={query} onChange={setQuery} />
                {filtered.length === 0 ? (
                  <CarEmptyState />
                ) : (
                  filtered.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={!c.is_available}>
                      <span className="flex w-full items-center gap-2">
                        <CarThumbnail car={c} />
                        <span className="truncate">{c.name}</span>
                        {!c.is_available && (
                          <span className="ml-auto shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                            Disabled
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label>From</Label>
              <DateTime24hField value={start} onChange={setStart} placeholder="Start date" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>To</Label>
              <DateTime24hField value={end} onChange={setEnd} placeholder="End date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Maintenance, detailing, reserved for event…"
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
            Mark unavailable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
