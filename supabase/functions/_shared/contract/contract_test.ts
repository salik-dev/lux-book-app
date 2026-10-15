import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { calendarDuration, formatAgreedDuration, formatContractDate, formatContractDateTime, formatNok } from "./format.ts";
import { buildContractFields, ContractDataError, type ContractSource } from "./fields.ts";
import { ContractRenderError, loadContractAssets, renderContractPdf } from "./pdf.ts";
import { calculateBookingPricing } from "../booking-pricing.ts";


const source = (overrides: Partial<ContractSource> = {}): ContractSource => ({
  customer: {
    full_name: "Kari  Nordmann",
    phone: "+47 486 72 767",
    address: "Thorvald Meyers gate 32 A",
    postal_code: "0555",
    city: "Oslo",
  },
  car: { brand: "Tesla", model: "Model 3" },
  booking: { start_datetime: "2026-05-04T10:00:00.000Z", end_datetime: "2026-06-04T10:00:00.000Z" },
  basePrice: 23000,
  deliveryFee: 0,
  driverSurcharge: 0,
  depositAmount: 0,
  totalPrice: 23000,
  issuedAt: new Date("2026-04-28T09:30:00.000Z"),
  ...overrides,
});

Deno.test("dates render in Oslo time", () => {
  // 10:00Z in May = 12:00 CEST
  assertEquals(formatContractDateTime(new Date("2026-05-04T10:00:00Z")), "04.05.2026 at 12:00");
  // 23:30Z on 31 Dec = 00:30 on 1 Jan in Oslo
  assertEquals(formatContractDate(new Date("2026-12-31T23:30:00Z")), "01.01.2027");
});

Deno.test("agreed duration: days and hours", () => {
  assertEquals(
    formatAgreedDuration(new Date("2026-10-08T08:00:00Z"), new Date("2026-10-11T12:00:00Z")),
    "3 days and 4 hours",
  );
  assertEquals(formatAgreedDuration(new Date("2026-10-08T08:00:00Z"), new Date("2026-10-08T09:00:00Z")), "1 hour");
});

Deno.test("agreed duration: months and years", () => {
  assertEquals(formatAgreedDuration(new Date("2026-05-04T10:00:00Z"), new Date("2026-06-04T10:00:00Z")), "1 month");
  assertEquals(
    formatAgreedDuration(new Date("2026-01-15T09:00:00Z"), new Date("2027-03-17T11:30:00Z")),
    "1 year, 2 months, 2 days, 2 hours and 30 minutes",
  );
});

Deno.test("agreed duration is wall-clock based across DST changes", () => {
  // Oslo leaves DST on 2026-10-25: 12:00 -> 12:00 is 25 real hours but one calendar day.
  const d = calendarDuration(new Date("2026-10-24T10:00:00Z"), new Date("2026-10-25T11:00:00Z"));
  assertEquals(d, { years: 0, months: 0, days: 1, hours: 0, minutes: 0 });
  // Spring forward on 2026-03-29.
  assertEquals(
    formatAgreedDuration(new Date("2026-03-28T11:00:00Z"), new Date("2026-03-29T10:00:00Z")),
    "1 day",
  );
});

Deno.test("month arithmetic clamps to month end", () => {
  // End of January to end of February counts as one month (31 Jan + 1 month = 28 Feb).
  assertEquals(
    formatAgreedDuration(new Date("2027-01-31T11:00:00Z"), new Date("2027-02-28T11:00:00Z")),
    "1 month",
  );
  assertEquals(
    formatAgreedDuration(new Date("2027-01-31T11:00:00Z"), new Date("2027-02-27T11:00:00Z")),
    "27 days",
  );
});

Deno.test("NOK formatting", () => {
  assertEquals(formatNok(23000), "NOK 23,000");
  assertEquals(formatNok(0), "NOK 0");
  assertEquals(formatNok(1234.5), "NOK 1,234.50");
});

Deno.test("pricing excludes deposit from the contract amount", () => {
  const pricing = calculateBookingPricing({
    car: { base_price_per_hour: 500, base_price_per_day: 4000, deposit_amount: 2000 },
    start: new Date("2026-10-08T08:00:00Z"),
    end: new Date("2026-10-10T09:30:00Z"),
    mode: "daily-basis",
    withDriver: true,
  });
  assertEquals(pricing.rentalHours, 49);
  assertEquals(pricing.rentalDays, 3);
  assertEquals(pricing.basePrice, 12000);
  assertEquals(pricing.driverSurcharge, 3000);
  assertEquals(pricing.totalPrice, 17000);
  assertEquals(pricing.totalExcludingDeposit, 15000);
});

