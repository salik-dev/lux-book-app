import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  FileSignature,
  FileText,
  Loader2,
  Mail as MailIcon,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ContractStatus } from "@/lib/booking-contract-api";
import type { AdminBookingContractState } from "./use-admin-contract";

const GOLD = "#e3c08d";

/** Booking errors that are really date/availability problems — the admin must change the dates. */
const DATE_PROBLEM_CODES = new Set(["CAR_ALREADY_BOOKED", "CAR_UNAVAILABLE", "PICKUP_TOO_SOON", "INVALID_DATES"]);

const STATUS_LABEL: Record<ContractStatus | "not_created", string> = {
  not_created: "Not prepared",
  generating: "Preparing",
  signature_pending: "Ready to sign",
  renter_signed: "Signed by customer",
  signed: "Signed",
  rejected: "Declined",
  expired: "Expired",
  failed: "Failed",
};

const goldBtn =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none hover:opacity-90";
const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 disabled:pointer-events-none";

export const AdminContractCard: React.FC<{
  state: AdminBookingContractState;
  customerEmail: string;
  onEditDates?: () => void;
}> = ({ state, customerEmail, onEditDates }) => {
  const { toast } = useToast();
  const { booking, bookingError, contract, busy, error, signLink, sentTo } = state;
  const status: ContractStatus | "not_created" = contract?.status ?? "not_created";
  const restartable = status === "failed" || status === "expired" || status === "rejected";
  const working = busy !== null;
  const isSigned = status === "renter_signed" || status === "signed";

  const handleCopy = async () => {
    const url = await state.copySignLink();
    if (url) toast({ title: "Signing link copied", description: "Share it with the customer to sign." });
  };

  const handleEmail = async () => {
    const ok = await state.emailSignLink();
    if (ok) toast({ title: "Signing link sent", description: `Emailed to ${customerEmail}` });
  };

  let body: React.ReactNode;

  if (busy === "booking" && !booking) {
    body = (
      <p className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Preparing the booking…
      </p>
    );
  } else if (bookingError && !booking) {
    const dateProblem = DATE_PROBLEM_CODES.has(bookingError.code) && onEditDates;
    body = (
      <div className="space-y-2.5">
        <p className="flex items-start gap-2 text-xs text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {bookingError.message}
        </p>
        {dateProblem ? (
          <button type="button" onClick={onEditDates} className={ghostBtn}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Change dates
          </button>
        ) : (
          <button type="button" onClick={state.retry} className={ghostBtn}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
        )}
      </div>
    );
  } else if (busy === "creating" || status === "generating") {
    body = (
      <p className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Preparing the rental agreement…
      </p>
    );
  } else if (isSigned) {
    body = (
      <div className="space-y-2.5">
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-xs text-emerald-800">The customer has signed the rental agreement.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={state.openDocument} disabled={working} className={ghostBtn}>
            {busy === "opening" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileText className="h-3.5 w-3.5" aria-hidden />}
            {status === "signed" ? "Download signed contract" : "View contract"}
          </button>
          <button type="button" onClick={state.refresh} disabled={working} className={ghostBtn}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </button>
        </div>
      </div>
    );
  } else if (restartable) {
    body = (
      <div className="space-y-2.5">
        <p className="flex items-start gap-2 text-xs text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          The rental agreement couldn't be completed. Prepare a new one to continue.
        </p>
        <button type="button" onClick={state.retry} disabled={working} className={ghostBtn}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Prepare new contract
        </button>
      </div>
    );
  } else if (status === "signature_pending") {
    // Ready to send to the customer.
    body = (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-gray-500">
          The rental agreement is ready. Send the signing link to the customer — they sign with BankID from their own
          device. You can refresh below once they've signed.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleEmail} disabled={working || !booking} className={goldBtn} style={{ backgroundColor: GOLD, color: "#1a1208" }}>
            {busy === "emailing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <MailIcon className="h-3.5 w-3.5" aria-hidden />}
            Send signing link to customer
          </button>
          <button type="button" onClick={handleCopy} disabled={working || !booking} className={ghostBtn}>
            {busy === "linking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            Copy link
          </button>
          <button type="button" onClick={state.openDocument} disabled={working || !booking} className={ghostBtn}>
            {busy === "opening" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            Preview
          </button>
        </div>
        {sentTo && (
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-700">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Signing link sent to {sentTo}.
          </p>
        )}
        {signLink && (
          <p className="truncate text-[11px] text-gray-400" title={signLink}>
            Link: {signLink}
          </p>
        )}
      </div>
    );
  } else {
    // No contract prepared yet (preparation didn't complete — e.g. a transient error).
    body = (
      <div className="space-y-2.5">
        <p className="text-xs text-gray-500">The rental agreement isn't ready yet. Try preparing it again.</p>
        <button type="button" onClick={state.retry} disabled={working || !booking} className={ghostBtn}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Prepare contract
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <FileSignature className="h-3.5 w-3.5" style={{ color: GOLD }} aria-hidden />
          Rental agreement
        </span>
        {booking && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#f3f4f6", color: "#6b7280" }}>
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>
      <div className="px-3 py-3 space-y-2.5">
        {body}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error.message}
          </div>
        )}
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          Signed electronically with BankID via Idura, between the customer and Prime Norge AS.
        </p>
      </div>
    </div>
  );
};
