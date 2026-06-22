import { useEffect, useState } from "react";
import { Ban, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

import { Button } from "@/pages/admin/schedule/components/ui/button";
import { Input } from "@/pages/admin/schedule/components/ui/input";
import { Label } from "@/pages/admin/schedule/components/ui/label";
import { Textarea } from "@/pages/admin/schedule/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/pages/admin/schedule/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/pages/admin/schedule/components/ui/select";

import type { ICalendarCar } from "@/pages/admin/schedule/calendar/interfaces";

interface IProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cars: ICalendarCar[];
  defaultCarId?: string;
  defaultStart?: Date;
  onCreated?: () => void;
}

// `YYYY-MM-DDTHH:mm` in local time for <input type="datetime-local" />.
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MarkUnavailableDialog({ open, onOpenChange, cars, defaultCarId, defaultStart, onCreated }: IProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [carId, setCarId] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    const start = defaultStart ? new Date(defaultStart) : new Date();
    start.setHours(start.getHours() + 1, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    setCarId(defaultCarId ?? "");
    setStartLocal(toLocalInput(start));
    setEndLocal(toLocalInput(end));
    setReason("");
  }, [open, defaultCarId, defaultStart]);

  const start = startLocal ? new Date(startLocal) : null;
  const end = endLocal ? new Date(endLocal) : null;
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

      toast({ title: "Marked unavailable", description: "The car is blocked for the selected period." });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="size-5 text-orange-500" />
            Mark a car unavailable
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            <Select value={carId} onValueChange={setCarId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {cars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.is_available ? "" : " (disabled)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="datetime-local" value={endLocal} min={startLocal} onChange={(e) => setEndLocal(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Maintenance, detailing, reserved for event…"
              rows={3}
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
