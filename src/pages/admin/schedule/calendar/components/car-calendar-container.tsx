import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Clock, CheckCircle2, CarFront, CircleCheckBig } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { CalendarProvider, useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";
import { ClientContainer } from "@/pages/admin/schedule/calendar/components/client-container";
import { useCarCalendarData } from "@/pages/admin/schedule/calendar/data/use-car-calendar-data";
import { BookCarDialog } from "@/pages/admin/schedule/calendar/components/dialogs/book-car-dialog";
import { MarkUnavailableDialog } from "@/pages/admin/schedule/calendar/components/dialogs/mark-unavailable-dialog";

import { AdminBookOnBehalfDialog } from "@/components/admin/book-on-behalf/AdminBookOnBehalfDialog";

/**
 * Real-data wiring for the admin car-availability calendar. Replaces the
 * mock-fed CalendarProvider/ClientContainer in admin.tsx.
 *
 * Maps cars → calendar resources and bookings + unavailability blocks →
 * calendar events, and owns the booking / block / availability actions.
 */
export function CarCalendarContainer() {
  const { toast } = useToast();
  const { users, events, cars, loading, refetch } = useCarCalendarData();

  const [bookCarOpen, setBookCarOpen] = useState(false);
  const [bookSeed, setBookSeed] = useState<{ carId?: string; start?: Date }>({});

  const [markOpen, setMarkOpen] = useState(false);
  const [markSeed, setMarkSeed] = useState<{ carId?: string; start?: Date }>({});

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPrefill, setWizardPrefill] = useState<{ carId?: string; start?: Date; end?: Date }>({});

  const availableCars = useMemo(() => cars.filter((c) => c.is_available), [cars]);

  // ── Action handlers passed down through CalendarProvider ────────────────────
  const handleBookCar = (carId?: string, start?: Date) => {
    setBookSeed({ carId, start });
    setBookCarOpen(true);
  };

  const handleMarkUnavailable = (carId?: string, start?: Date) => {
    setMarkSeed({ carId, start });
    setMarkOpen(true);
  };

  const launchWizard = (carId: string, start: Date, end: Date) => {
    setWizardPrefill({ carId, start, end });
    setWizardOpen(true);
  };

  const handleToggleCarAvailability = async (carId: string, currentlyAvailable: boolean) => {
    try {
      const { error } = await supabase.from("cars").update({ is_available: !currentlyAvailable }).eq("id", carId);
      if (error) throw error;
      toast({
        title: "Success",
        description: `Car ${currentlyAvailable ? "disabled" : "enabled"} successfully`,
      });
      refetch();
    } catch (err) {
      console.error("Error updating car availability:", err);
      toast({ title: "Error", description: "Failed to update car availability", variant: "destructive" });
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
      if (error) throw error;
      toast({ title: "Booking cancelled", description: "The booking has been cancelled." });
      refetch();
    } catch (err) {
      console.error("Error cancelling booking:", err);
      toast({ title: "Error", description: "Failed to cancel booking", variant: "destructive" });
    }
  };

  const handleDeleteBlock = async (blockId: string, carId?: string) => {
    try {
      const { error } = await supabase.from("car_unavailability").delete().eq("id", blockId);
      if (error) throw error;

      // Removing the block also re-enables the car so it's bookable again.
      if (carId) {
        const { error: carError } = await supabase.from("cars").update({ is_available: true }).eq("id", carId);
        if (carError) console.error("Failed to re-enable car:", carError);
      }

      toast({ title: "Block removed", description: "The car is available again for that period." });
      refetch();
    } catch (err) {
      console.error("Error removing block:", err);
      toast({ title: "Error", description: "Failed to remove block", variant: "destructive" });
    }
  };

  return (
    <CalendarProvider
      users={users}
      events={events}
      defaultView="month"
      cars={cars}
      refetch={refetch}
      onBookCar={handleBookCar}
      onMarkUnavailable={handleMarkUnavailable}
      onToggleCarAvailability={handleToggleCarAvailability}
      onCancelBooking={handleCancelBooking}
      onDeleteBlock={handleDeleteBlock}
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="shrink-0">
          <AvailabilitySummary loading={loading} />
        </div>
        <div className="min-h-0 flex-1">
          <ClientContainer />
        </div>
      </div>

      <BookCarDialog
        open={bookCarOpen}
        onOpenChange={setBookCarOpen}
        cars={availableCars}
        defaultCarId={bookSeed.carId}
        defaultStart={bookSeed.start}
        onConfirm={launchWizard}
      />

      <MarkUnavailableDialog
        open={markOpen}
        onOpenChange={setMarkOpen}
        cars={cars}
        defaultCarId={markSeed.carId}
        defaultStart={markSeed.start}
        onCreated={refetch}
      />

      <AdminBookOnBehalfDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        prefillCarId={wizardPrefill.carId}
        prefillStart={wizardPrefill.start}
        prefillEnd={wizardPrefill.end}
        onBookingCreated={() => refetch()}
      />
    </CalendarProvider>
  );
}

