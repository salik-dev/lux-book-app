import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { CheckCircle2, CalendarClock, Ban, Power } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { CalendarProvider, useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";
import { ClientContainer } from "@/pages/admin/schedule/calendar/components/client-container";
import { useCarCalendarData } from "@/pages/admin/schedule/calendar/data/use-car-calendar-data";
import { BookCarDialog } from "@/pages/admin/schedule/calendar/components/dialogs/book-car-dialog";
import { MarkUnavailableDialog } from "@/pages/admin/schedule/calendar/components/dialogs/mark-unavailable-dialog";

import { AdminBookOnBehalfDialog } from "@/components/admin/book-on-behalf/AdminBookOnBehalfDialog";

import type { ICalendarCar } from "@/pages/admin/schedule/calendar/interfaces";

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

  const handleDeleteBlock = async (blockId: string) => {
    try {
      const { error } = await supabase.from("car_unavailability").delete().eq("id", blockId);
      if (error) throw error;
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
      <div className="flex flex-col gap-4">
        <AvailabilitySummary loading={loading} />
        <ClientContainer />
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

// ── Per-day availability overview (req #1) ────────────────────────────────────

type CarDayState = "available" | "booked" | "blocked" | "disabled";

function AvailabilitySummary({ loading }: { loading: boolean }) {
  const { cars, events, selectedDate, setSelectedUserId } = useCalendar();

  const summary = useMemo(() => {
    const list = cars ?? [];
    const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

    const overlapsDay = (startISO: string, endISO: string) => {
      const s = parseISO(startISO);
      const e = parseISO(endISO);
      return s <= dayEnd && e >= dayStart;
    };

    const blockedCarIds = new Set(
      events.filter((ev) => ev.kind === "block" && ev.carId && overlapsDay(ev.startDate, ev.endDate)).map((ev) => ev.carId!)
    );
    const bookedCarIds = new Set(
      events
        .filter((ev) => ev.kind === "booking" && ev.carId && ev.status !== "completed" && overlapsDay(ev.startDate, ev.endDate))
        .map((ev) => ev.carId!)
    );

    const counts: Record<CarDayState, number> = { available: 0, booked: 0, blocked: 0, disabled: 0 };
    for (const car of list) {
      let state: CarDayState;
      if (!car.is_available) state = "disabled";
      else if (blockedCarIds.has(car.id)) state = "blocked";
      else if (bookedCarIds.has(car.id)) state = "booked";
      else state = "available";
      counts[state] += 1;
    }
    return { counts, total: list.length };
  }, [cars, events, selectedDate]);

  const dateLabel = selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  const stats: { key: CarDayState; label: string; value: number; icon: typeof CheckCircle2; className: string }[] = [
    { key: "available", label: "Available", value: summary.counts.available, icon: CheckCircle2, className: "text-green-600 bg-green-50 border-green-200" },
    { key: "booked", label: "Booked", value: summary.counts.booked, icon: CalendarClock, className: "text-blue-600 bg-blue-50 border-blue-200" },
    { key: "blocked", label: "Unavailable", value: summary.counts.blocked, icon: Ban, className: "text-orange-600 bg-orange-50 border-orange-200" },
    { key: "disabled", label: "Disabled", value: summary.counts.disabled, icon: Power, className: "text-gray-600 bg-gray-100 border-gray-200" },
  ];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-800">Fleet availability</p>
          <p className="text-xs text-neutral-500">
            {loading ? "Loading…" : `${summary.total} vehicle${summary.total === 1 ? "" : "s"} · ${dateLabel}`}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(({ key, label, value, icon: Icon, className }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedUserId("all")}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${className}`}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-base font-semibold">{value}</span>
              <span className="text-xs opacity-80">{label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
