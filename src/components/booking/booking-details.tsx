import React, { useEffect, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { format, addDays, differenceInHours } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  Car,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Form as UIForm, FormItem, FormLabel, FormControl, FormMessage, FormField } from "../ui/form";
import defaultImg from "../../assets/luxury-car-collection-garage-premium.jpg";

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

// import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
// import { Calendar } from "../ui/calendar";
// import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { BookingData, CarData } from "@/@types/data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  pickupLocation: string;
  deliveryLocation: string;
}

export const BookingDetails: React.FC<BookingDetailsProps> = ({
  car,
  onComplete,
  initialData,
}) => {
  // const { t } = useTranslation();
  const [deliveryFee, setDeliveryFee] = useState(0);

  const form = useForm<FormData>({
    defaultValues: {
      startDateTime: initialData ? new Date(initialData.startDateTime) : new Date(),
      endDateTime: initialData ? new Date(initialData.endDateTime) : addDays(new Date(), 1),
      startTime: "10:00",
      endTime: "10:00",
      pickupLocation: initialData?.pickupLocation || "Oslo Sentrum",
      deliveryLocation: initialData?.deliveryLocation || "",
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
        pickupLocation: initialData.pickupLocation,
        deliveryLocation: initialData.deliveryLocation || "",
      });
    }
  }, [initialData, form]);

  // Calculate pricing based on the full Date values from datetime-local inputs
  const calculatePricing = () => {
    const start = watchedValues.startDateTime;
    const end = watchedValues.endDateTime;

    if (!start || !end) {
      return {
        basePrice: 0,
        deliveryFee: 0,
        vatAmount: 0,
        totalPrice: 0,
        duration: "0 days (0 hours)",
      };
    }

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        basePrice: 0,
        deliveryFee: 0,
        vatAmount: 0,
        totalPrice: 0,
        duration: "0 days (0 hours)",
      };
    }

    // Total hours between end and start (minimum 1 hour)
    const totalHours = Math.max(1, differenceInHours(end, start));
    const totalDays = Math.ceil(totalHours / 24);

    let basePrice = 0;
    if (totalHours <= 24) {
      basePrice = car.base_price_per_hour ? car.base_price_per_hour * totalHours : 0;
    } else {
      basePrice = car.base_price_per_day ? car.base_price_per_day * totalDays : 0;
    }

    const vatRate = 0.25;
    const vatAmount = basePrice * vatRate;
    const totalPrice = basePrice + deliveryFee + vatAmount;

    return {
      basePrice,
      deliveryFee,
      vatAmount,
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

    // Basic validation - ensure end date is after start date
    if (endDateTime <= startDateTime) {
      // alert('End date must be after start date'); 
      toast({
        title: 'Invalid Date Range',
        variant: 'destructive',
        description: 'End date must be after start date.',
      });
      return;
    }

    // Check if the car is available for the selected dates
    const isAvailable = await checkCarAvailability(car.id, startDateTime, endDateTime);
    
    if (!isAvailable) {
      toast({
        title: 'Car Unavailable',
        variant: 'destructive',
        description: 'Please choose different dates.',
      });
      return;
    }

    const bookingData: BookingData = {
      car,
      startDateTime: startDateTime,
      endDateTime: endDateTime,
      pickupLocation: data.pickupLocation,
      deliveryLocation: data.deliveryLocation || undefined,
      totalPrice: pricing.totalPrice,
      basePrice: pricing.basePrice,
      deliveryFee: pricing.deliveryFee,
      vatAmount: pricing.vatAmount,
    };

    onComplete(bookingData);
  };

  return (
    <div className="space-y-6">
      <Form form={form} onSubmit={onSubmit}>
        <>

          {/* Selected Car Display */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Selected Vehicle
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
                  <p className="text-sm text-gray-600 tracking-wide ">{car.description.length > 250 ? `${car.description.slice(0, 300)}...` : car.description}</p>
                  <div className="flex gap-4 flex-wrap">
                  <p className="text-sm"><span className="font-semibold">Per Hour: </span>{car.base_price_per_hour}</p>
                  <p className="text-sm"><span className="font-semibold">Per Day: </span>{car.base_price_per_day}</p>
                  <p className="text-sm"><span className="font-semibold">Included KM: </span>{car.included_km_per_day}/day</p>
                  </div>
                </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date and Time Selection */}
          <Card className="bg-white card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Select Dates & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDateTime"
                  rules={{ required: "Pickup date is required" }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Pickup Date-Time <span className="text-red-500">*</span></FormLabel>
                      {/* <Popover>
                        <PopoverTrigger asChild> */}
                          <FormControl>
                          <Input
                            type="datetime-local"
                            value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                            onChange={(e) => {
                              const newStart = new Date(e.target.value);
                              field.onChange(newStart);
                              const currentEnd = form.getValues("endDateTime");
                              if (currentEnd && currentEnd < newStart) {
                                form.setValue("endDateTime", newStart, { shouldValidate: true, shouldDirty: true });
                              }
                            }}
                            onBlur={field.onBlur}
                            className="border h-9 border-gray-200 bg-gray-50 rounded-md"
                            min={format(new Date(), "yyyy-MM-dd'T'HH:mm")} // Optional: prevents selecting past dates
                          />
                            {/* <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full h-9 pl-3 text-left font-normal border border-gray-300 hover:bg-[#E3C08D] rounded-md hover:cursor-pointer",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button> */}
                          </FormControl>
                        {/* </PopoverTrigger> */}
                        {/* <PopoverContent
                          className="w-auto p-0"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent> */}
                      {/* </Popover> */}
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
                      return !start || !value || value >= start || "Return date-time must be after pickup";
                    },
                  }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Return Date-Time <span className="text-red-500">*</span></FormLabel>
                      {/* <Popover>
                        <PopoverTrigger asChild> */}
                          <FormControl>
                          <Input
                            type="datetime-local"
                            value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            onBlur={field.onBlur}
                            min={
                              watchedValues.startDateTime
                              ? format(watchedValues.startDateTime, "yyyy-MM-dd'T'HH:mm")
                              : format(new Date(), "yyyy-MM-dd'T'HH:mm")
                            }
                            className="border h-9 border-gray-200 bg-gray-50 rounded-md"
                          />
                            {/* <Button
                              variant="outline"
                              type="button"
                              className={cn(
                                "w-full h-9 pl-3 text-left font-normal border border-gray-300 hover:bg-[#E3C08D] rounded-md hover:cursor-pointer",
                                !field.value &&
                                  "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button> */}
                          </FormControl>
                        {/* </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => {
                              const startDateTime = watchedValues.startDateTime;
                              if (!startDateTime) return date < new Date(new Date().setHours(0, 0, 0, 0));
                              return date <= startDateTime;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover> */}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  rules={{ required: "Pickup time is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Time <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          className="border h-9 border-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  rules={{ required: "Return time is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Time <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          className="border h-9 border-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div> */}
            </CardContent>
          </Card>

          {/* Location Selection */}
          <Card className="card-premium bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Pickup & Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="pickupLocation"
                rules={{ required: "Pickup location is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Location <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter pickup location"
                        {...field}
                        className="border h-9 border-gray-200 bg-gray-50 rounded-md"
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Optional delivery location"
                        {...field}
                        className="border h-9 border-gray-200 bg-gray-50 rounded-md"
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Pricing Summary */}
          <Card className="card-premium bg-white">
            <CardHeader>
              <CardTitle>Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Duration: </span>
                <span className="font-medium">
                  {pricing.duration}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Base price: </span>
                <span>{formatPrice(pricing.basePrice)}</span>
              </div>
              {pricing.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery fee: </span>
                  <span>
                    {formatPrice(pricing.deliveryFee)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Vat (25%): </span>
                <span>{formatPrice(pricing.vatAmount)}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total price: </span>
                  <span className="text-primary">
                    {formatPrice(pricing.totalPrice)}
                  </span>
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
