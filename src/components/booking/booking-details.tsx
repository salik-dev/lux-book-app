import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { format, addDays, differenceInHours } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  Car,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Form, FormItem, FormLabel, FormControl, FormMessage, FormField } from "../ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface CarData {
  id: string;
  name: string;
  model: string;
  brand: string;
  year: number;
  description: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  included_km_per_day: number;
  extra_km_rate: number;
  image: string;
  is_available: boolean;
}

interface BookingData {
  car: CarData;
  startDate: Date;
  endDate: Date;
  pickupLocation: string;
  deliveryLocation?: string;
  totalPrice: number;
  basePrice: number;
  deliveryFee: number;
  vatAmount: number;
}

interface BookingDetailsProps {
  car: CarData;
  onComplete: (data: BookingData) => void;
}

interface FormData {
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  pickupLocation: string;
  deliveryLocation: string;
}

export const BookingDetails: React.FC<BookingDetailsProps> = ({
  car,
  onComplete,
}) => {
  // const { t } = useTranslation();
  const [deliveryFee, setDeliveryFee] = useState(0);
  console.log("car data", car);

  const form = useForm<FormData>({
    defaultValues: {
      startDate: new Date(),
      endDate: addDays(new Date(), 1),
      startTime: "10:00",
      endTime: "10:00",
      pickupLocation: "Oslo Sentrum",
      deliveryLocation: "",
    },
    mode: "onChange",
  });

  const watchedValues = form.watch();

  // Calculate pricing
  const calculatePricing = () => {
    // Ensure we have valid dates and times before proceeding
    if (
      !watchedValues.startDate ||
      !watchedValues.endDate ||
      !watchedValues.startTime ||
      !watchedValues.endTime
    ) {
      return {
        basePrice: 0,
        deliveryFee: 0,
        vatAmount: 0,
        totalPrice: 0,
        duration: "0 days (0 hours)",
      };
    }

    // Create date strings in ISO format
    const startDateStr = format(
      watchedValues.startDate,
      "yyyy-MM-dd",
    );
    const endDateStr = format(
      watchedValues.endDate,
      "yyyy-MM-dd",
    );

    // Parse dates with proper timezone handling
    const startDateTime = new Date(
      `${startDateStr}T${watchedValues.startTime}:00`,
    );
    const endDateTime = new Date(
      `${endDateStr}T${watchedValues.endTime}:00`,
    );

    // Validate dates
    if (
      isNaN(startDateTime.getTime()) ||
      isNaN(endDateTime.getTime())
    ) {
      console.error("Invalid date values:", {
        startDateTime,
        endDateTime,
      });
      return {
        basePrice: 0,
        deliveryFee: 0,
        vatAmount: 0,
        totalPrice: 0,
        duration: "0 days (0 hours)",
      };
    }

    // Calculate total hours, ensuring it's at least 1 hour
    let totalHours = Math.max(
      1,
      differenceInHours(endDateTime, startDateTime),
    );
    const totalDays = Math.ceil(totalHours / 24);

    let basePrice = 0;
    if (totalHours <= 24) {
      basePrice = car.base_price_per_hour
        ? car.base_price_per_hour * totalHours
        : 0;
    } else {
      basePrice = car.base_price_per_day
        ? car.base_price_per_day * totalDays
        : 0;
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

  const onSubmit = (data: FormData) => {
    const startDateTime = new Date(
      `${format(data.startDate, "yyyy-MM-dd")}T${data.startTime}`,
    );
    const endDateTime = new Date(
      `${format(data.endDate, "yyyy-MM-dd")}T${data.endTime}`,
    );

    const bookingData: BookingData = {
      car,
      startDate: startDateTime,
      endDate: endDateTime,
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
      {/* Selected Car Display */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Selected Vehicle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {car.image && (
              <img
                src={car.image}
                alt={car.name}
                className="w-[128px] h-[128px] object-cover rounded-lg"
                style={{ width: "300px", height: "160px" }}
              />
            )}
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">
                {car.name}
              </h3>
              <p className="text-muted-foreground mb-4">
                {car.details}
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="font-medium">Per Hour:</span>{" "}
                  {formatPrice(
                    car.base_price_per_hour
                      ? car.base_price_per_hour
                      : 0,
                  )}
                </div>
                <div>
                  <span className="font-medium">Per Day:</span>{" "}
                  {formatPrice(
                    car.base_price_per_day
                      ? car.base_price_per_day
                      : 0,
                  )}
                </div>
                <div>
                  <span className="font-medium">
                    Included KM:
                  </span>{" "}
                  {car.included_km_per_day
                    ? car.included_km_per_day
                    : 0}
                  /day
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          {/* Date and Time Selection */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {/* {t('booking.step1')} */}
                Select Dates & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Pickup Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal border border-gray-300 hover:bg-[#E3C08D] hover:cursor-pointer",
                                !field.value &&
                                  "text-muted-foreground",
                              )}
                              type="button"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date()
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      {/* <FormLabel>{t('booking.returnDate')}</FormLabel> */}
                      <FormLabel>Return Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal border border-gray-300 hover:bg-[#E3C08D] hover:cursor-pointer",
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
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < watchedValues.startDate
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      {/* <FormLabel>{t('booking.pickupTime')}</FormLabel> */}
                      <FormLabel>Pickup Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          className="border border-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      {/* <FormLabel>{t('booking.returnTime')}</FormLabel> */}
                      <FormLabel>Return Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          className="border border-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Location Selection */}
          <Card className="card-premium">
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
                render={({ field }) => (
                  <FormItem>
                    {/* <FormLabel>{t('booking.pickupLocation')}</FormLabel> */}
                    <FormLabel>Pickup Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter pickup location"
                        {...field}
                        className="border border-gray-200"
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
                    {/* <FormLabel>{t('booking.deliveryLocation')}</FormLabel> */}
                    <FormLabel>Delivery Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Optional delivery location"
                        {...field}
                        className="border border-gray-200"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Pricing Summary */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                {/* <span>{t('booking.duration')}:</span> */}
                <span>Duration: </span>
                <span className="font-medium">
                  {pricing.duration}
                </span>
              </div>
              <div className="flex justify-between">
                {/* <span>{t('booking.basePrice')}:</span> */}
                <span>Base price: </span>
                <span>{formatPrice(pricing.basePrice)}</span>
              </div>
              {pricing.deliveryFee > 0 && (
                <div className="flex justify-between">
                  {/* <span>{t('booking.deliveryFee')}:</span> */}
                  <span>Delivery fee: </span>
                  <span>
                    {formatPrice(pricing.deliveryFee)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                {/* <span>{t('booking.vat')}:</span> */}
                <span>Vat: </span>
                <span>{formatPrice(pricing.vatAmount)}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold">
                  {/* <span>{t('booking.totalPrice')}:</span> */}
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
            className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-base font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
            size="lg"
          >
            {/* {t('booking.continue')} */}
            Continue
          </Button>
        </form>
      </Form>
    </div>
  );
};