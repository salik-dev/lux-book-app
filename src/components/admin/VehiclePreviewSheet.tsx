import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  BatteryCharging,
  CalendarCheck,
  Car as CarIcon,
  CheckCircle2,
  CircleDot,
  CircleSlash,
  Fuel,
  Gauge,
  Info,
  Loader2,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Users,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RegistrationPlate } from '@/components/admin/RegistrationPlate';
import { toApiError } from '@/lib/edge-function';
import { previewVehicle, type VehicleDetails } from '@/lib/vehicle-lookup-api';
import { getCarPlaceholder } from '@/utils/carPlaceholder';

export interface PreviewCar {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  image_url?: string | null;
  registration_number?: string | null;
}

interface VehiclePreviewSheetProps {
  car: PreviewCar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; details: VehicleDetails; fetchedAt: number }
  | { status: 'error'; message: string; retryable: boolean };

// Register data rarely changes; reuse a lookup for a while instead of calling Vegvesen on every open.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { details: VehicleDetails; fetchedAt: number }>();

// ---- Formatting ---------------------------------------------------------------------------

const numberFormat = new Intl.NumberFormat('nb-NO');
const fmtNumber = (n: number | null, unit: string) => (n === null ? null : `${numberFormat.format(n)} ${unit}`);

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const DAY_MS = 24 * 60 * 60 * 1000;
const daysUntil = (iso: string) => {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
};

// ---- Component ----------------------------------------------------------------------------

