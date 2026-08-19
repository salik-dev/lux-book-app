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
    <div className="notranslate border-t border-[#3f4d54] bg-[#232e33] px-3 py-3" translate="no">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#9aa8ae]">
        Time
      </p>
      <div className="flex items-center gap-2">
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
            avoidCollisions={false}
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
            avoidCollisions={false}
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
  initialData,
}) => {
  // const { t } = useTranslation();
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  /** Once the customer explicitly picks a pricing mode, stop auto-switching it as dates change. */
  const [pricingModeTouched, setPricingModeTouched] = useState(Boolean(initialData?.seatPricingMode));

  const form = useForm<FormData>({
    defaultValues: {
      startDateTime: initialData ? new Date(initialData.startDateTime) : addHours(new Date(), 2),
      endDateTime: initialData ? new Date(initialData.endDateTime) : addDays(new Date(), 1),
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

  // Persist values when navigating back by resetting with initialData
  useEffect(() => {
    if (initialData) {
      form.reset({
        startDateTime: new Date(initialData.startDateTime),
        endDateTime: new Date(initialData.endDateTime),
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

  // Calculate pricing based on the full Date values from datetime-local inputs
  const calculatePricing = () => {
    const start = watchedValues.startDateTime;
    const end = watchedValues.endDateTime;

    if (!start || !end) {
      return {
        basePrice: 0,
        deliveryFee: 0,
        depositAmount: 0,
        totalPrice: 0,
        duration: "0 days (0 hours)",
      };
    }

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        basePrice: 0,
        deliveryFee: 0,
        depositAmount: 0,
        totalPrice: 0,
        duration: "0 days (0 hours)",
      };
    }

    // Total hours between end and start (minimum 1 hour)
    const totalHours = Math.max(1, differenceInHours(end, start));
    const totalDays = Math.ceil(totalHours / 24);

    let basePrice = 0;
    if (watchedValues.seatPricingMode === "daily-basis") {
      basePrice = car.base_price_per_day ? car.base_price_per_day * totalDays : 0;
    } else {
      basePrice = car.base_price_per_hour ? car.base_price_per_hour * totalHours : 0;
    }

    const depositAmount = Number(car.deposit_amount ?? 0);
    const subtotal = basePrice + deliveryFee + depositAmount;
    const withDriver = Boolean(watchedValues.decorationDriverNeed);
    // Driver surcharge applies to base price only (not deposit/delivery).
    const driverSurcharge = withDriver ? basePrice * 0.25 : 0;
    const totalPrice = subtotal + driverSurcharge;

    return {
      basePrice,
      deliveryFee,
      depositAmount,
      driverSurcharge,
      totalPrice,
      duration: `${totalDays} ${totalDays === 1 ? "day" : "days"} (${totalHours} hours)`,
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
    try {
      const { data: existingBookings, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('car_id', carId)
        .not('status', 'in', '("cancelled","completed")')
        .or(
          `and(status.eq.confirmed,start_datetime.lte.${endDateTime.toISOString()},end_datetime.gte.${startDateTime.toISOString()}),` +
          `and(status.eq.pending,start_datetime.lte.${endDateTime.toISOString()},end_datetime.gte.${startDateTime.toISOString()})`
        );

      console.log('existingBookings', existingBookings)

      if (error) throw error;
      return existingBookings.length === 0;
    } catch (error) {
      console.error('Error checking car availability:', error);
      return false;
    }
  };

  const onSubmit = async (data: FormData) => {
    const startDateTime = data.startDateTime;
    const endDateTime = data.endDateTime;

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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Selected vehicle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <img
                  src={car.image_url || defaultImg}
                  alt={car.name}
                  className="w-[132px] h-[132px] rounded-md object-cover"
                  style={{ width: "280px", height: "170px" }}
                />
                <div className="flex-1 tracking-wide">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold text-[#E3C08D]">{car.name}</h3>
                    <p className="text-sm tracking-wide text-[#b1bdc3]">{car.description.length > 250 ? `${car.description.slice(0, 300)}...` : car.description}</p>
                    <div className="flex gap-4 flex-wrap">
                      <p className="text-sm"><span className="font-semibold">Per hour: </span>{car.base_price_per_hour}</p>
                      <p className="text-sm"><span className="font-semibold">Per day: </span>{car.base_price_per_day}</p>
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
                          <div>
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
                          <div>
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

          {/* Rental pricing preference */}
          <Card className="card-premium border border-[#46555d] bg-[#232e33] text-[#b1bdc3] shadow-sm">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 shrink-0 text-[#E3C08D]" />
                Rental pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-2 rounded-md border border-[#46555d] bg-[#1b2529] p-3 sm:flex-row sm:items-center sm:gap-6">
                {(
                  [
                    { value: "flat-rate" as const, label: "Per hour" },
                    { value: "daily-basis" as const, label: "Per day" },
                  ] as const
                ).map((option) => (
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
                            onChange={() => {
                              setPricingModeTouched(true);
                              field.onChange(option.value);
                            }}
                            className="h-3.5 w-3.5 shrink-0 accent-[#E3C08D]"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 cursor-pointer font-normal text-[#b1bdc3]">
                          {option.label}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
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
            className="w-full bg-[#E3C08D] hover:bg-[#E3C08D]/90 text-black py-5 text-base font-medium shadow-lg hover:shadow-xl hover:text-white transition-all duration-300 hover:cursor-pointer"
            size="lg"
          >
            Continue
          </Button>
        </>
      </Form>
    </div>
  );
};
