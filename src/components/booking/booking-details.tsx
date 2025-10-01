import React, { useState } from "react";
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

interface BookingDetailsProps {
  car: CarData;
  onComplete: (data: BookingData) => void;
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
}) => {
  // const { t } = useTranslation();
  const [deliveryFee, setDeliveryFee] = useState(0);

  const form = useForm<FormData>({
    defaultValues: {
      startDateTime: new Date(),
      endDateTime: addDays(new Date(), 1),
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
      !watchedValues.startDateTime ||
      !watchedValues.endDateTime ||
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
      watchedValues.startDateTime,
      "yyyy-MM-dd",
    );
    const endDateStr = format(
      watchedValues.endDateTime,
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
    // if (totalHours <= 24) {
    //   basePrice = car.base_price_per_hour 
    //     ? car.base_price_per_hour * totalHours
    //     : 0;
    // } else {
    //   basePrice = car.base_price_per_day
    //     ? car.base_price_per_day * totalDays
    //     : 0;
    // }

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

    console.log('form data', data);
    const startDateTime = new Date(
      `${format(data.startDateTime, "yyyy-MM-dd")}T${data.startTime}`,
    );
    const endDateTime = new Date(
      `${format(data.endDateTime, "yyyy-MM-dd")}T${data.endTime}`,
    );

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
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Selected Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                {car.image_url && (
                  <img
                    src={car.image_url}
                    alt={car.name}
                    className="w-[128px] h-[128px] rounded-md object-cover"
                    style={{ width: "260px", height: "160px" }}
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">
                    {car.name}
                  </h3>
                  <p className="text-lg font-semibold mb-2">{car.price}</p>
                  <p className="text-muted-foreground text-sm tracking-wider leading-[18px]">
                    {car.moreInfo[0]}
                    {car.moreInfo[1]}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date and Time Selection */}
          <Card className="card-premium">
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
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            onBlur={field.onBlur}
                            className="border h-9 border-gray-200"
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
                  rules={{ required: "Return date is required" }}
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
                            className="border h-9 border-gray-200"
                            min={format(new Date(), "yyyy-MM-dd'T'HH:mm")} // Optional: prevents selecting past dates
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
                rules={{ required: "Pickup location is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Location <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter pickup location"
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
                name="deliveryLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Optional delivery location"
                        {...field}
                        className="border h-9 border-gray-200"
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
                <span>Vat: </span>
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