// ── Per-day booking-status overview (req #1) ──────────────────────────────────

type BookingStatus = "pending" | "confirmed" | "active" | "completed";

function AvailabilitySummary({ loading }: { loading: boolean }) {
  const { events, selectedDate, view } = useCalendar();

  // Compute the visible range for the active view so the counters match what the
  // calendar body actually shows (day / week / month / agenda / year).
  const { rangeStart, rangeEnd } = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const date = selectedDate.getDate();

    if (view === "year") {
      return {
        rangeStart: new Date(year, 0, 1, 0, 0, 0, 0),
        rangeEnd: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }

    if (view === "month" || view === "agenda") {
      return {
        rangeStart: new Date(year, month, 1, 0, 0, 0, 0),
        rangeEnd: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
    }

    if (view === "week") {
      const start = new Date(selectedDate);
      start.setDate(date - selectedDate.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { rangeStart: start, rangeEnd: end };
    }

    // day view (and any fallback)
    return {
      rangeStart: new Date(year, month, date, 0, 0, 0, 0),
      rangeEnd: new Date(year, month, date, 23, 59, 59, 999),
    };
  }, [selectedDate, view]);

  const summary = useMemo(() => {
    const overlapsRange = (startISO: string, endISO: string) => {
      const s = parseISO(startISO);
      const e = parseISO(endISO);
      return s <= rangeEnd && e >= rangeStart;
    };

    const counts: Record<BookingStatus, number> = { pending: 0, confirmed: 0, active: 0, completed: 0 };
    let total = 0;
    for (const ev of events) {
      if (ev.kind !== "booking") continue;
      if (!overlapsRange(ev.startDate, ev.endDate)) continue;
      const status = ev.status as BookingStatus | undefined;
      if (status && status in counts) {
        counts[status] += 1;
        total += 1;
      }
    }
    return { counts, total };
  }, [events, rangeStart, rangeEnd]);

  const dateLabel = useMemo(() => {
    if (view === "year") {
      return selectedDate.toLocaleDateString(undefined, { year: "numeric" });
    }
    if (view === "month" || view === "agenda") {
      return selectedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    if (view === "week") {
      const startLabel = rangeStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const endLabel = rangeEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `${startLabel} – ${endLabel}`;
    }
    return selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }, [view, selectedDate, rangeStart, rangeEnd]);

  const stats: { key: BookingStatus; label: string; value: number; icon: typeof CheckCircle2; className: string }[] = [
    { key: "pending", label: "Pending", value: summary.counts.pending, icon: Clock, className: "text-yellow-700 bg-yellow-50 border-yellow-200" },
    { key: "confirmed", label: "Confirmed", value: summary.counts.confirmed, icon: CheckCircle2, className: "text-blue-600 bg-blue-50 border-blue-200" },
    { key: "active", label: "Active", value: summary.counts.active, icon: CarFront, className: "text-green-600 bg-green-50 border-green-200" },
    { key: "completed", label: "Completed", value: summary.counts.completed, icon: CircleCheckBig, className: "text-gray-600 bg-gray-100 border-gray-200" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5">
      <p className="shrink-0 whitespace-nowrap text-xs font-medium text-neutral-500">
        {loading ? "Loading bookings…" : `${summary.total} booking${summary.total === 1 ? "" : "s"} · ${dateLabel}`}
      </p>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
        {stats.map(({ key, label, value, icon: Icon, className }) => (
          <div
            key={key}
            title={`${label}: ${value}`}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${className}`}
          >
            <Icon className="size-3 shrink-0" />
            <span className="font-semibold">{value}</span>
            <span className="hidden opacity-80 sm:inline">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
