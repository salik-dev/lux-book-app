import { formatAgreedDuration, formatContractDate, formatContractDateTime, formatNok } from "./format.ts";

/**
 * The values stamped onto the rental agreement. Only these fields are populated;
 * everything else on the template (driver's licence number, account number,
 * national identity number, reg. no., driver age, fuel level, comment, broker
 * signature) is intentionally left blank.
 *
 * Fixed values already printed on the template ("Place: Oslo", "Additional KM:
 * NOK 0", "Included KM during the rental period: Free", "Deductible in the event
 * of damage: NOK 20,000") are not re-stamped.
 */
export interface ContractFields {
  renterName: string;
  renterPhone: string;
  renterAddress: string;
  renterPostalCode: string;
  renterCity: string;
  make: string;
  agreedDuration: string;
  timeOfHandover: string;
  timeOfReturn: string;
  /** Base rent for the vehicle (plus delivery), shown on the "Agreed rent" line. */
  agreedRent: string;
  /** Driver surcharge (25% of base) on the "Other" line; empty when no driver. */
  otherCharge: string;
  /** Security deposit charged at checkout. */
  deposit: string;
  /** Full amount charged: rent + driver + delivery + deposit. */
  total: string;
  /** Left blank (payment is handled online). */
  paymentMethod: string;
  /** Renter's signing date. */
  renterSignatureDate: string;
}

export interface ContractSource {
  customer: {
    full_name: string;
    phone: string;
    address: string;
    postal_code: string;
    city: string;
  };
  car: { brand: string; model: string };
  booking: { start_datetime: string; end_datetime: string };
  /** Base rental amount for the vehicle (excludes driver, delivery and deposit). */
  basePrice: number;
  /** Delivery fee (0 until delivery is priced); folded into the agreed-rent line. */
  deliveryFee: number;
  /** 25% driver surcharge, 0 when no driver was requested; shown on the "Other" line. */
  driverSurcharge: number;
  /** Security deposit charged at checkout. */
  depositAmount: number;
  /** Authoritative total charged at checkout (rent + driver + delivery + deposit). */
  totalPrice: number;
  /** When the contract is issued for signing. */
  issuedAt: Date;
}

export class ContractDataError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing contract data: ${missing.join(", ")}`);
    this.name = "ContractDataError";
  }
}

const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

export function buildContractFields(source: ContractSource): ContractFields {
  const start = new Date(source.booking.start_datetime);
  const end = new Date(source.booking.end_datetime);

  const required: Record<string, string> = {
    "customer name": clean(source.customer.full_name),
    "customer phone": clean(source.customer.phone),
    "customer address": clean(source.customer.address),
    "customer postal code": clean(source.customer.postal_code),
    "customer city": clean(source.customer.city),
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (Number.isNaN(start.getTime())) missing.push("pickup date");
  if (Number.isNaN(end.getTime())) missing.push("return date");
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
    missing.push("valid rental period");
  }
  if (!Number.isFinite(source.totalPrice) || source.totalPrice <= 0) {
    missing.push("booking amount");
  }
  if (missing.length > 0) throw new ContractDataError(missing);

  const rent = Math.max(0, source.basePrice) + Math.max(0, source.deliveryFee);
  const driver = Math.max(0, source.driverSurcharge);
  const depositAmount = Math.max(0, source.depositAmount);

  return {
    renterName: required["customer name"],
    renterPhone: required["customer phone"],
    renterAddress: required["customer address"],
    renterPostalCode: required["customer postal code"],
    renterCity: required["customer city"],
    make: clean(`${source.car.brand} ${source.car.model}`),
    agreedDuration: formatAgreedDuration(start, end),
    timeOfHandover: formatContractDateTime(start),
    timeOfReturn: formatContractDateTime(end),
    agreedRent: formatNok(rent),
    // Only shown when a driver was requested; otherwise the "Other" line stays blank.
    otherCharge: driver > 0 ? formatNok(driver) : "",
    deposit: formatNok(depositAmount),
    total: formatNok(source.totalPrice),
    paymentMethod: "",
    renterSignatureDate: formatContractDate(source.issuedAt),
  };
}
