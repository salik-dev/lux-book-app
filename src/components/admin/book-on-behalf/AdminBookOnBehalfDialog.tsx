import React, { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Car,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  IdCard,
  Loader2,
  ShieldCheck,
  User,
  Mail as MailIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isPickupLeadTimeValid, MIN_PICKUP_LEAD_HOURS } from "@/lib/booking-time";
import { supabase } from "@/integrations/supabase/client";
import {
  computePricing,
  formatNOK,
  parseDateTimeLocal,
  precheckCarAvailability,
  toDateTimeLocalInputValue,
  useAdminCreateBooking,
  useAvailableCars,
  useVerifyDriverLicense,
} from "./hooks";
import type {
  AdminCarOption,
  CreateBookingResponse,
} from "./types";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const GOLD        = "#e3c08d";
const GOLD_LIGHT  = "rgba(227,192,141,0.12)";
const GOLD_BORDER = "rgba(227,192,141,0.40)";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingCreated?: (res: CreateBookingResponse) => void;
  /** Pre-select the vehicle (e.g. when launched from the admin calendar). */
  prefillCarId?: string;
  /** Pre-fill the pickup date/time. */
  prefillStart?: Date;
  /** Pre-fill the return date/time. */
  prefillEnd?: Date;
}

type Step = 1 | 2 | 3 | 4;

const DEFAULT_PICKUP = "Karl Johans gate 1, 0154 Oslo";
const defaultDelivery = "Oslo lufthavn Gardermoen, 2060 Gardermoen";

const bookingTimeSelectContentClass =
  "max-h-[min(240px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-y-auto p-1 " +
  "[scrollbar-color:#d1d5db_transparent] [scrollbar-width:thin] " +
  "[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d1d5db] [&::-webkit-scrollbar-track]:bg-transparent";

function bookingDatePopoverOnInteractOutside(e: { preventDefault: () => void; target: EventTarget | null }) {
  const el = e.target as HTMLElement | null;
  if (
    el?.closest?.('[data-slot="select-content"]') ||
    el?.closest?.("[data-radix-select-content]")
  ) {
    e.preventDefault();
  }
}

function parseLocalDateTimeValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toLocalDateTimeValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DateTimeTimeRow: React.FC<{
  dateValue: Date | null;
  onTimeChange: (next: Date) => void;
}> = ({ dateValue, onTimeChange }) => {
  const base = dateValue ? new Date(dateValue) : new Date();
  const hours = dateValue ? base.getHours() : 10;
  const minutes = dateValue ? base.getMinutes() : 0;

  const apply = (h: number, m: number) => {
    const next = dateValue ? new Date(dateValue) : new Date();
    next.setHours(h, m, 0, 0);
    onTimeChange(next);
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-3 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Time
      </p>
      <div className="flex items-center gap-2">
        <Select value={String(hours)} onValueChange={(v) => apply(parseInt(v, 10), minutes)}>
          <SelectTrigger className="h-8 w-[84px] shrink-0 rounded-md border-gray-200 bg-white text-xs">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent className={bookingTimeSelectContentClass}>
            {Array.from({ length: 24 }, (_, i) => (
              <SelectItem key={i} value={String(i)} className="text-xs">
                {String(i).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">:</span>
        <Select value={String(minutes)} onValueChange={(v) => apply(hours, parseInt(v, 10))}>
          <SelectTrigger className="h-8 w-[84px] shrink-0 rounded-md border-gray-200 bg-white text-xs">
            <SelectValue placeholder="mm" />
          </SelectTrigger>
          <SelectContent className={bookingTimeSelectContentClass}>
            {Array.from({ length: 60 }, (_, i) => (
              <SelectItem key={i} value={String(i)} className="text-xs">
                {String(i).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const DateTimePickerField: React.FC<{
  label: string;
  valueLocal: string;
  onChangeLocal: (v: string) => void;
  minDate?: Date;
}> = ({ label, valueLocal, onChangeLocal, minDate }) => {
  const dateValue = parseLocalDateTimeValue(valueLocal);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-left text-sm text-gray-800 hover:bg-gray-100 transition-colors inline-flex items-center"
          >
            {dateValue ? dateValue.toLocaleString() : "Select date"}
            <CalendarIcon className="ml-auto h-4 w-4 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto border-gray-200 bg-white p-0"
          align="start"
          onInteractOutside={bookingDatePopoverOnInteractOutside}
        >
          <div>
            <Calendar
              mode="single"
              selected={dateValue ?? undefined}
              onSelect={(date: Date | undefined) => {
                if (!date) return;
                const next = new Date(date.getTime());
                if (dateValue) {
                  next.setHours(dateValue.getHours(), dateValue.getMinutes(), 0, 0);
                } else {
                  next.setHours(10, 0, 0, 0);
                }
                onChangeLocal(toLocalDateTimeValue(next));
              }}
              disabled={(date) => {
                if (!minDate) return false;
                const min = new Date(minDate);
                min.setHours(0, 0, 0, 0);
                return date < min;
              }}
              captionLayout="label"
              initialFocus
              required
            />
            <DateTimeTimeRow
              dateValue={dateValue}
              onTimeChange={(next) => onChangeLocal(toLocalDateTimeValue(next))}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const AdminBookOnBehalfDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  onBookingCreated,
  prefillCarId,
  prefillStart,
  prefillEnd,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // Step 1 — manually-entered customer details, verified via driver's licence.
  const [customerFullName, setCustomerFullName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerNin, setCustomerNin] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPostalCode, setCustomerPostalCode] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<"idle" | "checking" | "verified" | "failed">("idle");
  const [licenseCategories, setLicenseCategories] = useState<string[]>([]);
  const [licenseFullName, setLicenseFullName] = useState("");
  const [licenseError, setLicenseError] = useState("");
  const { verify: verifyLicense } = useVerifyDriverLicense();
  const [bookingForCompany, setBookingForCompany] = useState(false);
  const [orgNo, setOrgNo] = useState("");
  const [orgName, setOrgName] = useState("");

  const handleVerifyLicense = async () => {
    if (!/^\d{11}$/.test(customerNin)) {
      toast({ title: "Invalid national ID number", description: "National ID number must be 11 digits.", variant: "destructive" });
      return;
    }
    if (!customerLastName.trim()) {
      toast({ title: "Last name required", description: "Enter the customer's last name before verifying.", variant: "destructive" });
      return;
    }
    setLicenseStatus("checking");
    setLicenseError("");
    try {
      const result = await verifyLicense(customerNin, customerLastName.trim());
      setLicenseCategories(result.categories);
      setLicenseFullName(result.fullName);
      setLicenseStatus("verified");
      toast({
        title: "Driver's licence verified",
        description: result.categories.length ? `Licence categories: ${result.categories.join(", ")}` : "No active driver's licence categories found.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error during driver's licence verification.";
      setLicenseStatus("failed");
      setLicenseError(message);
      setLicenseCategories([]);
      setLicenseFullName("");
      toast({ title: "Verification failed", description: message, variant: "destructive" });
    }
  };

  // Step 2
  const { cars, loading: carsLoading } = useAvailableCars(open);
  const [carId, setCarId] = useState<string>("");
  const selectedCar: AdminCarOption | null = useMemo(
    () => cars.find((c) => c.id === carId) ?? null,
    [cars, carId]
  );
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  }, []);
  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  }, []);
  const [startLocal, setStartLocal] = useState(toDateTimeLocalInputValue(defaultStart));
  const [endLocal, setEndLocal] = useState(toDateTimeLocalInputValue(defaultEnd));
  const [pickupLocation, setPickupLocation] = useState(DEFAULT_PICKUP);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("0");
  const [decorationRequired, setDecorationRequired] = useState(false);
  const [withDriver, setWithDriver] = useState(false);
  const [pricingMode, setPricingMode] = useState<"flat-rate" | "daily-basis">("flat-rate");
  const [pricingModeTouched, setPricingModeTouched] = useState(false);

  // Step 3
  const [language, setLanguage] = useState<"en" | "no">("en");

  const { createBooking, loading: creating, data: createdBooking, reset: resetMutation } =
    useAdminCreateBooking();

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setCustomerFullName("");
        setCustomerLastName("");
        setCustomerNin("");
        setCustomerEmail("");
        setCustomerPhone("");
        setCustomerAddress("");
        setCustomerPostalCode("");
        setCustomerCity("");
        setLicenseStatus("idle");
        setLicenseCategories([]);
        setLicenseFullName("");
        setLicenseError("");
        setBookingForCompany(false);
        setOrgNo("");
        setOrgName("");
        setCarId("");
        setStartLocal(toDateTimeLocalInputValue(defaultStart));
        setEndLocal(toDateTimeLocalInputValue(defaultEnd));
        setPickupLocation(DEFAULT_PICKUP);
        setDeliveryLocation("");
        setDeliveryFee(0);
        setDeliveryFeeInput("0");
        setDecorationRequired(false);
        setWithDriver(false);
        setPricingMode("flat-rate");
        setPricingModeTouched(false);
        setLanguage("en");
        resetMutation();
      }, 350);
    }
  }, [open, defaultStart, defaultEnd, resetMutation]);

  // Until the admin picks a pricing mode explicitly, keep it in sync with the
  // duration-based rule (<=24h => hourly, otherwise daily).
  useEffect(() => {
    if (pricingModeTouched) return;
    const s = parseDateTimeLocal(startLocal);
    const e = parseDateTimeLocal(endLocal);
    if (!s || !e || e <= s) return;
    const hours = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60)));
    setPricingMode(hours >= 24 ? "daily-basis" : "flat-rate");
  }, [startLocal, endLocal, pricingModeTouched]);

  // Apply calendar prefill (car + date range) whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (prefillCarId) setCarId(prefillCarId);
    if (prefillStart) setStartLocal(toDateTimeLocalInputValue(prefillStart));
    if (prefillEnd) setEndLocal(toDateTimeLocalInputValue(prefillEnd));
  }, [open, prefillCarId, prefillStart, prefillEnd]);

  const start = parseDateTimeLocal(startLocal);
  const end = parseDateTimeLocal(endLocal);
  const pricing = useMemo(
    () => computePricing(start, end, selectedCar, deliveryFee, withDriver, pricingMode),
    [start, end, selectedCar, deliveryFee, withDriver, pricingMode]
  );

  const ninValid = /^\d{11}$/.test(customerNin);
  const customerDetailsFilled =
    customerFullName.trim().length > 0 &&
    customerLastName.trim().length > 0 &&
    ninValid &&
    customerEmail.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    customerAddress.trim().length > 0 &&
    customerPostalCode.trim().length > 0;
  const canAdvanceFrom1 =
    customerDetailsFilled &&
    licenseStatus === "verified" &&
    (!bookingForCompany || (orgNo.trim().length > 0 && orgName.trim().length > 0));
  const canAdvanceFrom2 =
    !!selectedCar && !!start && !!end && end > start &&
    pickupLocation.trim().length > 0 && !!pricing &&
    isPickupLeadTimeValid(start);

  const canGoNext =
    step === 1 ? canAdvanceFrom1 :
    step === 2 ? canAdvanceFrom2 : true;

  const isLastStep = step === 3;

  function goNext() {
    setDirection("forward");
    setStep((s) => ((s + 1) as Step));
  }
  function goBack() {
    setDirection("back");
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  async function handleNextClick() {
    if (step !== 2) {
      goNext();
      return;
    }
    if (!selectedCar || !start || !end) return;

    setCheckingAvailability(true);
    try {
      const check = await precheckCarAvailability({
        carId: selectedCar.id,
        startDateTimeIso: start.toISOString(),
        endDateTimeIso: end.toISOString(),
      });

      if (!check.ok) {
        toast({
          title: "Car unavailable for selected time",
          description: check.reason,
          variant: "destructive",
        });
        return;
      }

      goNext();
    } finally {
      setCheckingAvailability(false);
    }
  }

  async function handleSubmit() {
    if (!canAdvanceFrom1 || !selectedCar || !start || !end || !pricing) return;
    try {
      const res = await createBooking({
        customerFullName: customerFullName.trim(),
        customerLastName: customerLastName.trim(),
        customerNin,
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        customerPostalCode: customerPostalCode.trim(),
        customerCity: customerCity.trim() || null,
        licenseVerified: licenseStatus === "verified",
        licenseCategories,
        carId: selectedCar.id,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        pickupLocation: pickupLocation.trim(),
        deliveryLocation: deliveryLocation.trim() || null,
        deliveryFee: pricing.deliveryFee,
        bookingForCompany,
        orgName: bookingForCompany ? orgName.trim() || null : null,
        orgNo: bookingForCompany ? orgNo.trim() || null : null,
        decorationRequired,
        withDriver,
        basePrice: pricing.basePrice,
        totalPrice: pricing.totalPrice,
        vatAmount: pricing.vatAmount,
        language,
      });

      // Safety net: persist organization fields client-side as well, so values are
      // saved even if the deployed edge function is still on an older version.
      const { error: orgPatchErr } = await supabase
        .from("bookings")
        .update({
          org_name: bookingForCompany ? orgName.trim() || null : null,
          org_no: bookingForCompany ? orgNo.trim() || null : null,
        })
        .eq("id", res.bookingId);
      if (orgPatchErr) {
        console.warn("Failed to persist organization fields on client fallback:", orgPatchErr.message);
      }

      toast({
        title: "Booking created",
        description: `${res.bookingNumber} • invoice email sent to ${customerEmail.trim()}`,
      });
      onBookingCreated?.(res);
      setStep(4);
    } catch (err) {
      toast({
        title: "Failed to create booking",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>

        {/* ── Backdrop ─────────────────────────────────────────────────── */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "duration-300"
          )}
        />

        {/* ── Panel ────────────────────────────────────────────────────── */}
        <DialogPrimitive.Content
          data-booking-sheet
          className="fixed right-0 top-0 z-50 flex flex-col bg-white w-full max-w-[680px]"
          style={{ height: "100dvh", boxShadow: "-2px 0 40px rgba(0,0,0,0.18)" }}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
            <div>
              <DialogPrimitive.Title className="text-[17px] font-bold text-gray-900 leading-tight">
                Book on behalf of customer
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-gray-400">
                Enter the customer's details and verify their driver's licence to continue.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                className="shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* ── Step indicator ─────────────────────────────────────────── */}
          <div className="shrink-0 px-6 pt-4 pb-3">
            <StepIndicator step={step} />
          </div>

          {/* ── Scrollable body — min-h-0 keeps footer visible ─────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto sheet-scroll px-6 pb-6 pt-1">
            {/* key=step remounts the div on each step change → triggers CSS animation */}
            <div key={step} className={direction === "forward" ? "step-enter-forward" : "step-enter-back"}>
              {step === 1 && (
                <CustomerDetailsStep
                  fullName={customerFullName} setFullName={setCustomerFullName}
                  lastName={customerLastName}
                  setLastName={(v) => { setCustomerLastName(v); setLicenseStatus("idle"); }}
                  nin={customerNin}
                  setNin={(v) => { setCustomerNin(v); setLicenseStatus("idle"); }}
                  email={customerEmail} setEmail={setCustomerEmail}
                  phone={customerPhone} setPhone={setCustomerPhone}
                  address={customerAddress} setAddress={setCustomerAddress}
                  postalCode={customerPostalCode} setPostalCode={setCustomerPostalCode}
                  city={customerCity} setCity={setCustomerCity}
                  licenseStatus={licenseStatus}
                  licenseCategories={licenseCategories}
                  licenseFullName={licenseFullName}
                  licenseError={licenseError}
                  onVerifyLicense={handleVerifyLicense}
                  bookingForCompany={bookingForCompany}
                  setBookingForCompany={setBookingForCompany}
                  orgNo={orgNo}
                  setOrgNo={setOrgNo}
                  orgName={orgName}
                  setOrgName={setOrgName}
                />
              )}
              {step === 2 && (
                <BookingDetailsStep
                  cars={cars}
                  carsLoading={carsLoading}
                  carId={carId}
                  setCarId={setCarId}
                  startLocal={startLocal}
                  setStartLocal={setStartLocal}
                  endLocal={endLocal}
                  setEndLocal={setEndLocal}
                  pickupLocation={pickupLocation}
                  setPickupLocation={setPickupLocation}
                  deliveryLocation={deliveryLocation}
                  setDeliveryLocation={setDeliveryLocation}
                  deliveryFee={deliveryFee}
                  setDeliveryFee={setDeliveryFee}
                  deliveryFeeInput={deliveryFeeInput}
                  setDeliveryFeeInput={setDeliveryFeeInput}
                  decorationRequired={decorationRequired}
                  setDecorationRequired={setDecorationRequired}
                  withDriver={withDriver}
                  setWithDriver={setWithDriver}
                  pricingMode={pricingMode}
                  setPricingMode={(v) => { setPricingModeTouched(true); setPricingMode(v); }}
                  pricing={pricing}
                />
              )}
              {step === 3 && selectedCar && start && end && pricing && (
                <ReviewStep
                  customerFullName={customerFullName}
                  customerLastName={customerLastName}
                  customerEmail={customerEmail}
                  customerPhone={customerPhone}
                  licenseCategories={licenseCategories}
                  car={selectedCar}
                  start={start}
                  end={end}
                  pickupLocation={pickupLocation}
                  deliveryLocation={deliveryLocation}
                  decorationRequired={decorationRequired}
                  withDriver={withDriver}
                  pricing={pricing}
                  language={language}
                  setLanguage={setLanguage}
                />
              )}
              {step === 4 && createdBooking && (
                <SuccessStep
                  booking={createdBooking}
                  customerEmail={customerEmail}
                  language={language}
                />
              )}
            </div>
          </div>

          {/* ── Footer — always visible ──────────────────────────────────── */}
          <div
            className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-white"
            style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.05)" }}
          >
            {step === 4 ? (
              <div className="flex w-full justify-end">
                <GoldButton onClick={() => onOpenChange(false)} className="px-8">
                  Done
                </GoldButton>
              </div>
            ) : (
              <>
                {/* Back — disabled on step 1 */}
                <button
                  type="button"
                  disabled={step === 1 || creating || checkingAvailability}
                  onClick={goBack}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-150",
                    "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                    (step === 1 || creating) && "opacity-30 pointer-events-none"
                  )}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>

                {/* Next / Submit */}
                {isLastStep ? (
                  <GoldButton
                    onClick={handleSubmit}
                    disabled={creating}
                    className="px-5 min-w-[220px] justify-center"
                  >
                    {creating
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Creating booking…</>
                      : <><MailIcon className="h-3.5 w-3.5" />Create booking &amp; send invoice</>
                    }
                  </GoldButton>
                ) : (
                  <GoldButton
                    onClick={handleNextClick}
                    disabled={!canGoNext || checkingAvailability}
                    className="px-5"
                  >
                    {checkingAvailability ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </GoldButton>
                )}
              </>
            )}
          </div>

        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

// ─── Gold CTA button (avoids dark-theme variable bleed) ──────────────────────

const GoldButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }> = ({
  children,
  disabled,
  className,
  ...rest
}) => (
  <button
    type="button"
    disabled={disabled}
    className={cn(
      "inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150",
      "focus:outline-none focus-visible:ring-2",
      disabled ? "opacity-50 pointer-events-none" : "hover:opacity-90 active:scale-[0.98]",
      className
    )}
    style={{
      backgroundColor: disabled ? "rgba(227,192,141,0.55)" : GOLD,
      color: "#1a1208",
    }}
    {...rest}
  >
    {children}
  </button>
);

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Customer" },
  { n: 2, label: "Details" },
  { n: 3, label: "Review" },
  { n: 4, label: "Done" },
] as const;