Deno.test("pricing: hourly mode, minimum one hour, string amounts from Postgres numeric", () => {
  const pricing = calculateBookingPricing({
    car: { base_price_per_hour: "499.90", base_price_per_day: "3000", deposit_amount: null },
    start: new Date("2026-10-08T08:00:00Z"),
    end: new Date("2026-10-08T08:20:00Z"),
    mode: "flat-rate",
    withDriver: false,
  });
  assertEquals(pricing.rentalHours, 1);
  assertEquals(pricing.totalPrice, 499.9);
  assertEquals(pricing.totalExcludingDeposit, 499.9);
});

Deno.test("contract fields map only the requested values", () => {
  const fields = buildContractFields(source());
  assertEquals(fields, {
    renterName: "Kari Nordmann",
    renterPhone: "+47 486 72 767",
    renterAddress: "Thorvald Meyers gate 32 A",
    renterPostalCode: "0555",
    renterCity: "Oslo",
    make: "Tesla Model 3",
    agreedDuration: "1 month",
    timeOfHandover: "04.05.2026 at 12:00",
    timeOfReturn: "04.06.2026 at 12:00",
    agreedRent: "NOK 23,000",
    otherCharge: "",
    deposit: "NOK 0",
    total: "NOK 23,000",
    paymentMethod: "",
    renterSignatureDate: "28.04.2026",
  });
});

Deno.test("with-driver and deposit are itemised; total is the full charged amount", () => {
  // base 12,000 + driver 3,000 (25%) + deposit 2,000 = total 17,000.
  const fields = buildContractFields(source({
    basePrice: 12000,
    driverSurcharge: 3000,
    depositAmount: 2000,
    totalPrice: 17000,
  }));
  assertEquals(fields.agreedRent, "NOK 12,000");
  assertEquals(fields.otherCharge, "NOK 3,000");
  assertEquals(fields.deposit, "NOK 2,000");
  assertEquals(fields.total, "NOK 17,000");
  assertEquals(fields.paymentMethod, "");
});

Deno.test("delivery fee folds into the agreed-rent line", () => {
  const fields = buildContractFields(source({ basePrice: 10000, deliveryFee: 500, totalPrice: 10500 }));
  assertEquals(fields.agreedRent, "NOK 10,500");
  assertEquals(fields.otherCharge, "");
});

Deno.test("contract fields reject missing customer or booking data", () => {
  const err = assertThrows(
    () =>
      buildContractFields(
        source({
          customer: { full_name: " ", phone: "1", address: "", postal_code: "0555", city: "Oslo" },
          totalPrice: 0,
        }),
      ),
    ContractDataError,
  );
  assertEquals(err.missing, ["customer name", "customer address", "booking amount"]);
});

Deno.test("PDF renders onto the template, keeps the page count and prints names exactly", async () => {
  const assets = await loadContractAssets();
  const bytes = await renderContractPdf(assets, buildContractFields(source({
    customer: {
      full_name: "Åse Ødegård Łukasz",
      phone: "48672767",
      address: "Thorvald Meyers gate 32 A",
      postal_code: "0555",
      city: "Oslo",
    },
  })), { title: "Rental Agreement FJB1" });
  const doc = await PDFDocument.load(bytes);
  assertEquals(doc.getPageCount(), 12);
  assertEquals(doc.getTitle(), "Rental Agreement FJB1");

  const out = Deno.env.get("CONTRACT_SAMPLE_OUT");
  if (out) await Deno.writeFile(out, bytes);
});

Deno.test("PDF rendering refuses values that cannot fit", async () => {
  const assets = await loadContractAssets();
  const fields = buildContractFields(source());
  const err = await assertRejects(
    () => renderContractPdf(assets, { ...fields, renterName: "X".repeat(200) }, { title: "t" }),
    ContractRenderError,
  );
  assertEquals([err.code, err.field], ["CONTRACT_FIELD_TOO_LONG", "renterName"]);
});

Deno.test("PDF rendering refuses characters the font cannot print instead of altering them", async () => {
  const assets = await loadContractAssets();
  const fields = buildContractFields(source());
  const err = await assertRejects(
    () => renderContractPdf(assets, { ...fields, renterName: "山田 太郎" }, { title: "t" }),
    ContractRenderError,
  );
  assertEquals(err.code, "CONTRACT_UNSUPPORTED_CHARACTER");
});
