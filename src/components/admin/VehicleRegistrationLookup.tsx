import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toApiError } from '@/lib/edge-function';
import {
  formatPlate,
  isRegistrationNumber,
  lookupVehicle,
  normalizeRegistrationNumber,
  type VehicleLookupResult,
} from '@/lib/vehicle-lookup-api';

type LookupState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'verified'; result: VehicleLookupResult }
  | { status: 'error'; message: string; retryable: boolean; duplicate: boolean };

interface VehicleRegistrationLookupProps {
  /** The car being edited; lets it keep its own plate during the duplicate check. */
  carId?: string;
  /** Saved plate of the car being edited; filled in and verified automatically. */
  initialRegistrationNumber?: string | null;
  /** Called with the register data once a plate is verified. */
  onVerified: (result: VehicleLookupResult) => void;
  /** Called when a previous verification no longer applies (plate edited). */
  onInvalidated: () => void;
}

/**
 * Registration-number search against the Statens vegvesen register. The rest of the
 * Add/Edit Vehicle form stays locked until a lookup succeeds.
 */
export const VehicleRegistrationLookup: React.FC<VehicleRegistrationLookupProps> = ({
  carId,
  initialRegistrationNumber,
  onVerified,
  onInvalidated,
}) => {
  const [plate, setPlate] = useState(initialRegistrationNumber ? formatPlate(initialRegistrationNumber) : '');
  const [state, setState] = useState<LookupState>({ status: 'idle' });
  // Bumped on every search/edit so a slow response for an old plate is ignored.
  const requestSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards the edit-mode auto lookup against StrictMode's double effect run.
  const autoSearched = useRef(false);

  const searching = state.status === 'searching';

  const search = async (value = plate) => {
    const registrationNumber = normalizeRegistrationNumber(value);
    if (!isRegistrationNumber(registrationNumber)) {
      setState({
        status: 'error',
        message: 'Enter a valid registration number, e.g. EN 10257.',
        retryable: false,
        duplicate: false,
      });
      inputRef.current?.focus();
      return;
    }

    const seq = ++requestSeq.current;
    setState({ status: 'searching' });
    try {
      const result = await lookupVehicle(registrationNumber, carId);
      if (seq !== requestSeq.current) return;
      setPlate(formatPlate(result.vehicle.registrationNumber));
      setState({ status: 'verified', result });
      onVerified(result);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      const apiError = toApiError(error);
      setState({
        status: 'error',
        message: apiError.message,
        retryable: apiError.retryable,
        duplicate: apiError.code === 'VEHICLE_ALREADY_IN_FLEET',
      });
    }
  };

  useEffect(() => {
    if (initialRegistrationNumber && !autoSearched.current) {
      autoSearched.current = true;
      void search(initialRegistrationNumber);
    }
    // Runs once per mount; the dialog remounts this component (via `key`) for each open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlate(e.target.value.toUpperCase());
    requestSeq.current += 1;
    if (state.status === 'verified') onInvalidated();
    if (state.status !== 'idle') setState({ status: 'idle' });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // The input lives inside the vehicle <form>; Enter should search, not submit.
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searching) void search();
    }
  };

  const borderClass =
    state.status === 'verified'
      ? 'border-emerald-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-200'
      : state.status === 'error'
        ? 'border-red-300 focus-visible:border-red-400 focus-visible:ring-red-100'
        : 'border-gray-300 focus-visible:border-[#e3c08d] focus-visible:ring-[#e3c08d]/50';

  return (
    <div className="space-y-2 pb-4 border-b border-gray-100">
      <Label htmlFor="registration-number" className="text-xs font-bold uppercase tracking-wide text-gray-500">
        Vehicle Registration <span className="text-red-500">*</span>
      </Label>
      <p className="text-[11px] text-gray-500">
        Look the vehicle up in the Statens vegvesen register to unlock and auto-fill the form.
      </p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            ref={inputRef}
            id="registration-number"
            value={plate}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search by registration no."
            autoComplete="off"
            spellCheck={false}
            maxLength={10}
            aria-invalid={state.status === 'error'}
            aria-describedby="registration-number-status"
            className={`bg-white rounded-lg h-8 pl-8 pr-8 text-xs font-semibold tracking-wider uppercase placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-gray-400 transition-colors duration-200 focus-visible:ring-2 ${borderClass}`}
          />
          {state.status === 'verified' && (
            <CheckCircle2 className="success-pop absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
          )}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void search()}
          disabled={searching || !plate.trim()}
          className="h-8 min-w-[92px] rounded-lg bg-[#e3c08d] text-black shadow-sm transition-colors duration-300 hover:cursor-pointer hover:bg-[#e3c08d]/80"
        >
          {searching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Searching
            </>
          ) : state.status === 'error' && state.retryable ? (
            <>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </>
          ) : (
            'Search'
          )}
        </Button>
      </div>

      <div id="registration-number-status" aria-live="polite">
        {searching && (
          <div className="lux-fade-in space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        )}

        {state.status === 'error' && state.duplicate && (
          <div
            role="alert"
            className="card-fade-in flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
          >
            <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-600" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-amber-900">Already in your fleet</p>
              <p className="text-xs text-amber-800">{state.message}</p>
              <p className="text-[11px] text-amber-700">
                Search a different registration number, or edit the existing vehicle instead.
              </p>
            </div>
          </div>
        )}

        {state.status === 'error' && !state.duplicate && (
          <div
            role="alert"
            className="shake-x flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>{state.message}</span>
          </div>
        )}

        {state.status === 'verified' && <VerifiedVehicleCard result={state.result} />}
      </div>
    </div>
  );
};

const VerifiedVehicleCard: React.FC<{ result: VehicleLookupResult }> = ({ result }) => {
  const { vehicle, warnings } = result;
  const details = [
    vehicle.year && { label: 'First registered', value: String(vehicle.year) },
    vehicle.fuel && { label: 'Fuel', value: vehicle.fuel },
    vehicle.transmission && { label: 'Transmission', value: vehicle.transmission },
    vehicle.seats && { label: 'Seats', value: String(vehicle.seats) },
    vehicle.color && { label: 'Color', value: vehicle.color },
    vehicle.nextInspectionDue && { label: 'Next EU inspection', value: vehicle.nextInspectionDue },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="card-fade-in space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Verified vehicle
          </p>
          <p className="mt-0.5 truncate text-sm font-bold text-gray-900">{vehicle.name}</p>
          {vehicle.vin && <p className="font-mono text-[11px] text-gray-500">VIN {vehicle.vin}</p>}
        </div>
        <span className="shrink-0 rounded-md border border-gray-800 bg-white px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-gray-900">
          {formatPlate(vehicle.registrationNumber)}
        </span>
      </div>

      {details.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          {details.map((d) => (
            <div key={d.label} className="min-w-0">
              <dt className="text-[10px] text-gray-500">{d.label}</dt>
              <dd className="truncate text-xs font-medium text-gray-800">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {warnings.map((warning) => (
        <p
          key={warning}
          className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800"
        >
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          {warning}
        </p>
      ))}
    </div>
  );
};