const StepIndicator: React.FC<{ step: Step }> = ({ step }) => (
  <div className="flex items-center gap-0">
    {STEPS.map(({ n, label }, i) => {
      const active = n === step;
      const done = n < step;
      return (
        <React.Fragment key={n}>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Circle */}
            <div
              className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all duration-200",
              )}
              style={
                active
                  ? { backgroundColor: GOLD, color: "#1a1208" }
                  : done
                  ? { backgroundColor: "#dcfce7", color: "#166534" }
                  : { backgroundColor: "#f3f4f6", color: "#9ca3af" }
              }
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} /> : n}
            </div>
            {/* Label */}
            <span
              className={cn("text-xs font-medium whitespace-nowrap transition-colors duration-200")}
              style={
                active ? { color: GOLD } :
                done ? { color: "#166534" } :
                { color: "#9ca3af" }
              }
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="flex-1 h-px mx-2"
              style={{ backgroundColor: n < step ? "#86efac" : "#e5e7eb" }}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Step 1: Customer details (manual entry + driver's-licence verification) ──

const fieldInputClass =
  "w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white transition-colors";

interface CustomerDetailsStepProps {
  fullName: string; setFullName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  nin: string; setNin: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  address: string; setAddress: (v: string) => void;
  postalCode: string; setPostalCode: (v: string) => void;
  city: string; setCity: (v: string) => void;
  licenseStatus: "idle" | "checking" | "verified" | "failed";
  licenseCategories: string[];
  licenseFullName: string;
  licenseError: string;
  onVerifyLicense: () => void;
  bookingForCompany: boolean;
  setBookingForCompany: (v: boolean) => void;
  orgNo: string;
  setOrgNo: (v: string) => void;
  orgName: string;
  setOrgName: (v: string) => void;
}

const CustomerDetailsStep: React.FC<CustomerDetailsStepProps> = ({
  fullName, setFullName, lastName, setLastName, nin, setNin, email, setEmail,
  phone, setPhone, address, setAddress, postalCode, setPostalCode, city, setCity,
  licenseStatus, licenseCategories, licenseFullName, licenseError, onVerifyLicense,
  bookingForCompany, setBookingForCompany, orgNo, setOrgNo, orgName, setOrgName,
}) => (
  <div className="space-y-4">
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 min-h-[300px]">
      <div className="flex items-center gap-2">
        <User className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Customer details</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>First name</FieldLabel>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="First name" className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>Last name</FieldLabel>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>National ID number (NIN)</FieldLabel>
          <input
            value={nin}
            onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="11 digits"
            inputMode="numeric"
            className={fieldInputClass}
          />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>City</FieldLabel>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>Address</FieldLabel>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>Postal code</FieldLabel>
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal code" className={fieldInputClass} />
        </div>
      </div>
    </div>

    {/* Driver's licence verification */}
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <IdCard className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Driver's licence verification</span>
        </div>
        <button
          type="button"
          onClick={onVerifyLicense}
          disabled={licenseStatus === "checking" || licenseStatus === "verified"}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none hover:opacity-90"
          style={{ backgroundColor: GOLD, color: "#1a1208" }}
        >
          {licenseStatus === "checking" ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Verifying…</>
          ) : licenseStatus === "verified" ? (
            <><CheckCircle2 className="h-3.5 w-3.5" />Verified</>
          ) : (
            "Verify licence"
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Verifies against Statens Vegvesen using the national ID number and last name above.
      </p>
      {licenseStatus === "verified" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="font-semibold">{licenseFullName || "Licence verified"}</span>
          {licenseCategories.length > 0 && <span> — categories: {licenseCategories.join(", ")}</span>}
        </div>
      )}
      {licenseStatus === "failed" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {licenseError || "Driver's licence could not be verified."}
        </div>
      )}
    </div>

    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={bookingForCompany}
          onChange={(e) => setBookingForCompany(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
          style={{ accentColor: GOLD }}
        />
        <span className="text-xs text-gray-700">Booking for company</span>
      </label>

      {bookingForCompany && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel>Organization number</FieldLabel>
            <input
              value={orgNo}
              onChange={(e) => setOrgNo(e.target.value)}
              placeholder="e.g. 999999999"
              className={fieldInputClass}
            />
          </div>
          <div>
            <FieldLabel>Organization name</FieldLabel>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Company AS"
              className={fieldInputClass}
            />
          </div>
        </div>
      )}
    </div>
  </div>
);

// ─── Car picker ───────────────────────────────────────────────────────────────

interface CarPickerProps {
  cars: AdminCarOption[];
  loading: boolean;
  value: string;
  onChange: (id: string) => void;
}

const CarPicker: React.FC<CarPickerProps> = ({ cars, loading, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = cars.find((c) => c.id === value) ?? null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger — no focus ring; plain border always */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-left transition-colors duration-150 focus:outline-none hover:border-gray-300"
      >
        {selected ? (
          <>
            <div className="w-[72px] h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-gray-200 flex items-center justify-center">
              {selected.image_url
                ? <img src={selected.image_url} alt={selected.name} className="w-full h-full object-cover" />
                : <Car className="h-5 w-5 text-gray-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{selected.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {selected.brand} {selected.model} &nbsp;·&nbsp;
                <span className="text-gray-600 font-medium">{formatNOK(selected.base_price_per_day)}/day</span>
              </div>
            </div>
          </>
        ) : (
          <span className="text-sm text-gray-400 flex-1">
            {loading ? "Loading vehicles…" : "Select a vehicle"}
          </span>
        )}
        <ChevronDown
          className={cn("h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-gray-200 bg-white overflow-hidden"
          style={{ boxShadow: "0 8px 28px rgba(0,0,0,0.10)" }}
        >
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-5 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: GOLD }} />
              Loading vehicles…
            </div>
          ) : cars.length === 0 ? (
            <div className="px-4 py-5 text-sm text-gray-400">No vehicles available.</div>
          ) : (
            <ul className="max-h-60 overflow-y-auto sheet-scroll divide-y divide-gray-100">
              {cars.map((car) => {
                const isSel = car.id === value;
                return (
                  <li key={car.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(car.id); setOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left focus:outline-none"
                      style={{ backgroundColor: isSel ? GOLD_LIGHT : undefined }}
                      onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = "#f9fafb"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSel ? GOLD_LIGHT : ""; }}
                    >
                      {/* Car image 80 × 56 */}
                      <div className="w-[72px] h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                        {car.image_url
                          ? <img src={car.image_url} alt={car.name} className="w-full h-full object-cover" />
                          : <Car className="h-5 w-5 text-gray-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate leading-tight">{car.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 truncate">{car.brand} {car.model}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-gray-700">{formatNOK(car.base_price_per_day)}/day</span>
                          <span className="text-gray-300 text-[10px]">·</span>
                          <span className="text-[11px] text-gray-400">{formatNOK(car.base_price_per_hour)}/hr</span>
                        </div>
                      </div>
                      {isSel && (
                        <div className="h-4 w-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: GOLD }}>
                          <CheckCircle2 className="h-2.5 w-2.5" style={{ color: "#1a1208" }} />
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Step 2: Booking details ──────────────────────────────────────────────────

interface BookingDetailsStepProps {
  cars: AdminCarOption[];
  carsLoading: boolean;
  carId: string;
  setCarId: (v: string) => void;
  startLocal: string;
  setStartLocal: (v: string) => void;
  endLocal: string;
  setEndLocal: (v: string) => void;
  pickupLocation: string;
  setPickupLocation: (v: string) => void;
  deliveryLocation: string;
  setDeliveryLocation: (v: string) => void;
  deliveryFee: number;
  setDeliveryFee: (v: number) => void;
  deliveryFeeInput: string;
  setDeliveryFeeInput: (v: string) => void;
  decorationRequired: boolean;
  setDecorationRequired: (v: boolean) => void;
  withDriver: boolean;
  setWithDriver: (v: boolean) => void;
  pricingMode: "flat-rate" | "daily-basis";
  setPricingMode: (v: "flat-rate" | "daily-basis") => void;
  pricing: ReturnType<typeof computePricing>;
}

const BookingDetailsStep: React.FC<BookingDetailsStepProps> = ({
  cars, carsLoading, carId, setCarId,
  startLocal, setStartLocal, endLocal, setEndLocal,
  pickupLocation, setPickupLocation,
  deliveryLocation, setDeliveryLocation,
  deliveryFee, setDeliveryFee, deliveryFeeInput, setDeliveryFeeInput,
  decorationRequired, setDecorationRequired,
  withDriver, setWithDriver,
  pricingMode, setPricingMode,
  pricing,
}) => {
  const startDate = parseLocalDateTimeValue(startLocal);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
  <div className="space-y-5">
    {/* Vehicle */}
    <div>
      <FieldLabel>Vehicle</FieldLabel>
      <CarPicker cars={cars} loading={carsLoading} value={carId} onChange={setCarId} />
    </div>

    {/* Dates (same functional style as customer booking form) */}
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Select date and time</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DateTimePickerField
          label="Pickup (date and time)"
          valueLocal={startLocal}
          onChangeLocal={setStartLocal}
          minDate={today}
        />
        <DateTimePickerField
          label="Return (date and time)"
          valueLocal={endLocal}
          onChangeLocal={setEndLocal}
          minDate={startDate ?? today}
        />
      </div>
      {startDate && !isPickupLeadTimeValid(startDate) ? (
        <p className="text-[11px] text-red-600">
          Pickup time must be at least {MIN_PICKUP_LEAD_HOURS} hour from now.
        </p>
      ) : (
        <p className="text-[11px] text-gray-500">
          Return time must be after pickup time.
        </p>
      )}
    </div>

    {/* Rental pricing preference */}
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Rental pricing</span>
      </div>
      <div className="flex items-center gap-6">
        {(
          [
            { value: "flat-rate" as const, label: "Per hour" },
            { value: "daily-basis" as const, label: "Per day" },
          ] as const
        ).map((option) => (
          <label key={option.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="admin-pricing-mode"
              checked={pricingMode === option.value}
              onChange={() => setPricingMode(option.value)}
              className="h-3.5 w-3.5"
              style={{ accentColor: GOLD }}
            />
            <span className="text-xs text-gray-700">{option.label}</span>
          </label>
        ))}
      </div>
    </div>

    {/* Pickup + delivery location — same row */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <FieldLabel>Pickup location</FieldLabel>
        <StaticField value={pickupLocation} placeholder="Not set" />
      </div>
      <div>
        <FieldLabel>Delivery location</FieldLabel>
        <StaticField value={deliveryLocation || defaultDelivery} placeholder="No delivery — customer picks up" />
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={decorationRequired}
          onChange={(e) => setDecorationRequired(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
          style={{ accentColor: GOLD }}
        />
        <span className="text-xs text-gray-700">Decoration required</span>
      </label>

      <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={withDriver}
          onChange={(e) => setWithDriver(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
          style={{ accentColor: GOLD }}
        />
        <span className="text-xs text-gray-700">With driver (+25% on booking amount)</span>
      </label>
    </div>

    {/* Pricing preview */}
    {pricing && (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Pricing preview</div>
        <dl className="text-sm space-y-1.5">
          <PricingRow label="Duration" value={`${pricing.durationHours} h`} />
          <PricingRow label="Base price" value={formatNOK(pricing.basePrice)} />
          {pricing.depositAmount > 0 && (
            <PricingRow label="Deposit" value={formatNOK(pricing.depositAmount)} />
          )}
          {pricing.driverSurcharge > 0 && (
            <PricingRow label="Driver surcharge (25%)" value={formatNOK(pricing.driverSurcharge)} />
          )}
          <div className="pt-2 mt-1 border-t border-gray-200 flex justify-between">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-gray-900 text-base">{formatNOK(pricing.totalPrice)}</span>
          </div>
        </dl>
      </div>
    )}
  </div>
  );
};

// ─── Step 3: Review ───────────────────────────────────────────────────────────

interface ReviewStepProps {
  customerFullName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  licenseCategories: string[];
  car: AdminCarOption;
  start: Date;
  end: Date;
  pickupLocation: string;
  deliveryLocation: string;
  decorationRequired: boolean;
  withDriver: boolean;
  pricing: NonNullable<ReturnType<typeof computePricing>>;
  language: "en" | "no";
  setLanguage: (v: "en" | "no") => void;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  customerFullName, customerLastName, customerEmail, customerPhone, licenseCategories,
  car, start, end, pickupLocation, deliveryLocation, decorationRequired, withDriver, pricing, language, setLanguage,
}) => (
  <div className="space-y-3">

    {/* Customer + Vehicle side-by-side */}
    <div className="grid grid-cols-2 gap-3">

      {/* Customer */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Customer</span>
        </div>
        <div className="px-3 py-3 flex items-start gap-2.5">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: GOLD_LIGHT }}
          >
            <User className="h-4 w-4" style={{ color: GOLD }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{customerFullName} {customerLastName}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{customerEmail}</p>
            {customerPhone && <p className="text-xs text-gray-400">{customerPhone}</p>}
            <span
              className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: "#dcfce7", color: "#166534" }}
            >
              <ShieldCheck className="h-2.5 w-2.5" />
              Licence verified{licenseCategories.length > 0 ? ` (${licenseCategories.join(", ")})` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Vehicle */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Vehicle</span>
        </div>
        {car.image_url ? (
          <img src={car.image_url} alt={car.name} className="w-full h-24 object-cover" />
        ) : (
          <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
            <Car className="h-8 w-8 text-gray-300" />
          </div>
        )}
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{car.name}</p>
          <p className="text-xs text-gray-500">{car.brand} {car.model}</p>
        </div>
      </div>
    </div>

    {/* Booking details */}
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Booking details</span>
      </div>
      <div className="px-3 py-3 space-y-2 text-sm">
        <ReviewRow label="Pickup" value={start.toLocaleString()} />
        <ReviewRow label="Return" value={end.toLocaleString()} />
        <ReviewRow label="Pickup location" value={pickupLocation} />
        {deliveryLocation && <ReviewRow label="Delivery location" value={deliveryLocation} />}
        {decorationRequired && <ReviewRow label="Decoration" value="Required" />}
        {withDriver && <ReviewRow label="Driver" value="Included (+25%)" />}
      </div>
    </div>

    {/* Total */}
    <div
      className="rounded-xl px-4 py-3.5 flex items-center justify-between"
      style={{ backgroundColor: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}` }}
    >
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Invoice total</p>
        <p className="text-xs text-gray-400">
          Base {formatNOK(pricing.basePrice)}
          {pricing.depositAmount > 0 ? ` + Deposit ${formatNOK(pricing.depositAmount)}` : ""}
          {pricing.driverSurcharge > 0 ? ` + Driver ${formatNOK(pricing.driverSurcharge)}` : ""}
        </p>
      </div>
      <span className="text-2xl font-bold text-gray-900">{formatNOK(pricing.totalPrice)}</span>
    </div>

    {/* Language + info row */}
    <div className="flex items-center gap-3">
      <div
        className="flex-1 px-3 py-2.5 rounded-xl text-xs text-gray-500 leading-relaxed"
        style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd" }}
      >
        Invoice email → <strong className="text-gray-700">{customerEmail}</strong>
        &nbsp;· booking status: <strong className="text-gray-700">pending</strong>
        &nbsp;· Stripe link valid 24 h
      </div>
      <div className="shrink-0">
        <p className="text-xs text-gray-500 mb-1 text-right">Email language</p>
        <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "no")}>
          <SelectTrigger className="w-28 h-8 rounded-lg border-gray-200 bg-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-gray-200">
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="no">Norsk</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
);

// ─── Step 4: Success ──────────────────────────────────────────────────────────

const SuccessStep: React.FC<{ booking: CreateBookingResponse; customerEmail: string; language: "en" | "no" }> = ({
  booking, customerEmail, language,
}) => {
  const { toast } = useToast();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!booking.checkoutUrl) return;
    setResending(true);
    try {
      const { error } = await supabase.functions.invoke("send-booking-email", {
        body: {
          bookingId: booking.bookingId,
          emailType: "admin_invoice",
          language,
          checkoutUrl: booking.checkoutUrl,
        },
      });
      if (error) throw error;
      toast({ title: "Email sent", description: `Invoice resent to ${customerEmail}` });
    } catch (err) {
      toast({
        title: "Could not resend email",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="h-16 w-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "#dcfce7" }}>
        <CheckCircle2 className="h-8 w-8" style={{ color: "#16a34a" }} />
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-gray-900">Booking created!</p>
        <p className="text-sm text-gray-500 mt-1">
          #{booking.bookingNumber} — invoice sent to {customerEmail}
        </p>
      </div>

      {booking.checkoutUrl && (
        <div className="w-full rounded-xl border border-gray-200 p-4 bg-gray-50">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Stripe checkout link
          </div>
          <div className="flex items-start gap-2">
            <code className="text-xs break-all bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 leading-relaxed text-gray-700">
              {booking.checkoutUrl}
            </code>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(booking.checkoutUrl!); toast({ title: "Link copied" }); }}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors shrink-0"
            >
              <Copy className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Expires in 24 hours.</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none hover:opacity-90"
            style={{ backgroundColor: GOLD, color: "#1a1208" }}
          >
            {resending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Resending…</>
            ) : (
              <><MailIcon className="h-3.5 w-3.5" />Resend invoice email</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Micro helpers ────────────────────────────────────────────────────────────

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-semibold text-gray-500 mb-1">{children}</label>
);

const StaticField: React.FC<{ value: string; placeholder?: string }> = ({ value, placeholder }) => (
  <div className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs min-h-[38px] flex items-center">
    {value
      ? <span className="text-gray-800">{value}</span>
      : <span className="text-gray-400 italic">{placeholder}</span>}
  </div>
);

const StyledInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input
    className={cn(
      "w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900",
      "placeholder-gray-400 focus:outline-none focus:bg-white focus:border-transparent transition-all",
      className
    )}
    style={{ "--tw-ring-color": GOLD } as React.CSSProperties}
    onFocus={(e) => {
      e.currentTarget.style.outline = `2px solid ${GOLD}`;
      e.currentTarget.style.outlineOffset = "0px";
      props.onFocus?.(e);
    }}
    onBlur={(e) => {
      e.currentTarget.style.outline = "";
      props.onBlur?.(e);
    }}
    {...props}
  />
);

const PricingRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-800">{value}</span>
  </div>
);

const ReviewCard: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-xl border border-gray-200 p-4">
    <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{label}</div>
    {children}
  </div>
);

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <span className="text-gray-500 shrink-0">{label}</span>
    <span className="text-gray-800 text-right">{value}</span>
  </div>
);
