import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Ban, Calendar, Car, Clock, CreditCard, Loader2, Text, Trash2, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/pages/admin/schedule/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/pages/admin/schedule/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/pages/admin/schedule/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/pages/admin/schedule/components/ui/tooltip";

import { useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";
import { IEvent } from "../../interfaces";
import { EditEventDialog } from "./edit-event-dialog";

interface IProps {
  event: IEvent;
  children: React.ReactNode;
}

const BOOKING_STATUSES = ["pending", "confirmed", "active", "completed", "cancelled"] as const;

function formatNOK(amount: number) {
  return new Intl.NumberFormat("no-NO", { style: "currency", currency: "NOK", minimumFractionDigits: 0 }).format(amount);
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-1 size-4 shrink-0" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

export function EventDetailsDialog({ event, children }: IProps) {
  const { onCancelBooking, onDeleteBlock, refetch } = useCalendar();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);

  const isBooking = event.kind === "booking";
  const isBlock = event.kind === "block";

  const handleStatusChange = async (status: string) => {
    if (!event.referenceId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bookings").update({ status: status as (typeof BOOKING_STATUSES)[number] }).eq("id", event.referenceId);
      if (error) throw error;
      toast({ title: "Status updated", description: `Booking is now ${status}.` });
      refetch?.();
      setOpen(false);
    } catch (err) {
      console.error("Failed to update booking status:", err);
      toast({ title: "Error", description: "Failed to update booking status", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>{children}</DialogTrigger>
        </TooltipTrigger>

        <TooltipContent side="top" className="space-y-0.5">
          <p className="font-semibold">{event.title}</p>
          <p className="text-[#1a1208]/70">
            {format(startDate, "MMM d, HH:mm")} - {format(endDate, "HH:mm")}
          </p>
          <p className="text-[#1a1208]/70">{event.user.name}</p>
        </TooltipContent>
      </Tooltip>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isBlock ? "Unavailable period" : event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <InfoRow icon={Car} label="Vehicle" value={event.user.name} />

          {isBooking && event.meta?.customerName && (
            <InfoRow
              icon={User}
              label="Customer"
              value={
                <>
                  {event.meta.customerName}
                  {event.meta.customerEmail ? <span className="block text-xs">{event.meta.customerEmail}</span> : null}
                </>
              }
            />
          )}

          <InfoRow icon={Calendar} label="Start" value={format(startDate, "MMM d, yyyy HH:mm")} />
          <InfoRow icon={Clock} label="End" value={format(endDate, "MMM d, yyyy HH:mm")} />

          {isBooking && typeof event.meta?.total === "number" && (
            <InfoRow icon={CreditCard} label="Total" value={formatNOK(event.meta.total)} />
          )}

          {isBlock && (
            <InfoRow icon={Text} label="Reason" value={event.meta?.reason || "Marked unavailable"} />
          )}

          {!isBooking && !isBlock && (
            <InfoRow icon={Text} label="Description" value={event.description} />
          )}

          {isBooking && (
            <div className="flex items-start gap-2">
              <CreditCard className="mt-1 size-4 shrink-0" />
              <div className="flex-1">
                <p className="mb-1 text-sm font-medium">Status</p>
                <Select value={event.status ?? "pending"} onValueChange={handleStatusChange} disabled={busy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {isBooking && event.referenceId && onCancelBooking && event.status !== "cancelled" && (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                onCancelBooking(event.referenceId!);
                setOpen(false);
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              Cancel booking
            </Button>
          )}

          {isBlock && event.referenceId && onDeleteBlock && (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                onDeleteBlock(event.referenceId!, event.carId);
                setOpen(false);
              }}
            >
              <Trash2 className="size-4" />
              Remove block
            </Button>
          )}

          {!isBooking && !isBlock && (
            <EditEventDialog event={event}>
              <Button type="button" variant="outline">
                Edit
              </Button>
            </EditEventDialog>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
