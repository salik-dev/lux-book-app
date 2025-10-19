import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, FormProvider } from "react-hook-form";
import { useDropzone } from "react-dropzone";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { format } from "date-fns";
import { Upload, User, FileText, MapPin, Truck, CalendarIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { BookingData, CustomerData } from "@/@types/data";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";

interface CustomerFormProps {
  bookingData: BookingData;
  onComplete: (data: CustomerData) => void;
  initialData?: CustomerData;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ bookingData, onComplete, initialData }) => {
  const { t } = useTranslation();
  const [licenseFile, setLicenseFile] = useState<File | null>(
    null,
  );

  const form = useForm<CustomerData>({
    defaultValues: {
      fullName: initialData?.fullName || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      postalCode: initialData?.postalCode || "",
      city: initialData?.city || "",
      dateOfBirth: initialData?.dateOfBirth ? new Date(initialData.dateOfBirth) : new Date("1990-01-01"),
      driverLicenseNumber: initialData?.driverLicenseNumber || "",
      driverLicenseFile: initialData?.driverLicenseFile,
    },
    mode: "onChange",
  });

  // Hydrate/reset when navigating back with existing data
  useEffect(() => {
    if (initialData) {
      form.reset({
        fullName: initialData.fullName || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        address: initialData.address || "",
        postalCode: initialData.postalCode || "",
        city: initialData.city || "",
        dateOfBirth: initialData.dateOfBirth ? new Date(initialData.dateOfBirth) : new Date("1990-01-01"),
        driverLicenseNumber: initialData.driverLicenseNumber || "",
        driverLicenseFile: initialData.driverLicenseFile,
      });
      // Also hydrate local file preview state so dropzone shows the file name
      if (initialData.driverLicenseFile) {
        setLicenseFile(initialData.driverLicenseFile as File);
      }
    }
  }, [initialData, form]);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setLicenseFile(acceptedFiles[0]);
    }
  };

  const dropzoneOptions = {
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    onDragEnter: undefined,
    onDragOver: undefined,
    onDragLeave: undefined,
  };

  const { getRootProps, getInputProps, isDragActive } =
    useDropzone(dropzoneOptions);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("no-NO", {
      style: "currency",
      currency: "NOK",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const onSubmit = (data: CustomerData) => {
    const customerData: CustomerData = {
      ...data,
      driverLicenseFile: licenseFile || undefined,
    };
    onComplete(customerData);
    console.log('customer data', customerData)
  };
  // console.log('booking data', bookingData)

  return (
    <div className="space-y-6">
      {/* Booking Summary */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <div>
              <h4 className="font-medium text-gray-900">{bookingData.car.name}</h4>
              <p className="text-sm text-gray-600">
                {format(new Date(bookingData.startDateTime), "PPP p")} -{" "}
                {format(new Date(bookingData.endDateTime), "PPP p")}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">{bookingData.pickupLocation}</span>
              </div>
              {bookingData.deliveryLocation && (
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700">Delivery: {bookingData.deliveryLocation}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {formatPrice(bookingData.totalPrice)}
            </div>
            <div className="text-sm text-gray-500">
              Total incl. VAT
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {Math.ceil((new Date(bookingData.endDateTime).getTime() - new Date(bookingData.startDateTime).getTime()) / (1000 * 60 * 60 * 24))} days
            </div>
          </div>
        </div>
      </div>

      <FormProvider {...form}>
        <form
          id="customer-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          {/* Personal Information */}
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </h3>
              <p className="text-sm text-gray-500 mt-1">Please fill in your details to complete the booking</p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="fullName"
                  rules={{ required: "Full name is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Full Name <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 bg-gray-50"
                            placeholder="John Doe"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  rules={{
                    required: "Email is required",
                    pattern: {
                      value:
                        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Email <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="email"
                            {...field}
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 bg-gray-50"
                            placeholder="john.doe@example.com"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="phone"
                  rules={{
                    required: "Phone number is required",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Phone <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 bg-gray-50"
                            placeholder="+47 123 45 678"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  rules={{
                    required: "Return date is required",
                    validate: (value) => {
                      const start = form.getValues("dateOfBirth");
                      return !start || !value || value >= start || "Return date-time must be after pickup";
                    },
                  }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Pickup Date-Time <span className="text-red-500">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div>
                            <Button
                              variant="outline"
                              type="button"
                              className={cn(
                                "w-full h-9 pl-3 text-left font-normal border border-gray-300 hover:bg-[#E3C08D] rounded-md hover:cursor-pointer",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value instanceof Date ? (
                                <>
                                  {format(field.value, "PPP")}
                                  <span className="ml-2 text-sm text-muted-foreground">
                                    {field.value.toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: false
                                    })}
                                  </span>
                                </>
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </div>
                        </PopoverTrigger>

                        <PopoverContent className="w-auto p-0 bg-white border-0" align="start">
                          <div className="relative">
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
                                // Close popover after selection
                                const popover = document.querySelector('[data-state="open"]');
                                if (popover) {
                                  popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                                }
                              }}
                              captionLayout="dropdown"
                              required
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="driverLicenseNumber"
                  rules={{ required: "Driver license number is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Driver License Number <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 bg-gray-50"
                            placeholder="Insert your driver license number ..."
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  rules={{ required: "Address is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Address <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 bg-gray-50"
                            placeholder="Insert your address ..."
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="postalCode"
                  rules={{
                    required: "Postal code is required",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Postal Code <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 bg-gray-50"
                            placeholder="1234"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  rules={{ required: "City is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">City <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 bg-gray-50"
                            placeholder="Oslo"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Driver's License Upload */}
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Driver's License
              </h3>
              <p className="text-sm text-gray-500 mt-1">Please upload a valid driver's license</p>
            </div>
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/10"
                    : "border-muted-foreground/25 hover:border-primary/50",
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {licenseFile ? (
                  <div>
                    <p className="font-medium text-primary">
                      {licenseFile.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Size:{" "}
                      {(
                        licenseFile.size /
                        1024 /
                        1024
                      ).toFixed(2)}{" "}
                      MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-muted-foreground mb-2">
                      {isDragActive
                        ? "Drop the file here..."
                        : "Drag & drop your driver's license image, or click to select"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports: PNG, JPG, JPEG (max 5MB)
                    </p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                * Required for all rentals. Your license will
                be verified before pickup.
              </p>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#E3C08D] hover:bg-[#E3C08D]/90 text-white py-5 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:cursor-pointer"
            size="lg"
          >
            Continue
          </Button>
        </form>
      </FormProvider>
    </div>
  );
};