export const VehiclePreviewSheet: React.FC<VehiclePreviewSheetProps> = ({ car, open, onOpenChange }) => {
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  // Ignores responses for a car that is no longer shown (closed, or another row opened).
  const requestSeq = useRef(0);
  const plate = car?.registration_number ?? null;

  const load = useCallback(async (registrationNumber: string, force = false) => {
    const cached = cache.get(registrationNumber);
    if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setState({ status: 'ready', ...cached });
      return;
    }

    const seq = ++requestSeq.current;
    setState({ status: 'loading' });
    try {
      const details = await previewVehicle(registrationNumber);
      if (seq !== requestSeq.current) return;
      const entry = { details, fetchedAt: Date.now() };
      cache.set(registrationNumber, entry);
      setState({ status: 'ready', ...entry });
    } catch (error) {
      if (seq !== requestSeq.current) return;
      const apiError = toApiError(error);
      setState({ status: 'error', message: apiError.message, retryable: apiError.retryable });
    }
  }, []);

  useEffect(() => {
    if (open && plate) void load(plate);
    if (!open) requestSeq.current += 1;
  }, [open, plate, load]);

  const refreshing = state.status === 'loading';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-booking-overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          data-booking-sheet
          className="fixed right-0 top-0 z-50 flex w-full max-w-[560px] flex-col bg-white focus:outline-none"
          style={{ height: '100dvh', boxShadow: '-2px 0 40px rgba(0,0,0,0.18)' }}
        >
          {car && (
            <>
              <SheetHeader car={car} details={state.status === 'ready' ? state.details : null} />

              <div className="sheet-scroll flex-1 min-h-0 overflow-y-auto px-6 py-5">
                {!plate ? (
                  <EmptyState />
                ) : state.status === 'loading' ? (
                  <LoadingState />
                ) : state.status === 'error' ? (
                  <ErrorState
                    message={state.message}
                    retryable={state.retryable}
                    onRetry={() => void load(plate, true)}
                  />
                ) : (
                  <DetailsView details={state.details} />
                )}
              </div>

              <div className="shrink-0 flex items-center justify-between gap-3 border-t border-gray-100 bg-white px-6 py-3">
                <p className="text-[11px] text-gray-400">
                  {state.status === 'ready' && plate
                    ? `Source: Statens vegvesen · updated ${fmtTime(state.fetchedAt)}`
                    : 'Source: Statens vegvesen'}
                </p>
                <div className="flex gap-2">
                  {plate && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void load(plate, true)}
                      disabled={refreshing}
                      className="rounded-lg border border-gray-300 bg-white text-gray-700 shadow-none transition-colors duration-300 hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  )}
                  <DialogPrimitive.Close asChild>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-lg bg-[#e3c08d] text-black shadow-sm transition-colors duration-300 hover:cursor-pointer hover:bg-[#e3c08d]/80"
                    >
                      Close
                    </Button>
                  </DialogPrimitive.Close>
                </div>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

// ---- Header -------------------------------------------------------------------------------

const SheetHeader: React.FC<{ car: PreviewCar; details: VehicleDetails | null }> = ({ car, details }) => (
  <div className="shrink-0 border-b border-gray-100">
    <div className="relative h-40 overflow-hidden bg-gray-100">
      <img
        src={car.image_url || getCarPlaceholder(car.brand, car.model, car.name)}
        alt={car.name}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <DialogPrimitive.Close asChild>
        <button
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:cursor-pointer hover:bg-black/60"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogPrimitive.Close>
      <div className="absolute inset-x-6 bottom-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <DialogPrimitive.Title className="truncate text-lg font-bold leading-tight text-white">
            {car.name}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 truncate text-xs text-white/80">
            {details?.brand && details.model ? `${details.brand} ${details.model}` : `${car.brand} ${car.model}`} ·{' '}
            {car.year}
          </DialogPrimitive.Description>
        </div>
        {car.registration_number && (
          <RegistrationPlate value={car.registration_number} size="md" className="shrink-0" />
        )}
      </div>
    </div>

    {details && (
      <div className="lux-fade-in flex flex-wrap items-center gap-1.5 px-6 py-3">
        <StatusPill tone={details.registration.isRegistered ? 'green' : 'red'}>
          {details.registration.isRegistered ? <CheckCircle2 className="h-3 w-3" /> : <CircleSlash className="h-3 w-3" />}
          {details.registration.status ?? 'Unknown status'}
        </StatusPill>
        {details.registration.isTaxi && (
          <StatusPill tone="amber">
            <AlertTriangle className="h-3 w-3" />
            Registered as taxi
          </StatusPill>
        )}
        {details.classification.description && <StatusPill tone="gray">{details.classification.description}</StatusPill>}
        {details.powertrain.fuel && (
          <StatusPill tone="gray">
            {details.powertrain.electricOnly ? <Zap className="h-3 w-3" /> : <Fuel className="h-3 w-3" />}
            {details.powertrain.fuel}
          </StatusPill>
        )}
      </div>
    )}
  </div>
);

const PILL_TONES = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
} as const;

const StatusPill: React.FC<{ tone: keyof typeof PILL_TONES; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${PILL_TONES[tone]}`}>
    {children}
  </span>
);

// ---- States -------------------------------------------------------------------------------

const EmptyState: React.FC = () => (
  <div className="card-fade-in flex flex-col items-center px-6 py-12 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
      <Info className="h-5 w-5 text-gray-400" />
    </div>
    <p className="text-sm font-semibold text-gray-900">No registration number saved</p>
    <p className="mt-1 max-w-xs text-xs text-gray-500">
      This vehicle was added before register verification. Edit it and verify its registration number to see the
      Statens vegvesen details here.
    </p>
  </div>
);

const LoadingState: React.FC = () => (
  <div className="space-y-5" aria-busy="true" aria-label="Loading vehicle details">
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#e3c08d]" />
      Fetching details from Statens vegvesen…
    </div>
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[72px] animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
    <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
    {[0, 1, 2].map((i) => (
      <div key={i} className="space-y-2.5">
        <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
        {[0, 1, 2].map((j) => (
          <div key={j} className="flex justify-between gap-6">
            <div className="h-2.5 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    ))}
  </div>
);

const ErrorState: React.FC<{ message: string; retryable: boolean; onRetry: () => void }> = ({
  message,
  retryable,
  onRetry,
}) => (
  <div role="alert" className="card-fade-in flex flex-col items-center px-6 py-12 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
      {retryable ? <WifiOff className="h-5 w-5 text-red-500" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
    </div>
    <p className="text-sm font-semibold text-gray-900">Couldn't load register details</p>
    <p className="mt-1 max-w-xs text-xs text-gray-500">{message}</p>
    <Button
      type="button"
      size="sm"
      onClick={onRetry}
      className="mt-4 rounded-lg bg-[#e3c08d] text-black shadow-sm transition-colors duration-300 hover:cursor-pointer hover:bg-[#e3c08d]/80"
    >
      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
      Try again
    </Button>
  </div>
);

// ---- Details ------------------------------------------------------------------------------

const DetailsView: React.FC<{ details: VehicleDetails }> = ({ details: d }) => {
  const { powertrain: p } = d;
  const horsepower = p.powerKw !== null ? Math.round(p.powerKw * 1.341) : null;

  const highlights = [
    {
      icon: <Zap className="h-4 w-4" />,
      label: 'Power',
      value: p.powerKw !== null ? `${numberFormat.format(p.powerKw)} kW` : null,
      sub: horsepower !== null ? `${horsepower} hp` : null,
    },
    p.rangeKm !== null
      ? { icon: <BatteryCharging className="h-4 w-4" />, label: 'Range (WLTP)', value: `${p.rangeKm} km`, sub: null }
      : {
          icon: <Fuel className="h-4 w-4" />,
          label: 'Consumption',
          value: p.fuelConsumptionLPer100Km !== null ? `${p.fuelConsumptionLPer100Km} l` : null,
          sub: p.fuelConsumptionLPer100Km !== null ? 'per 100 km' : null,
        },
    {
      icon: <Users className="h-4 w-4" />,
      label: 'Seats',
      value: d.capacity.seats !== null ? String(d.capacity.seats) : null,
      sub: d.capacity.doors !== null ? `${d.capacity.doors} doors` : null,
    },
    {
      icon: <Gauge className="h-4 w-4" />,
      label: 'Top speed',
      value: p.maxSpeedKmh !== null ? `${p.maxSpeedKmh} km/h` : null,
      sub: null,
    },
  ].filter((h) => h.value !== null);

  const sections: { title: string; icon: React.ReactNode; rows: [string, string | null][] }[] = [
    {
      title: 'Registration',
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      rows: [
        ['Status', d.registration.status],
        ['Usage', d.registration.usage],
        ['First registered', fmtDate(d.registration.firstRegisteredAt)],
        ['First registered in Norway', fmtDate(d.registration.firstRegisteredInNorwayAt)],
        ['Current owner since', fmtDate(d.registration.currentOwnerSince)],
        ['VIN', d.vin],
      ],
    },
    {
      title: 'Vehicle',
      icon: <CarIcon className="h-3.5 w-3.5" />,
      rows: [
        ['Brand', d.brand],
        ['Model', d.model],
        ['Type designation', d.typeDesignation],
        ['Vehicle class', d.classification.vehicleClass],
        ['Body type', d.classification.bodyType],
        ['Color', d.classification.color],
      ],
    },
    {
      title: 'Powertrain & environment',
      icon: <Zap className="h-3.5 w-3.5" />,
      rows: [
        ['Fuel', p.fuel],
        ['Transmission', p.transmission],
        ['Hybrid', p.electricOnly ? null : p.hybrid],
        ['Energy consumption', fmtNumber(p.energyConsumptionWhPerKm, 'Wh/km')],
        ['Fuel consumption', fmtNumber(p.fuelConsumptionLPer100Km, 'l/100 km')],
        ['CO₂ emissions', fmtNumber(p.co2GPerKm, 'g/km')],
        ['Emission class', p.euroClass],
      ],
    },
    {
      title: 'Dimensions & weights',
      icon: <Ruler className="h-3.5 w-3.5" />,
      rows: [
        ['Length', fmtNumber(d.dimensions.lengthMm, 'mm')],
        ['Width', fmtNumber(d.dimensions.widthMm, 'mm')],
        ['Height', fmtNumber(d.dimensions.heightMm, 'mm')],
        ['Kerb weight', fmtNumber(d.weights.kerbKg, 'kg')],
        ['Max total weight', fmtNumber(d.weights.maxTotalKg, 'kg')],
        ['Payload', fmtNumber(d.weights.payloadKg, 'kg')],
        ['Trailer (braked)', fmtNumber(d.weights.trailerBrakedKg, 'kg')],
        ['Trailer (unbraked)', fmtNumber(d.weights.trailerUnbrakedKg, 'kg')],
      ],
    },
    {
      title: 'Wheels & tyres',
      icon: <CircleDot className="h-3.5 w-3.5" />,
      rows: d.tyres.map((t): [string, string | null] => [
        t.axle === 1 ? 'Front axle' : t.axle === 2 ? 'Rear axle' : `Axle ${t.axle}`,
        [t.tyre, t.rim].filter(Boolean).join(' · ') || null,
      ]),
    },
  ];

  let delay = 0;
  const nextDelay = () => ({ animationDelay: `${(delay += 50)}ms` });

  return (
    <div className="space-y-5">
      {highlights.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {highlights.map((h) => (
            <div
              key={h.label}
              style={nextDelay()}
              className="card-fade-in rounded-xl border border-gray-100 bg-gradient-to-b from-[#fbf6ee] to-white p-3"
            >
              <div className="flex items-center gap-1.5 text-[#b8935a]">
                {h.icon}
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{h.label}</span>
              </div>
              <p className="mt-1.5 text-base font-bold leading-none text-gray-900">{h.value}</p>
              {h.sub && <p className="mt-1 text-[11px] text-gray-500">{h.sub}</p>}
            </div>
          ))}
        </div>
      )}

      <InspectionCard lastApprovedAt={d.inspection.lastApprovedAt} nextDueAt={d.inspection.nextDueAt} style={nextDelay()} />

      {sections.map((section) => {
        const rows = section.rows.filter((r): r is [string, string] => Boolean(r[1]));
        if (rows.length === 0) return null;
        return (
          <section key={section.title} style={nextDelay()} className="card-fade-in">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
              <span className="text-[#b8935a]">{section.icon}</span>
              {section.title}
            </h3>
            <dl className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 px-3.5 py-2.5 transition-colors hover:bg-gray-50/70">
                  <dt className="shrink-0 text-xs text-gray-500">{label}</dt>
                  <dd
                    className={`min-w-0 break-words text-right text-xs font-medium text-gray-900 ${label === 'VIN' ? 'font-mono tracking-wide' : ''}`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
};

const InspectionCard: React.FC<{
  lastApprovedAt: string | null;
  nextDueAt: string | null;
  style: React.CSSProperties;
}> = ({ lastApprovedAt, nextDueAt, style }) => {
  if (!lastApprovedAt && !nextDueAt) return null;

  const days = nextDueAt ? daysUntil(nextDueAt) : null;
  const tone =
    days === null ? 'gray' : days < 0 ? 'red' : days <= 60 ? 'amber' : 'green';
  const toneClass = {
    green: 'border-emerald-200 bg-emerald-50/60',
    amber: 'border-amber-200 bg-amber-50/70',
    red: 'border-red-200 bg-red-50/70',
    gray: 'border-gray-200 bg-gray-50',
  }[tone];
  const iconClass = { green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', gray: 'text-gray-500' }[tone];
  const summary =
    days === null
      ? null
      : days < 0
        ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
        : days === 0
          ? 'Due today'
          : `Due in ${days} day${days === 1 ? '' : 's'}`;

  return (
    <div style={style} className={`card-fade-in flex items-start gap-3 rounded-xl border p-3.5 ${toneClass}`}>
      <CalendarCheck className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-semibold text-gray-900">EU inspection (EU-kontroll)</p>
          {summary && <p className={`text-xs font-semibold ${iconClass}`}>{summary}</p>}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-gray-600">
          {nextDueAt && (
            <span>
              Next deadline <span className="font-medium text-gray-900">{fmtDate(nextDueAt)}</span>
            </span>
          )}
          {lastApprovedAt && (
            <span>
              Last approved <span className="font-medium text-gray-900">{fmtDate(lastApprovedAt)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
