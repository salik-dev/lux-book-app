import { invoke } from "@/lib/edge-function";

/** Client for the admin-only `vehicle-lookup` edge function (Statens vegvesen register). */

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
  warnings: string[];
}

/** Full register data shown in the fleet preview drawer. Mirrors the server's VehicleDetails. */
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
  dimensions: { lengthMm: number | null; widthMm: number | null; heightMm: number | null };
  weights: {
    kerbKg: number | null;
    maxTotalKg: number | null;
    payloadKg: number | null;
    trailerBrakedKg: number | null;
    trailerUnbrakedKg: number | null;
  };
  capacity: { seats: number | null; frontSeats: number | null; doors: number | null };
  tyres: { axle: number; tyre: string | null; rim: string | null }[];
}

/** Same rules as the server: uppercase, no spaces/dashes, 2-7 letters or digits. */
export const normalizeRegistrationNumber = (value: string) => value.toUpperCase().replace(/[\s-]+/g, "");
export const isRegistrationNumber = (value: string) => /^[A-ZÆØÅ0-9]{2,7}$/.test(value);

/** "EN10257" -> "EN 10257" for display (standard plates only). */
export const formatPlate = (plate: string) => plate.replace(/^([A-ZÆØÅ]{2})(\d{4,5})$/, "$1 $2");

/**
 * Verifies a plate for the Add/Edit Vehicle form. Fails with VEHICLE_ALREADY_IN_FLEET if
 * another fleet car uses it; pass `carId` when editing so the car may keep its own plate.
 */
export const lookupVehicle = (registrationNumber: string, carId?: string) =>
  invoke<VehicleLookupResult>("vehicle-lookup", { mode: "verify", registrationNumber, carId });

export const previewVehicle = (registrationNumber: string) =>
  invoke<{ details: VehicleDetails }>("vehicle-lookup", { mode: "preview", registrationNumber }).then((r) => r.details);
