/**
 * Statens vegvesen vehicle register lookup ("enkeltoppslag/kjoretoydata").
 *
 * Looks a vehicle up by registration number and reduces the (very large) response to
 * the handful of fields the admin fleet form needs. Provider failures are mapped to
 * HttpErrors with user-safe messages; raw provider bodies are never returned.
 */

import { HttpError, type Logger } from "../http.ts";

/** Used when the VITE_VEGVESEN_VEHICLE_VERIFICATION_URL secret isn't set. */
export const DEFAULT_API_URL = "https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata";
const TIMEOUT_MS = 10_000;

export interface VegvesenConfig {
  apiKey: string;
  apiUrl?: string;
}

const env = (name: string) => Deno.env.get(name)?.trim() || undefined;

/**
 * Reads the Supabase secrets:
 *   VITE_VEGVESEN_VEHICLE_VERIFICATION_KEY  API key, sent as `SVV-Authorization` (required;
 *                                           the older SVV_VEGVESEN_KEY name still works)
 *   VITE_VEGVESEN_VEHICLE_VERIFICATION_URL  endpoint (optional, defaults to DEFAULT_API_URL)
 */
export function vegvesenConfigFromEnv(): VegvesenConfig {
  const apiKey = env("VITE_VEGVESEN_VEHICLE_VERIFICATION_KEY") ?? env("SVV_VEGVESEN_KEY");
  if (!apiKey) throw new HttpError(500, "SERVER_MISCONFIGURED", "The service is temporarily unavailable.");
  return { apiKey, apiUrl: env("VITE_VEGVESEN_VEHICLE_VERIFICATION_URL") };
}

export interface VehicleInfo {
  registrationNumber: string;
  vin: string | null;
  brand: string;
  model: string;
  name: string;
  year: number | null;
  firstRegisteredAt: string | null;
  vehicleClass: string | null;
  fuel: string | null;
  transmission: string | null;
  seats: number | null;
  color: string | null;
  nextInspectionDue: string | null;
}

export interface VehicleLookupResult {
  vehicle: VehicleInfo;
  /** Non-blocking notes for the admin (e.g. the car is registered as a taxi). */
  warnings: string[];
}

/** Uppercases and strips spaces/dashes: "en 10-257" -> "EN10257". */
export function normalizeRegistrationNumber(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[\s-]+/g, "");
}

/** Norwegian plates: 2 letters + 4-5 digits, or personalised plates of 2-7 characters. */
export const isRegistrationNumber = (value: string): boolean => /^[A-ZÆØÅ0-9]{2,7}$/.test(value);

/** "MERCEDES-BENZ" -> "Mercedes-Benz", but short acronyms like "BMW"/"NIO" stay as-is. */
export function formatBrand(raw: string): string {
  const brand = raw.trim();
  if (brand !== brand.toUpperCase()) return brand;
  return brand.replace(/[A-ZÆØÅ]+/g, (word) =>
    word.length > 3 ? word[0] + word.slice(1).toLowerCase() : word
  );
}

/** "EN10257" -> "EN 10257" for messages (standard plates only). */
export const formatPlate = (plate: string): string => plate.replace(/^([A-ZÆØÅ]{2})(\d{4,5})$/, "$1 $2");

// deno-lint-ignore no-explicit-any
type Json = any;

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Numbers the register sometimes sends as strings, e.g. "360.0". */
const numeric = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : value;
  return num(n);
};

/** English labels for the register's most common Norwegian code names; anything else passes through. */
const TRANSLATIONS: Record<string, string> = {
  // Fuel
  Elektrisk: "Electric",
  Bensin: "Petrol",
  Diesel: "Diesel",
  Hydrogen: "Hydrogen",
  Gass: "Gas",
  // Transmission
  Automat: "Automatic",
  Manuell: "Manual",
  // Colour
  Svart: "Black",
  Hvit: "White",
  Grå: "Grey",
  Sølv: "Silver",
  Blå: "Blue",
  Rød: "Red",
  Grønn: "Green",
  Brun: "Brown",
  Beige: "Beige",
  Gul: "Yellow",
  Oransje: "Orange",
  Lilla: "Purple",
  // Hybrid category
  Ingen: "None",
};
const translate = (value: string | null): string | null => (value ? TRANSLATIONS[value] ?? value : null);

const REGISTRATION_STATUS: Record<string, string> = {
  REGISTRERT: "Registered",
  AVREGISTRERT: "Deregistered",
  VRAKET: "Scrapped",
};

