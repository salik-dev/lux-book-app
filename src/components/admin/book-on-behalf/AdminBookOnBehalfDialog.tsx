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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  Search,
  ShieldCheck,
  User,
  Mail as MailIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computePricing,
  formatNOK,
  parseDateTimeLocal,
  toDateTimeLocalInputValue,
  useAdminCreateBooking,
  useAvailableCars,
  useEligibleCustomers,
} from "./hooks";
import type {
  AdminCarOption,
  CreateBookingResponse,
  EligibleCustomer,
} from "./types";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const GOLD        = "#e3c08d";
const GOLD_LIGHT  = "rgba(227,192,141,0.12)";
const GOLD_BORDER = "rgba(227,192,141,0.40)";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingCreated?: (res: CreateBookingResponse) => void;
}

type Step = 1 | 2 | 3 | 4;

const DEFAULT_PICKUP = "Karl Johans gate 1, 0154 Oslo";
const defaultDelivery = "Oslo lufthavn Gardermoen, 2060 Gardermoen";

export const AdminBookOnBehalfDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  onBookingCreated,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // Step 1
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<EligibleCustomer | null>(null);
  const { data: customersPage, loading: customersLoading, error: customersError } =
    useEligibleCustomers(searchQuery, page, 10);

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

  // Step 3
  const [language, setLanguage] = useState<"en" | "no">("en");

  const { createBooking, loading: creating, data: createdBooking, reset: resetMutation } =
    useAdminCreateBooking();

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setSearchQuery("");
        setPage(0);
        setSelectedCustomer(null);
        setCarId("");
        setStartLocal(toDateTimeLocalInputValue(defaultStart));
        setEndLocal(toDateTimeLocalInputValue(defaultEnd));
        setPickupLocation(DEFAULT_PICKUP);
        setDeliveryLocation("");
        setDeliveryFee(0);
        setDeliveryFeeInput("0");
        setLanguage("en");
        resetMutation();
      }, 350);
    }
  }, [open, defaultStart, defaultEnd, resetMutation]);

  const start = parseDateTimeLocal(startLocal);
  const end = parseDateTimeLocal(endLocal);
  const pricing = useMemo(
    () => computePricing(start, end, selectedCar, deliveryFee),
    [start, end, selectedCar, deliveryFee]
  );

  const canAdvanceFrom1 = !!selectedCustomer;
  const canAdvanceFrom2 =
    !!selectedCar && !!start && !!end && end > start &&
    pickupLocation.trim().length > 0 && !!pricing;

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

  async function handleSubmit() {
    if (!selectedCustomer || !selectedCar || !start || !end || !pricing) return;
    try {
      const res = await createBooking({
        customerId: selectedCustomer.customer_id,
        carId: selectedCar.id,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        pickupLocation: pickupLocation.trim(),
        deliveryLocation: deliveryLocation.trim() || null,
        deliveryFee: pricing.deliveryFee,
        basePrice: pricing.basePrice,
        totalPrice: pricing.totalPrice,
        vatAmount: pricing.vatAmount,
        language,
      });
      toast({
        title: "Booking created",
        description: `${res.bookingNumber} • invoice email sent to ${selectedCustomer.email}`,
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
                Only BankID-verified customers with a signed contract are shown.
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
                <CustomerPickerStep
                  query={searchQuery}
                  setQuery={(q) => { setSearchQuery(q); setPage(0); }}
                  loading={customersLoading}
                  error={customersError}
                  items={customersPage?.items ?? []}
                  total={customersPage?.total ?? 0}
                  hasMore={!!customersPage?.hasMore}
                  page={page}
                  onPageChange={setPage}
                  selected={selectedCustomer}
                  onSelect={(c) => setSelectedCustomer(c)}
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
                  pricing={pricing}
                />
              )}
              {step === 3 && selectedCustomer && selectedCar && start && end && pricing && (
                <ReviewStep
                  customer={selectedCustomer}
                  car={selectedCar}
                  start={start}
                  end={end}
                  pickupLocation={pickupLocation}
                  deliveryLocation={deliveryLocation}
                  pricing={pricing}
                  language={language}
                  setLanguage={setLanguage}
                />
              )}
              {step === 4 && createdBooking && (
                <SuccessStep
                  booking={createdBooking}
                  customerEmail={selectedCustomer?.email ?? ""}
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
                  disabled={step === 1 || creating}
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
                    onClick={goNext}
                    disabled={!canGoNext}
                    className="px-5"
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
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

// ─── Step 1: Customer picker ──────────────────────────────────────────────────

interface CustomerPickerStepProps {
  query: string;
  setQuery: (q: string) => void;
  loading: boolean;
  error: string | null;
  items: EligibleCustomer[];
  total: number;
  hasMore: boolean;
  page: number;
  onPageChange: (p: number) => void;
  selected: EligibleCustomer | null;
  onSelect: (c: EligibleCustomer) => void;
}

const CustomerPickerStep: React.FC<CustomerPickerStepProps> = ({
  query, setQuery, loading, error, items, total, hasMore, page, onPageChange, selected, onSelect,
}) => (
  <div className="space-y-3">
    {/* Search */}
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email, phone or license…"
        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white transition-colors"
        style={{ "--tw-ring-color": GOLD } as React.CSSProperties}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
      )}
    </div>

    {error && (
      <div className="px-3 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
        {error}
      </div>
    )}

    {/* Selected banner */}
    {selected && (
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium"
        style={{ backgroundColor: GOLD_LIGHT, borderColor: GOLD_BORDER, color: "#6b4c14" }}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
        <span className="truncate flex-1">Selected: {selected.full_name}</span>
        <span className="text-xs text-gray-500 shrink-0">Click Next to continue →</span>
      </div>
    )}

    {/* List */}
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          Loading eligible customers…
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No eligible customers found.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          {items.map((c) => {
            const isSel = selected?.customer_id === c.customer_id;
            return (
              <li key={c.customer_id}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors duration-100 hover:bg-gray-50"
                  style={isSel ? { backgroundColor: GOLD_LIGHT } : {}}
                >
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: GOLD_LIGHT }}
                  >
                    <User className="h-4 w-4" style={{ color: GOLD }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {c.full_name}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: "#dcfce7", color: "#166534" }}
                      >
                        <ShieldCheck className="h-2.5 w-2.5" />
                        BankID
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {c.email}{c.phone ? ` • ${c.phone}` : ""}{c.nin_last4 ? ` • NIN ****${c.nin_last4}` : ""}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c.total_bookings} past booking{c.total_bookings !== 1 ? "s" : ""}
                      {c.contract_signed_at ? ` • contract signed ${new Date(c.contract_signed_at).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  {isSel && (
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: GOLD }}
                    >
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>

    {/* Pagination */}
    {(page > 0 || hasMore) && (
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Page {page + 1} • {total} customer{total !== 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => onPageChange(Math.max(0, page - 1))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Prev
          </button>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    )}
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
  pricing: ReturnType<typeof computePricing>;
}

const BookingDetailsStep: React.FC<BookingDetailsStepProps> = ({
  cars, carsLoading, carId, setCarId,
  startLocal, setStartLocal, endLocal, setEndLocal,
  pickupLocation, setPickupLocation,
  deliveryLocation, setDeliveryLocation,
  deliveryFee, setDeliveryFee, deliveryFeeInput, setDeliveryFeeInput,
  pricing,
}) => (
  <div className="space-y-5">
    {/* Vehicle */}
    <div>
      <FieldLabel>Vehicle</FieldLabel>
      <CarPicker cars={cars} loading={carsLoading} value={carId} onChange={setCarId} />
    </div>

    {/* Dates */}
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>Pickup date &amp; time</FieldLabel>
        <StyledInput
          type="datetime-local"
          value={startLocal}
          onChange={(e) => setStartLocal(e.target.value)}
        />
      </div>
      <div>
        <FieldLabel>Return date &amp; time</FieldLabel>
        <StyledInput
          type="datetime-local"
          value={endLocal}
          onChange={(e) => setEndLocal(e.target.value)}
        />
      </div>
    </div>

    {/* Pickup location — static */}
    <div>
      <FieldLabel>Pickup location</FieldLabel>
      <StaticField value={pickupLocation} placeholder="Not set" />
    </div>

    {/* Delivery */}
    <div className="grid grid-cols-[1fr_160px] gap-3">
      <div>
        <FieldLabel>Delivery location</FieldLabel>
        <StaticField value={deliveryLocation || defaultDelivery} placeholder="No delivery — customer picks up" />
      </div>
      <div>
        <FieldLabel>Delivery fee (NOK)</FieldLabel>
        <StyledInput
          type="text"
          inputMode="numeric"
          value={deliveryFeeInput}
          onFocus={(e) => { if (deliveryFeeInput === "0") { setDeliveryFeeInput(""); e.target.select(); } }}
          onBlur={() => { if (!deliveryFeeInput) { setDeliveryFeeInput("0"); setDeliveryFee(0); } }}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            setDeliveryFeeInput(raw);
            setDeliveryFee(raw ? Number(raw) : 0);
          }}
        />
      </div>
    </div>

    {/* Pricing preview */}
    {pricing && (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Pricing preview</div>
        <dl className="text-sm space-y-1.5">
          <PricingRow label="Duration" value={`${pricing.durationHours} h`} />
          <PricingRow label="Base price" value={formatNOK(pricing.basePrice)} />
          {pricing.deliveryFee > 0 && (
            <PricingRow label="Delivery fee" value={formatNOK(pricing.deliveryFee)} />
          )}
          <PricingRow label="VAT (25%)" value={formatNOK(pricing.vatAmount)} />
          <div className="pt-2 mt-1 border-t border-gray-200 flex justify-between">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-gray-900 text-base">{formatNOK(pricing.totalPrice)}</span>
          </div>
        </dl>
      </div>
    )}
  </div>
);

// ─── Step 3: Review ───────────────────────────────────────────────────────────

interface ReviewStepProps {
  customer: EligibleCustomer;
  car: AdminCarOption;
  start: Date;
  end: Date;
  pickupLocation: string;
  deliveryLocation: string;
  pricing: NonNullable<ReturnType<typeof computePricing>>;
  language: "en" | "no";
  setLanguage: (v: "en" | "no") => void;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  customer, car, start, end, pickupLocation, deliveryLocation, pricing, language, setLanguage,
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
            <p className="text-sm font-semibold text-gray-900 truncate">{customer.full_name}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{customer.email}</p>
            {customer.phone && <p className="text-xs text-gray-400">{customer.phone}</p>}
            <span
              className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: "#dcfce7", color: "#166534" }}
            >
              <ShieldCheck className="h-2.5 w-2.5" />BankID
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
          Base {formatNOK(pricing.basePrice)} + VAT {formatNOK(pricing.vatAmount)}
          {pricing.deliveryFee > 0 ? ` + Delivery ${formatNOK(pricing.deliveryFee)}` : ""}
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
        Invoice email → <strong className="text-gray-700">{customer.email}</strong>
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

const SuccessStep: React.FC<{ booking: CreateBookingResponse; customerEmail: string }> = ({
  booking, customerEmail,
}) => {
  const { toast } = useToast();
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
        </div>
      )}
    </div>
  );
};

// ─── Micro helpers ────────────────────────────────────────────────────────────

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{children}</label>
);

const StaticField: React.FC<{ value: string; placeholder?: string }> = ({ value, placeholder }) => (
  <div className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm min-h-[42px] flex items-center">
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
