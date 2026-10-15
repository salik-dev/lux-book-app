import React from "react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileSignature,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";
import type { BookingContractState } from "@/hooks/use-booking-contract";
import type { ContractStatus } from "@/lib/booking-contract-api";

type Tone = "neutral" | "pending" | "success" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "border-[#46555d] bg-[#1b2529] text-[#9eabb1]",
  pending: "border-[#E3C08D]/40 bg-[#E3C08D]/10 text-[#E3C08D]",
  success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  danger: "border-red-400/40 bg-red-400/10 text-red-300",
};

const statusMeta: Record<ContractStatus | "not_created", { label: string; tone: Tone }> = {
  not_created: { label: "Not signed", tone: "neutral" },
  generating: { label: "Preparing", tone: "pending" },
  signature_pending: { label: "Awaiting your signature", tone: "pending" },
  renter_signed: { label: "Signed by you", tone: "success" },
  signed: { label: "Fully signed", tone: "success" },
  rejected: { label: "Declined", tone: "danger" },
  expired: { label: "Expired", tone: "danger" },
  failed: { label: "Not completed", tone: "danger" },
};

const failureMessages: Record<string, string> = {
  RENTER_REJECTED: "You declined to sign the rental agreement. You can prepare a new one if you'd like to continue.",
  BROKER_REJECTED: "The agreement was declined by Prime Norge AS. Please contact us.",
  BROKER_NOT_SIGNED: "The agreement expired before Prime Norge AS countersigned it. Please contact us.",
  ORDER_EXPIRED: "The signing link expired. Prepare a new contract to continue.",
  ORDER_CANCELLED: "The signing request was cancelled. Prepare a new contract to continue.",
};

const formatWhen = (iso: string | null) => (iso ? format(new Date(iso), "PPP 'at' p", { locale: enUS }) : null);

/** Booking errors that are really date/availability problems: the fix is in step 1, not a retry here. */
const EDIT_DATES_CODES = new Set(["CAR_ALREADY_BOOKED", "CAR_UNAVAILABLE", "PICKUP_TOO_SOON", "INVALID_DATES"]);

const StatusPill: React.FC<{ status: ContractStatus | "not_created" }> = ({ status }) => {
  const meta = statusMeta[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-300",
        toneClasses[meta.tone],
      )}
    >
      {meta.tone === "success" ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      ) : meta.tone === "danger" ? (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Clock className="h-3.5 w-3.5" aria-hidden />
      )}
      {meta.label}
    </span>
  );
};

const primaryButton =
  "h-auto w-full gap-2 rounded-md bg-[#E3C08D] px-4 py-2.5 text-sm font-semibold text-[#1b2529] transition-premium hover:cursor-pointer hover:bg-[#E3C08D]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C08D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#232e33] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";
const secondaryButton =
  "h-auto w-full gap-2 rounded-md border border-[#46555d] bg-[#1b2529] px-4 py-2.5 text-sm text-[#b1bdc3] transition-premium hover:cursor-pointer hover:border-[#E3C08D]/60 hover:bg-[#2c3b40] hover:text-[#d0d9dd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C08D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#232e33] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

export const ContractSigningCard: React.FC<{ state: BookingContractState; onEditDates?: () => void }> = ({ state, onEditDates }) => {
  const { booking, bookingError, contract, busy, error, confirming } = state;
  const status: ContractStatus | "not_created" = contract?.status ?? "not_created";
  const restartable = status === "failed" || status === "expired" || status === "rejected";
  const working = busy !== null;

  let body: React.ReactNode;

  if (busy === "booking" && !booking) {
    body = (
      <p className="flex items-center gap-2 text-sm text-[#9eabb1]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Preparing your contract & bookings…
      </p>
    );
  } else if (bookingError && !booking) {
    // A date/availability problem is fixed by choosing other dates in step 1, not by retrying here.
    const editDates = EDIT_DATES_CODES.has(bookingError.code) && onEditDates;
    body = (
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {bookingError.message}
        </p>
        {editDates ? (
          <Button type="button" variant="outline" onClick={onEditDates} className={secondaryButton}>
            <CalendarDays className="h-4 w-4" aria-hidden />
            Choose other dates
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={state.retryBooking} className={secondaryButton}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
        )}
      </div>
    );
  } else if (confirming) {
    body = (
      <p className="flex items-center gap-2 text-sm text-[#9eabb1]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Confirming your signature with BankID…
      </p>
    );
  } else if (busy === "creating" || status === "generating") {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-[#9eabb1]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparing your contract…
        </p>
        {status === "generating" && (
          <Button type="button" variant="outline" onClick={state.refresh} disabled={working} className={secondaryButton}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </Button>
        )}
      </div>
    );
  } else if (status === "renter_signed" || status === "signed") {
    body = (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-md border border-emerald-400/30 bg-emerald-400/5 p-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-[#d0d9dd]">
              {status === "signed"
                ? "Your rental agreement is fully signed and ready to download."
                : "Your rental agreement is ready to download."}
            </p>
            {contract?.renterSignedAt && (
              <p className="text-xs text-[#9eabb1]">Signed by you on {formatWhen(contract.renterSignedAt)}</p>
            )}
          </div>
        </div>
        <Button type="button" variant="outline" onClick={state.openDocument} disabled={working} className={secondaryButton}>
          {busy === "opening" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
          {status === "signed" ? "Download signed contract" : "Download contract"}
        </Button>
      </div>
    );
  } else {
    const failure = restartable
      ? failureMessages[contract?.failureCode ?? ""] ?? "The contract couldn't be completed. Please prepare a new one."
      : null;
    body = (
      <div className="space-y-4">
        {failure ? (
          <p className="flex items-start gap-2 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {failure}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-[#9eabb1]">
            {status === "signature_pending"
              ? "Your rental agreement is ready. Review it and sign securely with BankID — payment becomes available once you have signed."
              : "Review the rental agreement for this booking and sign it securely with BankID. Payment becomes available once you have signed."}
          </p>
        )}
        {/* {status === "signature_pending" && contract?.expiresAt && (
          <p className="text-xs text-[#8a979d]">The signing link is valid until {formatWhen(contract.expiresAt)}.</p>
        )} */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={state.reviewAndSign} disabled={working || !booking} aria-busy={busy === "signing"} className={primaryButton}>
            {busy === "signing" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSignature className="h-4 w-4" aria-hidden />}
            {busy === "signing" ? "Opening secure signing…" : restartable ? "Prepare new contract" : "Review & sign contract"}
          </Button>
          {!restartable && (
            <Button type="button" variant="outline" onClick={state.openDocument} disabled={working || !booking} aria-busy={busy === "opening"} className={secondaryButton}>
              {busy === "opening" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              Preview contract
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-[#334047] bg-[#232e33] text-[#b1bdc3] shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-[#E3C08D]" aria-hidden />
            Rental agreement
          </CardTitle>
          {booking && <StatusPill status={status} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div aria-live="polite">
          <div key={confirming ? "confirming" : status} className="card-fade-in">
            {body}
          </div>
        </div>

        {error && (
          <div role="alert" className="card-fade-in flex items-start justify-between gap-3 rounded-md border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-300">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error.message}
            </span>
            {error.retryable && booking && (
              <button
                type="button"
                onClick={state.refresh}
                className="shrink-0 text-xs font-medium text-[#E3C08D] underline-offset-2 hover:cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C08D]"
              >
                Refresh
              </button>
            )}
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-[#8a979d]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Signed electronically with BankID via Idura, between you and Prime Norge AS.
        </p>
      </CardContent>
    </Card>
  );
};