/**
 * Maps one `kjoretoydataListe` entry to VehicleInfo, enforcing that it is a currently
 * registered vehicle with a known brand and model.
 */
export function parseVehicle(entry: Json): VehicleLookupResult {
  const td = entry?.godkjenning?.tekniskGodkjenning?.tekniskeData ?? {};
  const registration = entry?.registrering ?? {};

  const status = registration?.registreringsstatus;
  if (status?.kodeVerdi !== "REGISTRERT") {
    const label = str(status?.kodeNavn) ?? str(status?.kodeVerdi) ?? "unknown";
    throw new HttpError(
      422,
      "VEHICLE_NOT_REGISTERED",
      `This vehicle is not currently registered (status: ${label}) and can't be added to the fleet.`,
    );
  }

  const rawBrand = str(td?.generelt?.merke?.[0]?.merke);
  const model = str(td?.generelt?.handelsbetegnelse?.[0]);
  if (!rawBrand || !model) {
    throw new HttpError(
      422,
      "VEHICLE_DATA_INCOMPLETE",
      "The vehicle register has no brand or model for this vehicle. Please check the registration number.",
    );
  }
  const brand = formatBrand(rawBrand);

  const firstRegisteredAt = str(entry?.godkjenning?.forstegangsGodkjenning?.forstegangRegistrertDato)
    ?? str(entry?.forstegangsregistrering?.registrertForstegangNorgeDato);
  const year = firstRegisteredAt ? Number(firstRegisteredAt.slice(0, 4)) : NaN;

  const vehicleClass = str(entry?.godkjenning?.tekniskGodkjenning?.kjoretoyklassifisering?.tekniskKode?.kodeVerdi);

  const warnings: string[] = [];
  if (vehicleClass && vehicleClass !== "M1") {
    warnings.push(`This is not a passenger car (vehicle class ${vehicleClass}).`);
  }
  if (String(registration?.kjoringensArt?.kodeVerdi ?? "").startsWith("DROSJE")) {
    warnings.push("This vehicle is registered as a taxi.");
  }

  return {
    vehicle: {
      registrationNumber: normalizeRegistrationNumber(entry?.kjoretoyId?.kjennemerke),
      vin: str(entry?.kjoretoyId?.understellsnummer),
      brand,
      model,
      name: `${brand} ${model}`,
      year: Number.isInteger(year) ? year : null,
      firstRegisteredAt,
      vehicleClass,
      fuel: translate(str(td?.miljodata?.miljoOgdrivstoffGruppe?.[0]?.drivstoffKodeMiljodata?.kodeNavn)),
      transmission: translate(str(td?.motorOgDrivverk?.girkassetype?.kodeNavn)),
      seats: num(td?.persontall?.sitteplasserTotalt),
      color: translate(str(td?.karosseriOgLasteplan?.rFarge?.[0]?.kodeNavn)),
      nextInspectionDue: str(entry?.periodiskKjoretoyKontroll?.kontrollfrist),
    },
    warnings,
  };
}

/** Everything the fleet preview drawer shows. Every field is optional in the register. */
export interface VehicleDetails {
  registrationNumber: string;
  vin: string | null;
  brand: string | null;
  model: string | null;
  typeDesignation: string | null;
  registration: {
    status: string | null;
    isRegistered: boolean;
    usage: string | null;
    isTaxi: boolean;
    firstRegisteredAt: string | null;
    firstRegisteredInNorwayAt: string | null;
    currentOwnerSince: string | null;
  };
  classification: {
    vehicleClass: string | null;
    description: string | null;
    bodyType: string | null;
    color: string | null;
  };
  inspection: {
    lastApprovedAt: string | null;
    nextDueAt: string | null;
  };
  powertrain: {
    fuel: string | null;
    electricOnly: boolean;
    hybrid: string | null;
    transmission: string | null;
    powerKw: number | null;
    maxSpeedKmh: number | null;
    euroClass: string | null;
    rangeKm: number | null;
    energyConsumptionWhPerKm: number | null;
    fuelConsumptionLPer100Km: number | null;
    co2GPerKm: number | null;
  };
  dimensions: {
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
  };
  weights: {
    kerbKg: number | null;
    maxTotalKg: number | null;
    payloadKg: number | null;
    trailerBrakedKg: number | null;
    trailerUnbrakedKg: number | null;
  };
  capacity: {
    seats: number | null;
    frontSeats: number | null;
    doors: number | null;
  };
  tyres: { axle: number; tyre: string | null; rim: string | null }[];
}

