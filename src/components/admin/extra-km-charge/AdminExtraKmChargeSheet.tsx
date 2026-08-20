import React, { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock,
  Copy,
  Gauge,
  Loader2,
  Mail as MailIcon,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCreateExtraKmCharge, useSendExtraKmChargeEmail, formatNOK } from "./hooks";

const GOLD = "#e3c08d";

export interface ExtraKmChargeBooking {
  id: string;
  booking_number: string;
  extra_km_driven?: number | null;
  extra_km_price?: number | null;
  extra_km_charge_status?: string | null;
  extra_km_checkout_url?: string | null;
  booking_deposit?: number | null;
  deposit_amount_status?: boolean | null;
  car: {
    name: string;
    extra_km_rate?: number | null;
    included_km_per_day?: number | null;
    deposit_amount?: number | null;
  } | null;
  customer: {
    full_name: string;
    email: string;
  } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: ExtraKmChargeBooking | null;
  onCharged?: () => void;
}

/**
 * "existing" — a charge was already created for this booking (pending or paid); shown
 * first so the admin doesn't accidentally create a duplicate checkout link.
 * "form" — entering/confirming a new charge.
 * "done" — a checkout link was just created.
 */
type View = "existing" | "form" | "done";

const hasExistingCharge = (booking: ExtraKmChargeBooking | null) =>
  Boolean(
    booking &&
      booking.extra_km_charge_status &&
      booking.extra_km_charge_status !== "none" &&
      booking.extra_km_checkout_url
  );

export const AdminExtraKmChargeSheet: React.FC<Props> = ({ open, onOpenChange, booking, onCharged }) => {
  const { toast } = useToast();
  const { loading: creating, createCharge, reset: resetCreate } = useCreateExtraKmCharge();
  const { send: sendEmail, sending } = useSendExtraKmChargeEmail();

  const [view, setView] = useState<View>("form");
  const [extraKmDriven, setExtraKmDriven] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [result, setResult] = useState<{ checkoutUrl: string; chargeAmount: number } | null>(null);

  const depositAmount = Number(booking?.car?.deposit_amount ?? 0);
  const extraKmRate = Number(booking?.car?.extra_km_rate ?? 0);
  const isDepositConfirmed = Boolean(booking?.deposit_amount_status === true || booking?.extra_km_charge_status === "paid");

  // Decide the starting view every time a (possibly different) booking is opened.
  useEffect(() => {
    if (!open || !booking) return;
    setView(hasExistingCharge(booking) ? "existing" : "form");
  }, [open, booking]);

  const suggestedCharge = useMemo(() => {
    const km = Number(extraKmDriven);
    if (!Number.isFinite(km) || km <= 0) return 0;
    return km * extraKmRate;
  }, [extraKmDriven, extraKmRate]);

  // Keep the amount field in sync with the auto-calculation until the admin edits it directly.
  useEffect(() => {
    if (amountTouched) return;
    setChargeAmount(suggestedCharge > 0 ? String(Math.round(suggestedCharge)) : "");
  }, [suggestedCharge, amountTouched]);

  // Reset all local state after the sheet finishes closing.
  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => {
      setView("form");
      setExtraKmDriven("");
      setChargeAmount("");
      setAmountTouched(false);
      setResult(null);
      resetCreate();
    }, 300);
    return () => window.clearTimeout(t);
  }, [open, resetCreate]);

  const parsedKm = Number(extraKmDriven);
  const parsedAmount = Number(chargeAmount);
  const canCreate =
    Boolean(booking) &&
    Number.isFinite(parsedKm) &&
    parsedKm > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0;

  const handleCreate = async () => {
    if (!booking || !canCreate) return;
    try {
      const res = await createCharge({
        bookingId: booking.id,
        extraKmDriven: parsedKm,
        chargeAmount: parsedAmount,
      });
      setResult({ checkoutUrl: res.checkoutUrl, chargeAmount: res.chargeAmount });
      setView("done");
      onCharged?.();
    } catch (err) {
      toast({
        title: "Could not create charge",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied" });
  };

  const handleSendEmail = async (checkoutUrl: string) => {
    if (!booking) return;
    try {
      await sendEmail(booking.id, checkoutUrl);
      toast({ title: "Email sent", description: `Sent to ${booking.customer?.email ?? "customer"}` });
    } catch (err) {
      toast({
        title: "Could not send email",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const startNewCharge = () => {
    setExtraKmDriven("");
    setChargeAmount("");
    setAmountTouched(false);
    setResult(null);
    setView("form");
  };

  return (
    <TooltipProvider>
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-booking-overlay
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        />
        <DialogPrimitive.Content
          data-booking-sheet
          className="fixed right-0 top-0 z-50 flex flex-col bg-white w-full max-w-[520px]"
          style={{ height: "100dvh", boxShadow: "-2px 0 40px rgba(0,0,0,0.18)" }}
        >
          <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
            <div>
              <DialogPrimitive.Title className="text-[17px] font-bold text-gray-900 leading-tight">
                Extra kilometer charge
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-gray-400">
                {booking ? `Booking ${booking.booking_number}` : ""}
              </DialogPrimitive.Description>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {view === "existing" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={startNewCharge}
                      disabled={isDepositConfirmed}
                      className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-transparent"
                      aria-label="Create new charge"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isDepositConfirmed
                      ? "Deposit deduction already confirmed — no new charge needed"
                      : "Create a new checkout link (e.g. if the previous one expired)"}
                  </TooltipContent>
                </Tooltip>
              )}
              <DialogPrimitive.Close asChild>
                <button
                  className="mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-4">
            <div key={view} className="step-enter-forward">
              {view === "existing" && booking && (
                <ExistingChargeView
                  booking={booking}
                  onCopy={handleCopy}
                  onSend={handleSendEmail}
                  sending={sending}
                />
              )}

              {view === "form" && booking && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                    <p className="font-semibold text-gray-800">{booking.car?.name ?? "Vehicle"}</p>
                    <p className="text-gray-500 mt-0.5">{booking.customer?.full_name} &middot; {booking.customer?.email}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                      <div>Included km/day: <span className="font-medium text-gray-700">{booking.car?.included_km_per_day ?? 0}</span></div>
                      <div>Rate per extra km: <span className="font-medium text-gray-700">{formatNOK(extraKmRate)}</span></div>
                      <div className="col-span-2">Original deposit: <span className="font-medium text-gray-700">{formatNOK(depositAmount)}</span></div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Extra kilometers driven</label>
                    <input
                      type="number"
                      min={0}
                      value={extraKmDriven}
                      onChange={(e) => setExtraKmDriven(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e3c08d]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Charge amount (auto-calculated, editable)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={chargeAmount}
                      onChange={(e) => {
                        setAmountTouched(true);
                        setChargeAmount(e.target.value);
                      }}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e3c08d]/50"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      This amount will be deducted from the customer's deposit.
                    </p>
                  </div>
                </div>
              )}

              {view === "done" && result && (
                <div className="flex flex-col items-center gap-5 py-6">
                  <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#dcfce7" }}>
                    <CheckCircle2 className="h-8 w-8" style={{ color: "#16a34a" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">Charge created</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatNOK(result.chargeAmount)} deducted from the deposit &mdash; awaiting payment
                    </p>
                  </div>

                  <CheckoutLinkCard checkoutUrl={result.checkoutUrl} onCopy={handleCopy} />

                  <button
                    type="button"
                    onClick={() => handleSendEmail(result.checkoutUrl)}
                    disabled={sending}
                    className={cn(
                      "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 w-full justify-center",
                      sending ? "opacity-60 pointer-events-none" : "hover:opacity-90 active:scale-[0.98]"
                    )}
                    style={{ backgroundColor: GOLD, color: "#1a1208" }}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailIcon className="h-4 w-4" />}
                    Send to {booking?.customer?.email ?? "customer"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-white"
            style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.05)" }}
          >
            {view === "form" && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate || creating}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150",
                  !canCreate || creating ? "opacity-50 pointer-events-none" : "hover:opacity-90 active:scale-[0.98]"
                )}
                style={{ backgroundColor: GOLD, color: "#1a1208" }}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating checkout link...
                  </>
                ) : (
                  <>
                    <Gauge className="h-3.5 w-3.5" />
                    Create Stripe checkout link
                  </>
                )}
              </button>
            )}
            {(view === "done" || view === "existing") && (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-2 px-8 py-2 rounded-lg text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: GOLD, color: "#1a1208" }}
              >
                Done
              </button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
    </TooltipProvider>
  );
};

