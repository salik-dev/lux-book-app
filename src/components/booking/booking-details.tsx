import React, { useEffect, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { format, addDays, addHours, differenceInHours } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  Car,
  MapPin,
  Check,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { FormItem, FormLabel, FormMessage, FormField, FormControl } from "../ui/form";
import { Button } from "../ui/button";
import { BookingData, CarData, SeatPricingMode } from "@/@types/data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import defaultImg from "../../assets/luxury-car-collection-garage-premium.jpg";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "@/lib/utils";
import { isPickupLeadTimeValid, MIN_PICKUP_LEAD_HOURS } from "@/lib/booking-time";
import { VehicleSwitcher } from "./vehicle-switcher";
import { calculateBookingPricing } from "@shared/booking-pricing";
import { calendarDuration, formatAgreedDuration } from "@shared/contract/format";
import { naiveToOsloInstant, osloInstantToNaive } from "@/lib/oslo-time";
import { useUnavailableCarIds } from "@/lib/car-availability";

/** This browser's own in-progress hold (so it never disables its own selected vehicle). */
function readOwnBookingId(): string | null {
  try {
    const raw = localStorage.getItem("booking_request_state");
    return raw ? (JSON.parse(raw) as { bookingId?: string })?.bookingId ?? null : null;
  } catch {
    return null;
  }
}

/** Fixed demo locations (Norway) — always applied to the booking. */
const DEFAULT_PICKUP_LOCATION = "Karl Johans gate 1, 0154 Oslo";
const DEFAULT_DELIVERY_LOCATION = "Oslo lufthavn Gardermoen, 2060 Gardermoen";

const bookingTimeSelectContentClass =
  "notranslate border-[#46555d] bg-[#232e33] text-[#b1bdc3] max-h-[min(240px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-y-auto p-1 shadow-xl " +
  "[scrollbar-color:#6b7280_transparent] [scrollbar-width:thin] " +
  "[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#6b7280] [&::-webkit-scrollbar-track]:bg-transparent";

const bookingTimeSelectTriggerClass =
  "h-9 w-[88px] shrink-0 justify-between gap-1 border-[#46555d] bg-[#1b2529] px-2 text-[#b1bdc3] shadow-none hover:bg-[#27343a] " +
  "focus-visible:border-[#E3C08D] focus-visible:ring-1 focus-visible:ring-[#E3C08D]/60 data-[size=default]:h-9 [&_svg]:text-[#9aa8ae]";

/** Keep calendar popover open when using portaled Select lists (hour/minute). */
function bookingDatePopoverOnInteractOutside(e: { preventDefault: () => void; target: EventTarget | null }) {
  const el = e.target as HTMLElement | null;
  if (
    el?.closest?.('[data-slot="select-content"]') ||
    el?.closest?.("[data-radix-select-content]")
  ) {
    e.preventDefault();
  }
}

function BookingDateTimeTimeRow({
  dateValue,
  onTimeChange,
}: {
  dateValue: Date | undefined;
  onTimeChange: (next: Date) => void;
}) {
  const base = dateValue instanceof Date ? new Date(dateValue) : new Date();
  const hours = dateValue instanceof Date ? base.getHours() : 0;
  const minutes = dateValue instanceof Date ? base.getMinutes() : 0;

  const apply = (h: number, m: number) => {
    const next = dateValue instanceof Date ? new Date(dateValue) : new Date();
    next.setHours(h);
    next.setMinutes(m);
    onTimeChange(next);
  };

  return (
    <div
      className="notranslate flex items-center justify-between gap-3 border-t border-[#3f4d54] bg-[#232e33] px-3 py-2.5"
      translate="no"
      role="group"
      aria-label="Time"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-[#9aa8ae]" aria-hidden>
        Time
      </span>
      <div className="flex items-center gap-1.5">
        <Select
          value={String(hours)}
          onValueChange={(v) => apply(parseInt(v, 10), minutes)}
        >
          <SelectTrigger className={bookingTimeSelectTriggerClass} size="default">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent
            className={bookingTimeSelectContentClass}
            translate="no"
            position="popper"
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={8}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <SelectItem
                key={i}
                value={String(i)}
                className="text-[#b1bdc3] focus:text-[#1b2529] data-[state=checked]:text-[#1b2529]"
              >
                {String(i).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-[#7f8d93]" aria-hidden>
          :
        </span>
        <Select
          value={String(minutes)}
          onValueChange={(v) => apply(hours, parseInt(v, 10))}
        >
          <SelectTrigger className={bookingTimeSelectTriggerClass} size="default">
            <SelectValue placeholder="mm" />
          </SelectTrigger>
          <SelectContent
            className={bookingTimeSelectContentClass}
            translate="no"
            position="popper"
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={8}
          >
            {Array.from({ length: 60 }, (_, i) => (
              <SelectItem
                key={i}
                value={String(i)}
                className="text-[#b1bdc3] focus:text-[#1b2529] data-[state=checked]:text-[#1b2529]"
              >
                {String(i).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Create a wrapper component that properly uses FormProvider
const Form = ({ children, form, onSubmit }: {
  children: React.ReactNode;
  form: any;
  onSubmit: (data: any) => void;
}) => (
  <FormProvider {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {children}
    </form>
  </FormProvider>
);


interface BookingDetailsProps {
  car: CarData;
  onComplete: (data: BookingData) => void;
  /** Switch vehicle in place; dates and preferences already entered are kept. */
  onCarChange?: (car: CarData) => void;
  initialData?: BookingData;
}

interface FormData {
  startDateTime: Date;
  endDateTime: Date;
  startTime: string;
  endTime: string;
  seatPricingMode: SeatPricingMode;
  decorationFlowers: boolean;
  decorationRibbon: boolean;
  decorationRedCarpets: boolean;
  decorationDriverNeed: boolean;
}

export const BookingDetails: React.FC<BookingDetailsProps> = ({
  car,
  onComplete,
  onCarChange,
  initialData,
}) => {
  // const { t } = useTranslation();
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  /** Once the customer explicitly picks a pricing mode, stop auto-switching it as dates change. */
  const [pricingModeTouched, setPricingModeTouched] = useState(Boolean(initialData?.seatPricingMode));

  const form = useForm<FormData>({
    defaultValues: {
      startDateTime: initialData ? osloInstantToNaive(new Date(initialData.startDateTime)) : addHours(new Date(), 2),
      endDateTime: initialData ? osloInstantToNaive(new Date(initialData.endDateTime)) : addDays(new Date(), 1),
      startTime: "10:00",
      endTime: "10:00",
      seatPricingMode: initialData?.seatPricingMode ?? "flat-rate",
      decorationFlowers: initialData?.decorationFlowers ?? false,
      decorationRibbon: initialData?.decorationRibbon ?? false,
      decorationRedCarpets: initialData?.decorationRedCarpets ?? false,
      decorationDriverNeed: initialData?.decorationDriverNeed ?? false,
    },
    mode: "onChange",
  });

  const watchedValues = form.watch();

  // The pickers work in naive wall-clock (the numbers the customer sees); those numbers are
  // interpreted as Oslo time whenever an exact instant is needed (pricing, availability, the
  // duration shown everywhere, and what we persist). See src/lib/oslo-time.ts.
  const datesValid =
    watchedValues.startDateTime instanceof Date &&
    watchedValues.endDateTime instanceof Date &&
    !isNaN(watchedValues.startDateTime.getTime()) &&
    !isNaN(watchedValues.endDateTime.getTime());
  const osloStart = datesValid ? naiveToOsloInstant(watchedValues.startDateTime) : null;
  const osloEnd = datesValid ? naiveToOsloInstant(watchedValues.endDateTime) : null;

  // "Per month" is only offered for vehicles that have a monthly rate set...
  const monthlyAvailable = Number(car.base_price_per_month ?? 0) > 0;
  // ...and only once the rental spans at least one full calendar month, which is also the
  // unit the monthly price bills in. It stays disabled until then.
  const monthlyCal = osloStart && osloEnd ? calendarDuration(osloStart, osloEnd) : null;
  const monthlyEligible =
    monthlyAvailable && !!monthlyCal && monthlyCal.years * 12 + monthlyCal.months >= 1;

  // Fall back to daily if monthly was selected but is no longer eligible — i.e. the customer
  // switched to a car without a monthly rate, or shortened the rental below one month.
  useEffect(() => {
    if (!monthlyEligible && form.getValues("seatPricingMode") === "monthly-basis") {
      form.setValue("seatPricingMode", "daily-basis");
    }
  }, [monthlyEligible, form]);

  // Disable vehicles already booked/blocked for the chosen pickup/return window.
  const { unavailableIds } = useUnavailableCarIds(
    osloStart ?? watchedValues.startDateTime,
    osloEnd ?? watchedValues.endDateTime,
    readOwnBookingId(),
  );

  // Surface an already-booked conflict for the *selected* vehicle here in step 1, instead of only
  // discovering it at the contract step (where the server creates the booking). This is a
  // best-effort early check; create-booking remains authoritative.
  const selectedCarUnavailable = unavailableIds.has(String(car.id));

  // Persist values when navigating back by resetting with initialData
  useEffect(() => {
    if (initialData) {
      form.reset({
        startDateTime: osloInstantToNaive(new Date(initialData.startDateTime)),
        endDateTime: osloInstantToNaive(new Date(initialData.endDateTime)),
        startTime: "10:00",
        endTime: "10:00",
        seatPricingMode: initialData.seatPricingMode ?? "flat-rate",
        decorationFlowers: initialData.decorationFlowers ?? false,
        decorationRibbon: initialData.decorationRibbon ?? false,
        decorationRedCarpets: initialData.decorationRedCarpets ?? false,
        decorationDriverNeed: initialData.decorationDriverNeed ?? false,
      });
      if (initialData.seatPricingMode) setPricingModeTouched(true);
    }
  }, [initialData, form]);

  // Until the customer picks a pricing mode explicitly, keep it in sync with the
  // duration-based rule this form used before the radio existed (<=24h => hourly).
  useEffect(() => {
    if (pricingModeTouched) return;
    const start = watchedValues.startDateTime;
    const end = watchedValues.endDateTime;
    if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start.getTime()) || isNaN(end.getTime())) {
      return;
    }
    const totalHours = Math.max(1, differenceInHours(end, start));
    const autoMode: SeatPricingMode = totalHours <= 24 ? "flat-rate" : "daily-basis";
    if (form.getValues("seatPricingMode") !== autoMode) {
      form.setValue("seatPricingMode", autoMode);
    }
  }, [watchedValues.startDateTime, watchedValues.endDateTime, pricingModeTouched, form]);

  // Calculate pricing from the picked dates, interpreted as Oslo time.
  const calculatePricing = () => {
    if (!osloStart || !osloEnd) {
      return {
        basePrice: 0,
        deliveryFee: 0,
        depositAmount: 0,
        totalPrice: 0,
        duration: "—",
      };
    }

    // Same calculation the server uses when it creates the booking (create-booking).
    const result = calculateBookingPricing({
      car,
      start: osloStart,
      end: osloEnd,
      mode: watchedValues.seatPricingMode ?? "flat-rate",
      withDriver: Boolean(watchedValues.decorationDriverNeed),
      deliveryFee,
    });

    return {
      basePrice: result.basePrice,
      deliveryFee: result.deliveryFee,
      depositAmount: result.depositAmount,
      driverSurcharge: result.driverSurcharge,
      totalPrice: result.totalPrice,
      duration: formatAgreedDuration(osloStart, osloEnd),
    };
  };

  const pricing = calculatePricing();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("no-NO", {
      style: "currency",
      currency: "NOK",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const checkCarAvailability = async (carId: string, startDateTime: Date, endDateTime: Date) => {
    const startIso = startDateTime.toISOString();
    const endIso = endDateTime.toISOString();
    const nowIso = new Date().toISOString();

    // Don't let this browser's own in-progress hold (created when it previously reached the
    // payment step) count against it when the customer steps back and re-submits. The server
    // supersedes it by key; here we just skip it so step 1 doesn't show a false "already booked".
    let ownBookingId: string | null = null;
    try {
      // Mirror of BOOKING_REQUEST_KEY in src/lib/booking-storage-keys.ts.
      const raw = localStorage.getItem("booking_request_state");
      if (raw) ownBookingId = (JSON.parse(raw) as { bookingId?: string })?.bookingId ?? null;
    } catch {
      ownBookingId = null;
    }

    try {
      // Mirrors the server's create-booking conflict check (_shared/availability.ts) so a car
      // that is already taken is caught here, at date selection, instead of later at the payment
      // step: confirmed bookings, pending holds that haven't expired, and admin unavailability
      // blocks. Boundaries are inclusive, so back-to-back bookings need a gap.
      let bookingsQuery = supabase
        .from('bookings')
        .select('id')
        .eq('car_id', carId)
        .lte('start_datetime', endIso)
        .gte('end_datetime', startIso)
        .or(`status.eq.confirmed,and(status.eq.pending,or(hold_expires_at.is.null,hold_expires_at.gt.${nowIso}))`);
      if (ownBookingId) bookingsQuery = bookingsQuery.neq('id', ownBookingId);

      const [bookings, blocks] = await Promise.all([
        bookingsQuery,
        supabase
          .from('car_unavailability')
          .select('id')
          .eq('car_id', carId)
          .lte('start_datetime', endIso)
          .gte('end_datetime', startIso)
          .limit(1),
      ]);

      if (bookings.error) throw bookings.error;
      if (blocks.error) throw blocks.error;
      return (bookings.data?.length ?? 0) === 0 && (blocks.data?.length ?? 0) === 0;
    } catch (error) {
      console.error('Error checking car availability:', error);
      return false;
    }
  };

  const onSubmit = async (data: FormData) => {
    // The picked numbers are Oslo wall-clock; persist (and validate) the real Oslo instants.
    const startDateTime = naiveToOsloInstant(data.startDateTime);
    const endDateTime = naiveToOsloInstant(data.endDateTime);

    if (!isPickupLeadTimeValid(startDateTime)) {
      toast({
        title: "Invalid pickup time",
        variant: "destructive",
        description: `Pickup time must be at least ${MIN_PICKUP_LEAD_HOURS} hour(s) from now.`,
      });
      return;
    }

    // Basic validation - ensure end date is after start date
    if (endDateTime <= startDateTime) {
      // alert('End date must be after start date');
      toast({
        title: "Invalid date range",
        variant: "destructive",
        description: "End date must be after start date.",
      });
      return;
    }

    // Check if the car is available for the selected dates
    const isAvailable = await checkCarAvailability(String(car.id), startDateTime, endDateTime);

    if (!isAvailable) {
      toast({
        title: "The car is already booked",
        variant: "destructive",
        description: "Please select other dates.",
        });
      return;
    }

    const decorationRequired = Boolean(
      data.decorationFlowers || data.decorationRibbon || data.decorationRedCarpets
    );

    const bookingData: BookingData = {
      car,
      startDateTime: startDateTime,
      endDateTime: endDateTime,
      pickupLocation: DEFAULT_PICKUP_LOCATION,
      deliveryLocation: DEFAULT_DELIVERY_LOCATION,
      totalPrice: pricing.totalPrice,
      basePrice: pricing.basePrice,
      deliveryFee: pricing.deliveryFee,
      depositAmount: pricing.depositAmount,
      driverSurcharge: pricing.driverSurcharge,
      withDriver: data.decorationDriverNeed,
      decorationRequired,
      seatPricingMode: data.seatPricingMode,
      decorationFlowers: data.decorationFlowers,
      decorationRibbon: data.decorationRibbon,
      decorationRedCarpets: data.decorationRedCarpets,
      decorationDriverNeed: data.decorationDriverNeed,
    };

    onComplete(bookingData);
  };

  return (
    <div className="space-y-6">
      <Form form={form} onSubmit={onSubmit}>
        <>

          {/* Selected Car Display */}
          <Card className="border-[#334047] bg-[#232e33] text-[#b1bdc3] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Selected vehicle
              </CardTitle>
              {onCarChange && (
                <VehicleSwitcher
                  selectedCar={car}
                  onSelect={onCarChange}
                  disabled={form.formState.isSubmitting}
                  unavailableIds={unavailableIds}
                />
              )}
            </CardHeader>
            <CardContent>
              {/* Keyed by car so switching vehicles fades the new details in. */}
              <div
                key={String(car.id)}
                className="lux-fade-in flex flex-col md:flex-row gap-4"
              >
                <img
                  src={car.image_url || defaultImg}
                  alt={car.name}
                  className="w-[132px] h-[132px] rounded-md object-cover"
                  style={{ width: "280px", height: "170px" }}
                />
                <div className="flex-1 tracking-wide">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold text-[#E3C08D]">{car.name}</h3>
                    <p className="text-sm tracking-wide text-[#b1bdc3]">{(car.description ?? "").length > 300 ? `${car.description.slice(0, 300)}...` : car.description}</p>
                    <div className="flex gap-4 flex-wrap">
                      <p className="text-sm"><span className="font-semibold">Per hour: </span>{car.base_price_per_hour}</p>
                      <p className="text-sm"><span className="font-semibold">Per day: </span>{car.base_price_per_day}</p>
                      {Number(car.base_price_per_month ?? 0) > 0 && (
                        <p className="text-sm"><span className="font-semibold">Per month: </span>{car.base_price_per_month}</p>
                      )}
                      <p className="text-sm"><span className="font-semibold">Deposit: </span>{car.deposit_amount ?? 0}</p>
                      <p className="text-sm"><span className="font-semibold">Incl. km: </span>{car.included_km_per_day}/day</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demands: seats pricing + decorations (before dates) */}
          <Card className="card-premium border-[#334047] bg-[#232e33] text-[#b1bdc3] shadow-sm">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 shrink-0 text-[#E3C08D]" />
                Your preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="rounded-md border border-[#46555d] bg-[#1b2529] p-3">
                <span className="text-[#9aa8ae]">Decoration</span>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  {(
                    [
                      { name: "decorationFlowers" as const, label: "Flowers" },
                      { name: "decorationRibbon" as const, label: "Ribbon" },
                      { name: "decorationRedCarpets" as const, label: "Red carpets" },
                    ] as const
                  ).map((item) => (
                    <FormField
                      key={item.name}
                      control={form.control}
                      name={item.name}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-1.5 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-3.5 w-3.5 shrink-0 rounded border-[#46555d] accent-[#E3C08D]"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0 cursor-pointer whitespace-nowrap font-normal text-[#b1bdc3]">
                            {item.label}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <FormField
                control={form.control}
                name="decorationDriverNeed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border border-[#46555d] bg-[#1b2529] px-3 py-2.5 space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel className="!mt-0 cursor-pointer text-sm font-medium text-[#b1bdc3]">
                        Driver requested
                      </FormLabel>
                      <p className="text-xs text-[#9aa8ae]">Adds 25% of the booking amount</p>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 shrink-0 rounded border-[#46555d] accent-[#E3C08D]"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Date and Time Selection */}
          <Card className="card-premium border border-[#46555d] bg-[#232e33] text-[#b1bdc3] shadow-sm">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 shrink-0 text-[#E3C08D]" />
                Choose date and location
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDateTime"
                  rules={{
                    required: "Pickup date is required",
                    validate: (value) => {
                      if (!value) return true;
                      if (!isPickupLeadTimeValid(value)) {
                        return `Pickup time must be at least ${MIN_PICKUP_LEAD_HOURS} hour(s) from now`;
                      }
                      return true;
                    },
                  }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Pickup (date and time) <span className="text-red-500">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="border border-[#46555d] bg-[#1b2529] text-[#b1bdc3] rounded-md">
                            <Button
                              variant="outline"
                              type="button"
                              translate="no"
                              className={cn(
                                "notranslate h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] pl-3 text-left font-normal text-[#b1bdc3] transition-colors hover:cursor-pointer hover:bg-[#27343a] focus:outline-none focus-visible:border-[#E3C08D] focus-visible:ring-2 focus-visible:ring-[#E3C08D]/60",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value instanceof Date ? (
                                <span>{format(field.value, "yyyy-MM-dd HH:mm")}</span>
                              ) : (
                                <span>Choose date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </div>
                        </PopoverTrigger>

                        <PopoverContent
                          className="notranslate w-auto border-[#46555d] bg-[#1b2529] p-0 text-[#b1bdc3]"
                          translate="no"
                          align="start"
                          onInteractOutside={bookingDatePopoverOnInteractOutside}
                        >
                          <div>
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date: Date) => {
                                // If we have an existing time, preserve it when selecting a new date
                                if (field.value instanceof Date) {
                                  const currentTime = field.value;
                                  const newDate = new Date(date.getTime());
                                  newDate.setHours(currentTime.getHours() || 0);
                                  newDate.setMinutes(currentTime.getMinutes() || 0);
                                  field.onChange(newDate);
                                } else {
                                  field.onChange(date);
                                }
                              }}
                              disabled={(date) => {
                                // Pickup can be changed to any future day, not only dates after current selection.
                                const todayStart = new Date();
                                todayStart.setHours(0, 0, 0, 0);
                                return date < todayStart;
                              }}
                              captionLayout="label"
                              initialFocus
                              required
                            />
                            <BookingDateTimeTimeRow
                              dateValue={
                                field.value instanceof Date ? field.value : undefined
                              }
                              onTimeChange={field.onChange}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDateTime"
                  rules={{
                    required: "Return date is required",
                    validate: (value) => {
                      const start = form.getValues("startDateTime");
                      return !start || !value || value >= start || "Return must be after pickup";
                    },
                  }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Return (date and time) <span className="text-red-500">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="border border-[#46555d] bg-[#1b2529] text-[#b1bdc3] rounded-md">
                            <Button
                              variant="outline"
                              type="button"
                              translate="no"
                              className={cn(
                                "notranslate h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] pl-3 text-left font-normal text-[#b1bdc3] transition-colors hover:cursor-pointer hover:bg-[#27343a] focus:outline-none focus-visible:border-[#E3C08D] focus-visible:ring-2 focus-visible:ring-[#E3C08D]/60",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value instanceof Date ? (
                                <span>{format(field.value, "yyyy-MM-dd HH:mm")}</span>
                              ) : (
                                <span>Choose date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </div>
                        </PopoverTrigger>

                        <PopoverContent
                          className="notranslate w-auto border-[#46555d] bg-[#1b2529] p-0 text-[#b1bdc3]"
                          translate="no"
                          align="start"
                          onInteractOutside={bookingDatePopoverOnInteractOutside}
                        >
                          <div>
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date: Date) => {
                                // If we have an existing time, preserve it when selecting a new date
                                if (field.value instanceof Date) {
                                  const currentTime = field.value;
                                  const newDate = new Date(date.getTime());
                                  newDate.setHours(currentTime.getHours() || 0);
                                  newDate.setMinutes(currentTime.getMinutes() || 0);
                                  field.onChange(newDate);
                                } else {
                                  field.onChange(date);
                                }
                              }}
                              disabled={(date) => {
                                const startDateTime = form.getValues("startDateTime");
                                if (!startDateTime) return date < new Date(new Date().setHours(0, 0, 0, 0));
                                return date <= startDateTime;
                              }}
                              captionLayout="label"
                              initialFocus
                              required
                            />
                            <BookingDateTimeTimeRow
                              dateValue={
                                field.value instanceof Date ? field.value : undefined
                              }
                              onTimeChange={field.onChange}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Early "already booked" warning for the selected vehicle + window. */}
          {selectedCarUnavailable && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {car.name} is already booked for the selected dates. Please choose other dates or switch to another
                vehicle.
              </span>
            </div>
          )}

          {/* Rental pricing preference */}
          <Card className="card-premium border border-[#46555d] bg-[#232e33] text-[#b1bdc3] shadow-sm">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 shrink-0 text-[#E3C08D]" />
                Rental pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="flex flex-col gap-2 rounded-md border border-[#46555d] bg-[#1b2529] p-3 sm:flex-row sm:items-center sm:gap-6">
                {(
                  [
                    { value: "flat-rate" as const, label: "Per hour" },
                    { value: "daily-basis" as const, label: "Per day" },
                    ...(monthlyAvailable ? [{ value: "monthly-basis" as const, label: "Per month" }] : []),
                  ] as const
                ).map((option) => {
                  const optionDisabled = option.value === "monthly-basis" && !monthlyEligible;
                  return (
                    <FormField
                      key={option.value}
                      control={form.control}
                      name="seatPricingMode"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                          <FormControl>
                            <input
                              type="radio"
                              name="seatPricingMode"
                              checked={field.value === option.value}
                              disabled={optionDisabled}
                              onChange={() => {
                                if (optionDisabled) return;
                                setPricingModeTouched(true);
                                field.onChange(option.value);
                              }}
                              className="h-3.5 w-3.5 shrink-0 accent-[#E3C08D] disabled:cursor-not-allowed"
                            />
                          </FormControl>
                          <FormLabel
                            className={cn(
                              "!mt-0 font-normal text-[#b1bdc3]",
                              optionDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                            )}
                          >
                            {option.label}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
              {monthlyAvailable && !monthlyEligible && (
                <p className="text-xs text-[#9aa8ae]">
                  Per month is available for rentals of at least one month.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Location Selection */}
          <Card className="card-premium border border-[#46555d] bg-[#232e33] text-[#b1bdc3] shadow-sm">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 shrink-0 text-[#E3C08D]" />
                Pickup and delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <p className="text-xs text-[#9aa8ae]">Standard pickup and delivery.</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div
                className="flex min-w-0 flex-1 cursor-default items-start gap-3 rounded-md border border-[#46555d] bg-[#1b2529] p-3"
                role="group"
                aria-label={`Pickup location: ${DEFAULT_PICKUP_LOCATION}`}
              >
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-[#46555d] bg-[#232e33]"
                  aria-hidden
                >
                  <Check className="h-3 w-3 text-[#E3C08D]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#9aa8ae]">
                    Pickup location
                  </p>
                  <p className="text-sm leading-snug text-[#b1bdc3]">{DEFAULT_PICKUP_LOCATION}</p>
                </div>
              </div>
              <div
                className="flex min-w-0 flex-1 cursor-default items-start gap-3 rounded-md border border-[#46555d] bg-[#1b2529] p-3"
                role="group"
                aria-label={`Delivery location: ${DEFAULT_DELIVERY_LOCATION}`}
              >
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-[#46555d] bg-[#232e33]"
                  aria-hidden
                >
                  <Check className="h-3 w-3 text-[#E3C08D]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#9aa8ae]">
                    Delivery location
                  </p>
                  <p className="text-sm leading-snug text-[#b1bdc3]">{DEFAULT_DELIVERY_LOCATION}</p>
                </div>
              </div>
              </div>
            </CardContent>
          </Card>
          <Button
            type="submit"
            disabled={selectedCarUnavailable}
            title={selectedCarUnavailable ? "This vehicle is already booked for the selected dates." : undefined}
            className="w-full bg-[#E3C08D] hover:bg-[#E3C08D]/90 text-black py-5 text-base font-medium shadow-lg hover:shadow-xl hover:text-white transition-all duration-300 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            size="lg"
          >
            Continue
          </Button>
        </>
      </Form>
    </div>
  );
};
