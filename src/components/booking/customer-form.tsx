import React, { useCallback, useEffect, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useDropzone } from "react-dropzone";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Upload, User, FileText, MapPin, Truck, Loader2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { BookingData, CustomerData } from "@/@types/data";
import { useToast } from "@/hooks/use-toast";
import { generateUniqueId } from "@/utils/carPlaceholder";
import { supabase } from '@/integrations/supabase/client';

/** Values not shown in the form; still sent to complete the booking. */
const HIDDEN_CUSTOMER_DEFAULTS = {
  fullName: "Demo Kunde",
  phone: "+47 22 00 00 00",
  city: "Oslo",
  dateOfBirth: new Date("1990-01-15"),
} as const;

interface CustomerFormProps {
  bookingData: BookingData;
  onComplete: (data: CustomerData) => void;
  initialData?: CustomerData;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ bookingData, onComplete, initialData }) => {
  // Inside your CustomerForm component
const [isUploading, setIsUploading] = useState(false);
const [licenseFile, setLicenseFile] = useState<File | null>(null);
const [licensePreview, setLicensePreview] = useState<string | null>(null);
const { toast } = useToast();

  const form = useForm<CustomerData>({
    defaultValues: {
      fullName: initialData?.fullName || HIDDEN_CUSTOMER_DEFAULTS.fullName,
      email: initialData?.email || "",
      phone: initialData?.phone || HIDDEN_CUSTOMER_DEFAULTS.phone,
      address: initialData?.address || "",
      postalCode: initialData?.postalCode || "",
      city: initialData?.city || HIDDEN_CUSTOMER_DEFAULTS.city,
      dateOfBirth: initialData?.dateOfBirth
        ? new Date(initialData.dateOfBirth)
        : new Date(HIDDEN_CUSTOMER_DEFAULTS.dateOfBirth),
      driverLicenseNumber: initialData?.driverLicenseNumber || "",
      driverLicenseFile: initialData?.driverLicenseFile,
    },
    mode: "onChange",
  });

  // Hydrate/reset when navigating back with existing data
  useEffect(() => {
    if (initialData) {
      form.reset({
        fullName: initialData.fullName || HIDDEN_CUSTOMER_DEFAULTS.fullName,
        email: initialData.email || "",
        phone: initialData.phone || HIDDEN_CUSTOMER_DEFAULTS.phone,
        address: initialData.address || "",
        postalCode: initialData.postalCode || "",
        city: initialData.city || HIDDEN_CUSTOMER_DEFAULTS.city,
        dateOfBirth: initialData.dateOfBirth
          ? new Date(initialData.dateOfBirth)
          : new Date(HIDDEN_CUSTOMER_DEFAULTS.dateOfBirth),
        driverLicenseNumber: initialData.driverLicenseNumber || "",
        driverLicenseFile: initialData.driverLicenseFile,
      });
      // Also hydrate local file preview state so dropzone shows the file name
      if (initialData.driverLicenseFile) {
        setLicenseFile(initialData.driverLicenseFile as File);
      }
    }
  }, [initialData, form]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("no-NO", {
      style: "currency",
      currency: "NOK",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
  const file = acceptedFiles[0];
  if (!file) return;

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    toast({
      title: "Ugyldig filtype",
      description: "Last opp en gyldig fil (JPEG, PNG eller PDF)",
      variant: "destructive",
    });
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast({
      title: "Filen er for stor",
      description: "Last opp en fil mindre enn 5 MB",
      variant: "destructive",
    });
    return;
  }

  setLicenseFile(file);
  
  // Create preview for images
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = () => {
      setLicensePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
}, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop,
  accept: {
    'image/jpeg': ['.jpeg', '.jpg'],
    'image/png': ['.png'],
    'application/pdf': ['.pdf']
  },
  maxFiles: 1,
});

const handleRemoveLicense = () => {
  setLicenseFile(null);
  setLicensePreview(null);
  // Clear the file input
  const fileInput = document.getElementById('driver-license-upload') as HTMLInputElement;
  if (fileInput) fileInput.value = '';
};

const uploadLicense = async (): Promise<string | null> => {
  if (!licenseFile) return null;

  try {
    setIsUploading(true);
    const fileExt = licenseFile.name.split('.').pop();
    const fileName = `${generateUniqueId()}.${fileExt}`;
    const filePath = `licenses/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('driver-licenses')
      .upload(filePath, licenseFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('driver-licenses')
      .getPublicUrl(filePath);

    return publicUrl;

  } catch (error) {
    console.error('Error uploading license:', error);
    toast({
      title: "Opplasting feilet",
      description: "Kunne ikke laste opp førerkort. Prøv igjen.",
      variant: "destructive",
    });
    return null;
  } finally {
    setIsUploading(false);
  }
};

  // const onSubmit = (data: CustomerData) => {
  //   const customerData: CustomerData = {
  //     ...data,
  //     driverLicenseFile: licenseFile || undefined,
  const handleSubmit = async (e: React.FormEvent, data: CustomerData) => {
    e.preventDefault();

    try {
      if (!licenseFile) {
        toast({
          title: "Feil",
          description: "Last opp et gyldig førerkort",
          variant: "destructive",
        });
        return;
      }

      // Upload license first
      const licenseUrl = await uploadLicense();
      if (!licenseUrl) {
        toast({
          title: "Feil",
          description: "Kunne ikke laste opp førerkort. Prøv igjen.",
          variant: "destructive",
        });
        return;
      }

      const customerData: CustomerData = {
        ...data,
        fullName: initialData?.fullName || HIDDEN_CUSTOMER_DEFAULTS.fullName,
        phone: initialData?.phone || HIDDEN_CUSTOMER_DEFAULTS.phone,
        city: initialData?.city || HIDDEN_CUSTOMER_DEFAULTS.city,
        dateOfBirth: initialData?.dateOfBirth
          ? new Date(initialData.dateOfBirth)
          : new Date(HIDDEN_CUSTOMER_DEFAULTS.dateOfBirth),
        driverLicenseFile: licenseUrl,
      };
      
      onComplete(customerData);
      console.log('customer data', customerData);

    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke sende skjemaet. Prøv igjen.",
        variant: "destructive",
      });
    }
  };

  const decorationSummary = (
    [
      bookingData.decorationFlowers && "Blomster",
      bookingData.decorationRibbon && "Bånd",
      bookingData.decorationRedCarpets && "Røde løpere",
      bookingData.decorationDriverNeed && "Sjåfør ønskes",
    ].filter(Boolean) as string[]
  );
  
  return (
    <div className="space-y-6">
      {/* Booking Summary */}
      <div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
        <h3 className="mb-4 text-lg font-semibold text-[#E3C08D]">Oppsummering</h3>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <div>
              <h4 className="font-medium text-[#b1bdc3]">{bookingData.car.name}</h4>
              <p className="text-sm text-[#9eabb1]">
                {format(new Date(bookingData.startDateTime), "PPP p", { locale: nb })} –{" "}
                {format(new Date(bookingData.endDateTime), "PPP p", { locale: nb })}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-[#9eabb1]" />
                <span className="text-[#b1bdc3]">{bookingData.pickupLocation}</span>
              </div>
              {bookingData.deliveryLocation && (
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-[#9eabb1]" />
                  <span className="text-[#b1bdc3]">Levering: {bookingData.deliveryLocation}</span>
                </div>
              )}
              <div className="border-t border-[#46555d] pt-3 text-xs leading-relaxed text-[#9eabb1]">
                <span className="font-medium text-[#b1bdc3]">Seter: </span>
                {bookingData.seatPricingMode === "daily-basis"
                  ? "Dagsbasis"
                  : "Fast pris"}
                {decorationSummary.length > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-[#b1bdc3]">Dekorasjon: </span>
                    {decorationSummary.join(", ")}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-[#E3C08D]">
              {formatPrice(bookingData.totalPrice)}
            </div>
            <div className="text-sm text-[#9eabb1]">
              Estimert total
            </div>
            <div className="mt-1 text-xs text-[#9eabb1]">
              {Math.ceil((new Date(bookingData.endDateTime).getTime() - new Date(bookingData.startDateTime).getTime()) / (1000 * 60 * 60 * 24))} dager
            </div>
          </div>
        </div>
      </div>

      <FormProvider {...form}>
        <form
          id="customer-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit((data) => handleSubmit(e, data))();
          }}
          className="space-y-6"
        >
          {/* Personal Information */}
          <div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
            <div className="mb-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-[#E3C08D]">
                <User className="h-5 w-5 text-primary" />
                Personopplysninger
              </h3>
              <p className="mt-1 text-sm text-[#9eabb1]">Fyll inn opplysningene dine for å fullføre bestillingen</p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
                <FormField
                  control={form.control}
                  name="email"
                  rules={{
                    required: "E-post er påkrevd",
                    pattern: {
                      value:
                        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Ugyldig e-postadresse",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">E-post <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="email"
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="navn@eksempel.no"
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
                  rules={{ required: "Adresse er påkrevd" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Adresse <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="Gateadresse ..."
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
                <FormField
                  control={form.control}
                  name="postalCode"
                  rules={{
                    required: "Postnummer er påkrevd",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Postnummer <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
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
                  name="driverLicenseNumber"
                  rules={{ required: "Førerkortnummer er påkrevd" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Førerkortnummer <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="Ditt førerkortnummer ..."
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
<div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
  <div className="mb-6">
    <h3 className="flex items-center gap-2 text-lg font-semibold text-[#E3C08D]">
      <FileText className="h-5 w-5 text-primary" />
      Førerkort
    </h3>
    <p className="mt-1 text-sm text-[#9eabb1]">
      Last opp gyldig førerkort (JPEG, PNG eller PDF, maks 5 MB)
    </p>
  </div>
  
  <div className="space-y-4">
    <div
      {...getRootProps()}
      className={cn(
        "cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition-colors",
        isDragActive
          ? "border-[#E3C08D] bg-[#1b2529]"
          : "border-[#46555d] bg-[#1b2529] hover:border-[#E3C08D]",
      )}
    >
      <input 
        {...getInputProps()} 
        id="driver-license-upload"
        className="hidden"
      />
      
      {isUploading ? (
        <div className="flex flex-col items-center justify-center py-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
          <p className="text-[#9eabb1]">Laster opp …</p>
        </div>
      ) : licensePreview ? (
        <div className="relative">
          {licenseFile?.type.startsWith('image/') ? (
            <img
              src={licensePreview}
              alt="Forhåndsvisning av førerkort"
              className="max-h-48 mx-auto mb-2 rounded-md"
            />
          ) : (
            <div className="mb-2 rounded-md bg-[#2a353a] p-4">
              <FileText className="h-12 w-12 mx-auto text-primary mb-2" />
              <p className="text-sm font-medium">{licenseFile?.name}</p>
              <p className="text-xs text-[#9eabb1]">
                {(licenseFile?.size || 0) / 1024 > 1024
                  ? `${((licenseFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB`
                  : `${Math.ceil((licenseFile?.size || 0) / 1024)} KB`}
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute -top-2 -right-2 rounded-full h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveLicense();
            }}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Fjern fil</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload className="mx-auto h-10 w-10 text-[#9eabb1]" />
          <p className="text-[#9eabb1]">
            {isDragActive
              ? "Slipp filen her …"
              : "Dra og slipp førerkortet her, eller klikk for å velge"}
          </p>
          <p className="text-sm text-[#9eabb1]">
            Støttet: JPEG, PNG, PDF (maks 5 MB)
          </p>
        </div>
      )}
    </div>
  </div>
</div>

          <Button
            type="submit"
            className="w-full bg-[#E3C08D] hover:bg-[#E3C08D]/90 text-white py-5 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:cursor-pointer"
            size="lg"
          >
            Fortsett
          </Button>
        </form>
      </FormProvider>
    </div>
  );
};