/** Maps one `kjoretoydataListe` entry for display. Unlike parseVehicle it never rejects. */
export function parseVehicleDetails(entry: Json): VehicleDetails {
  const approval = entry?.godkjenning?.tekniskGodkjenning ?? {};
  const td = approval?.tekniskeData ?? {};
  const registration = entry?.registrering ?? {};
  const environment = td?.miljodata?.miljoOgdrivstoffGruppe?.[0] ?? {};
  const consumption = environment?.forbrukOgUtslipp?.[0] ?? {};
  const wltp = consumption?.wltpKjoretoyspesifikk ?? {};
  const motors: Json[] = Array.isArray(td?.motorOgDrivverk?.motor) ? td.motorOgDrivverk.motor : [];

  const statusCode = str(registration?.registreringsstatus?.kodeVerdi);
  const usageCode = str(registration?.kjoringensArt?.kodeVerdi) ?? "";
  const rawBrand = str(td?.generelt?.merke?.[0]?.merke);

  // Prefer the register's combined figure; otherwise add up each motor's max net power.
  const totalPower = (Array.isArray(td?.ovrigeTekniskeData) ? td.ovrigeTekniskeData : [])
    .find((d: Json) => d?.datafeltNavn === "motoreffektSamlet")?.datafeltVerdi;
  const motorPowerSum = motors
    .map((m) => num(m?.drivstoff?.[0]?.maksNettoEffekt))
    .filter((n): n is number => n !== null)
    .reduce<number | null>((sum, n) => (sum ?? 0) + n, null);

  const tyreSets: Json[] = td?.dekkOgFelg?.akselDekkOgFelgKombinasjon?.[0]?.akselDekkOgFelg ?? [];

  return {
    registrationNumber: normalizeRegistrationNumber(entry?.kjoretoyId?.kjennemerke),
    vin: str(entry?.kjoretoyId?.understellsnummer),
    brand: rawBrand ? formatBrand(rawBrand) : null,
    model: str(td?.generelt?.handelsbetegnelse?.[0]),
    typeDesignation: str(td?.generelt?.typebetegnelse),
    registration: {
      status: statusCode
        ? REGISTRATION_STATUS[statusCode] ?? str(registration?.registreringsstatus?.kodeNavn) ?? statusCode
        : null,
      isRegistered: statusCode === "REGISTRERT",
      usage: usageCode.startsWith("DROSJE") ? "Taxi" : str(registration?.kjoringensArt?.kodeNavn),
      isTaxi: usageCode.startsWith("DROSJE"),
      firstRegisteredAt: str(entry?.godkjenning?.forstegangsGodkjenning?.forstegangRegistrertDato),
      firstRegisteredInNorwayAt: str(entry?.forstegangsregistrering?.registrertForstegangNorgeDato),
      currentOwnerSince: str(registration?.registrertForstegangPaEierskap),
    },
    classification: {
      vehicleClass: str(approval?.kjoretoyklassifisering?.tekniskKode?.kodeVerdi),
      description: str(approval?.kjoretoyklassifisering?.beskrivelse) === "Personbil"
        ? "Passenger car"
        : str(approval?.kjoretoyklassifisering?.beskrivelse),
      bodyType: str(td?.karosseriOgLasteplan?.karosseritype?.kodeNavn),
      color: translate(str(td?.karosseriOgLasteplan?.rFarge?.[0]?.kodeNavn)),
    },
    inspection: {
      lastApprovedAt: str(entry?.periodiskKjoretoyKontroll?.sistGodkjent),
      nextDueAt: str(entry?.periodiskKjoretoyKontroll?.kontrollfrist),
    },
    powertrain: {
      fuel: translate(str(environment?.drivstoffKodeMiljodata?.kodeNavn)),
      electricOnly: td?.motorOgDrivverk?.utelukkendeElektriskDrift === true,
      hybrid: translate(str(td?.motorOgDrivverk?.hybridKategori?.kodeNavn)),
      transmission: translate(str(td?.motorOgDrivverk?.girkassetype?.kodeNavn)),
      powerKw: numeric(totalPower) ?? motorPowerSum,
      maxSpeedKmh: num(td?.motorOgDrivverk?.maksimumHastighet?.[0]),
      euroClass: str(td?.miljodata?.euroKlasse?.kodeNavn),
      rangeKm: num(wltp?.rekkeviddeKmBlandetkjoring),
      energyConsumptionWhPerKm: num(wltp?.elEnergiforbruk),
      fuelConsumptionLPer100Km: num(consumption?.forbrukBlandetKjoring),
      co2GPerKm: num(consumption?.co2BlandetKjoring),
    },
    dimensions: {
      lengthMm: num(td?.dimensjoner?.lengde),
      widthMm: num(td?.dimensjoner?.bredde),
      heightMm: num(td?.dimensjoner?.hoyde),
    },
    weights: {
      kerbKg: num(td?.vekter?.egenvekt),
      maxTotalKg: num(td?.vekter?.tillattTotalvekt),
      payloadKg: num(td?.vekter?.nyttelast),
      trailerBrakedKg: num(td?.vekter?.tillattTilhengervektMedBrems),
      trailerUnbrakedKg: num(td?.vekter?.tillattTilhengervektUtenBrems),
    },
    capacity: {
      seats: num(td?.persontall?.sitteplasserTotalt),
      frontSeats: num(td?.persontall?.sitteplasserForan),
      doors: num(td?.karosseriOgLasteplan?.antallDorer?.[0]),
    },
    tyres: tyreSets
      .map((t) => ({ axle: num(t?.akselId) ?? 0, tyre: str(t?.dekkdimensjon), rim: str(t?.felgdimensjon) }))
      .filter((t) => t.tyre || t.rim),
  };
}