const CheckoutLinkCard: React.FC<{ checkoutUrl: string; onCopy: (url: string) => void }> = ({ checkoutUrl, onCopy }) => (
  <div className="w-full rounded-xl border border-gray-200 p-4 bg-gray-50">
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Stripe checkout link</div>
    <div className="flex items-start gap-2">
      <code className="text-xs break-all bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 leading-relaxed text-gray-700">
        {checkoutUrl}
      </code>
      <button
        type="button"
        onClick={() => onCopy(checkoutUrl)}
        className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors shrink-0"
        aria-label="Copy link"
      >
        <Copy className="h-4 w-4 text-gray-500" />
      </button>
    </div>
    <p className="text-xs text-gray-400 mt-2">Expires in 24 hours from creation.</p>
  </div>
);

const ExistingChargeView: React.FC<{
  booking: ExtraKmChargeBooking;
  onCopy: (url: string) => void;
  onSend: (url: string) => void;
  sending: boolean;
}> = ({ booking, onCopy, onSend, sending }) => {
  const isPaid = booking.extra_km_charge_status === "paid" || booking.deposit_amount_status === true;
  const amount = Number(booking.booking_deposit ?? booking.extra_km_price ?? 0);
  const checkoutUrl = booking.extra_km_checkout_url ?? "";

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border p-4",
          isPaid ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
        )}
      >
        {isPaid ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
        ) : (
          <Clock className="h-6 w-6 text-amber-600 shrink-0" />
        )}
        <div>
          <p className={cn("text-sm font-semibold", isPaid ? "text-emerald-800" : "text-amber-800")}>
            {isPaid ? "Deposit deduction confirmed" : "A charge is already awaiting payment"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatNOK(amount)} &middot; {booking.extra_km_driven ?? 0} km over limit &middot; status:{" "}
            {isPaid ? "Confirmed" : "Pending"}
          </p>
        </div>
      </div>

      {checkoutUrl && !isPaid && (
        <>
          <CheckoutLinkCard checkoutUrl={checkoutUrl} onCopy={onCopy} />
          <button
            type="button"
            onClick={() => onSend(checkoutUrl)}
            disabled={sending}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 w-full justify-center",
              sending ? "opacity-60 pointer-events-none" : "hover:opacity-90 active:scale-[0.98]"
            )}
            style={{ backgroundColor: GOLD, color: "#1a1208" }}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailIcon className="h-4 w-4" />}
            Resend to {booking.customer?.email ?? "customer"}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Link expired? Use the refresh icon in the top-right corner to create a new one.
          </p>
        </>
      )}
    </div>
  );
};
