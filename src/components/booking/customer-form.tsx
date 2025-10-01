import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, FormProvider } from "react-hook-form";
import { useDropzone } from "react-dropzone";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Calendar } from "../ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { format } from "date-fns";
import {
  CalendarIcon,
  Upload,
  User,
  FileText,
  MapPin,
  Truck,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { BookingData, CustomerData } from "@/@types/data";

interface CustomerFormProps {
  bookingData: BookingData;
  onComplete: (data: CustomerData) => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  bookingData,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [licenseFile, setLicenseFile] = useState<File | null>(
    null,
  );

  const form = useForm<CustomerData>({
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      address: "",
      postalCode: "",
      city: "",
      dateOfBirth: new Date("1990-01-01"),
    },
  });

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
  };
  console.log('booking data', bookingData)

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
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 shadow-sm"
                            placeholder="John Doe"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 text-xs mt-1" />
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
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 shadow-sm"
                            placeholder="john.doe@example.com"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 text-xs mt-1" />
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
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 shadow-sm"
                            placeholder="+47 123 45 678"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 text-xs mt-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  rules={{
                    required: "Date of birth is required",
                  }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-medium text-gray-700">Date of Birth <span className="text-red-500">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
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
                              date > new Date() ||
                              date <
                                new Date(
                                  new Date().getFullYear() - 100,
                                  0,
                                  1,
                                )
                            }
                            initialFocus
                            captionLayout="dropdown-buttons"
                            fromYear={1900}
                            toYear={new Date().getFullYear()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage className="text-red-500 text-xs mt-1" />
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
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 shadow-sm"
                            placeholder="1234"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 text-xs mt-1" />
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
                            className="mt-1 h-9 block w-full rounded-md border-gray-300 shadow-sm"
                            placeholder="Oslo"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 text-xs mt-1" />
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