const notFound = () =>
  new HttpError(
    404,
    "VEHICLE_NOT_FOUND",
    "No vehicle was found with this registration number. Please check it and try again.",
  );

const unavailable = () =>
  new HttpError(
    503,
    "LOOKUP_UNAVAILABLE",
    "The vehicle register is not responding right now. Please try again in a moment.",
  );

/** Verifies a vehicle for the add/edit form; rejects vehicles that aren't currently registered. */
export async function lookupVehicle(
  registrationNumber: string,
  log: Logger,
  config: VegvesenConfig = vegvesenConfigFromEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<VehicleLookupResult> {
  return parseVehicle(await fetchVehicleEntry(registrationNumber, log, config, fetchImpl));
}

/** Full register data for the fleet preview drawer (also for deregistered vehicles). */
export async function previewVehicle(
  registrationNumber: string,
  log: Logger,
  config: VegvesenConfig = vegvesenConfigFromEnv(),
  fetchImpl: typeof fetch = fetch,
): Promise<VehicleDetails> {
  return parseVehicleDetails(await fetchVehicleEntry(registrationNumber, log, config, fetchImpl));
}

/** Fetches the raw `kjoretoydataListe[0]` entry, mapping provider failures to HttpErrors. */
async function fetchVehicleEntry(
  registrationNumber: string,
  log: Logger,
  { apiKey, apiUrl = DEFAULT_API_URL }: VegvesenConfig,
  fetchImpl: typeof fetch,
): Promise<Json> {
  const url = new URL(apiUrl);
  url.searchParams.set("kjennemerke", registrationNumber);

  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { Accept: "application/json", "SVV-Authorization": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    log.warn("vegvesen_unreachable", { timeout: error instanceof DOMException && error.name === "TimeoutError" });
    throw unavailable();
  }

  if (res.status === 401 || res.status === 403) {
    log.error("vegvesen_auth_rejected", { status: res.status });
    throw new HttpError(503, "LOOKUP_UNAVAILABLE", "Vehicle lookup is temporarily unavailable. Please contact support.");
  }
  if (res.status === 429) {
    throw new HttpError(429, "RATE_LIMITED", "Too many lookups in a short time. Please wait a minute and try again.");
  }
  if (res.status === 204 || res.status === 404) throw notFound();
  if (res.status >= 500) {
    log.warn("vegvesen_server_error", { status: res.status });
    throw unavailable();
  }

  const body: Json = await res.json().catch(() => null);
  const entry = Array.isArray(body?.kjoretoydataListe) ? body.kjoretoydataListe[0] : undefined;

  if (!res.ok || !entry) {
    // 400s and "200 with feilmelding/empty list" both mean the plate didn't resolve.
    log.info("vehicle_not_found", { status: res.status, hasError: Boolean(body?.feilmelding) });
    throw notFound();
  }

  return entry;
}
