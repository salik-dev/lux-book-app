import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import { HttpError, createLogger } from "../http.ts";
import {
  DEFAULT_API_URL,
  formatBrand,
  isRegistrationNumber,
  formatPlate,
  lookupVehicle,
  normalizeRegistrationNumber,
  parseVehicle,
  parseVehicleDetails,
  previewVehicle,
} from "./vehicle.ts";

/** Trimmed real response for EN 10257 (2025 NIO ET5 Touring, registered as a taxi). */
function sampleEntry() {
  return {
    kjoretoyId: { kjennemerke: "EN 10257", understellsnummer: "LJ1EEAUU2PG584120" },
    forstegangsregistrering: { registrertForstegangNorgeDato: "2025-01-22" },
    registrering: {
      kjoringensArt: { kodeVerdi: "DROSJE_EIER" },
      registreringsstatus: { kodeNavn: "Påregistrert", kodeVerdi: "REGISTRERT" },
    },
    godkjenning: {
      forstegangsGodkjenning: { forstegangRegistrertDato: "2025-01-22" },
      tekniskGodkjenning: {
        kjoretoyklassifisering: { tekniskKode: { kodeVerdi: "M1" } },
        tekniskeData: {
          generelt: { handelsbetegnelse: ["ET5 Touring"], merke: [{ merke: "NIO", merkeKode: "1441" }] },
          karosseriOgLasteplan: { rFarge: [{ kodeNavn: "Svart" }] },
          miljodata: { miljoOgdrivstoffGruppe: [{ drivstoffKodeMiljodata: { kodeNavn: "Elektrisk" } }] },
          motorOgDrivverk: { girkassetype: { kodeNavn: "Automat" } },
          persontall: { sitteplasserTotalt: 5 },
        },
      },
    },
    periodiskKjoretoyKontroll: { kontrollfrist: "2027-01-23" },
  };
}

/** sampleEntry() plus the technical data the preview drawer reads (same EN 10257 response). */
function detailedEntry() {
  const entry = sampleEntry() as Record<string, any>;
  entry.registrering.kjoringensArt.kodeNavn = "Drosje løyvehaver";
  entry.registrering.registrertForstegangPaEierskap = "2025-07-09T14:12:17.363+02:00";
  entry.periodiskKjoretoyKontroll.sistGodkjent = "2026-01-23";
  const approval = entry.godkjenning.tekniskGodkjenning;
  approval.kjoretoyklassifisering.beskrivelse = "Personbil";
  Object.assign(approval.tekniskeData, {
    generelt: { ...approval.tekniskeData.generelt, typebetegnelse: "NACC2T1" },
    karosseriOgLasteplan: {
      antallDorer: [5],
      karosseritype: { kodeNavn: "Stasjonsvogn (AC)" },
      rFarge: [{ kodeNavn: "Svart" }],
    },
    dimensjoner: { bredde: 1960, hoyde: 1499, lengde: 4790 },
    dekkOgFelg: {
      akselDekkOgFelgKombinasjon: [{
        akselDekkOgFelg: [
          { akselId: 1, dekkdimensjon: "245/45R19", felgdimensjon: "19×8.5J " },
          { akselId: 2, dekkdimensjon: "245/45R19", felgdimensjon: "19×8.5J " },
        ],
      }],
    },
    miljodata: {
      euroKlasse: { kodeNavn: "0-utslipp" },
      miljoOgdrivstoffGruppe: [{
        drivstoffKodeMiljodata: { kodeNavn: "Elektrisk" },
        forbrukOgUtslipp: [{ wltpKjoretoyspesifikk: { rekkeviddeKmBlandetkjoring: 560, elEnergiforbruk: 193 } }],
      }],
    },
    motorOgDrivverk: {
      girkassetype: { kodeNavn: "Automat" },
      hybridKategori: { kodeNavn: "Ingen" },
      maksimumHastighet: [200],
      motor: [
        { drivstoff: [{ maksNettoEffekt: 150 }] },
        { drivstoff: [{ maksNettoEffekt: 210 }] },
      ],
      utelukkendeElektriskDrift: true,
    },
    ovrigeTekniskeData: [{ datafeltNavn: "motoreffektSamlet", datafeltVerdi: "360.0" }],
    persontall: { sitteplasserForan: 2, sitteplasserTotalt: 5 },
    vekter: {
      egenvekt: 2210,
      nyttelast: 445,
      tillattTilhengervektMedBrems: 1400,
      tillattTilhengervektUtenBrems: 750,
      tillattTotalvekt: 2730,
    },
  });
  return entry;
}

const log = createLogger("test");
const respond = (status: number, body?: unknown): typeof fetch => () =>
  Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));

Deno.test("registration numbers are normalised and validated", () => {
  assertEquals(normalizeRegistrationNumber(" en 10-257 "), "EN10257");
  assertEquals(isRegistrationNumber("EN10257"), true);
  assertEquals(isRegistrationNumber("E"), false);
  assertEquals(isRegistrationNumber("EN10257X"), false);
  assertEquals(isRegistrationNumber("EN-1025"), false);
});

Deno.test("brands are title-cased except short acronyms", () => {
  assertEquals(formatBrand("MERCEDES-BENZ"), "Mercedes-Benz");
  assertEquals(formatBrand("TESLA"), "Tesla");
  assertEquals(formatBrand("BMW"), "BMW");
  assertEquals(formatBrand("NIO"), "NIO");
  assertEquals(formatBrand("Polestar"), "Polestar");
});

Deno.test("parses the fields the fleet form needs", () => {
  const { vehicle, warnings } = parseVehicle(sampleEntry());
  assertEquals(vehicle.registrationNumber, "EN10257");
  assertEquals(vehicle.vin, "LJ1EEAUU2PG584120");
  assertEquals([vehicle.brand, vehicle.model, vehicle.name, vehicle.year], ["NIO", "ET5 Touring", "NIO ET5 Touring", 2025]);
  assertEquals([vehicle.fuel, vehicle.transmission, vehicle.seats, vehicle.color], ["Electric", "Automatic", 5, "Black"]);
  assertEquals(warnings, ["This vehicle is registered as a taxi."]);
});

Deno.test("year falls back to first registration in Norway", () => {
  const entry = sampleEntry();
  delete (entry.godkjenning as Record<string, unknown>).forstegangsGodkjenning;
  entry.forstegangsregistrering.registrertForstegangNorgeDato = "2019-05-02";
  assertEquals(parseVehicle(entry).vehicle.year, 2019);
});

Deno.test("deregistered vehicles are rejected", () => {
  const entry = sampleEntry();
  entry.registrering.registreringsstatus = { kodeNavn: "Avregistrert", kodeVerdi: "AVREGISTRERT" };
  const err = assertThrows(() => parseVehicle(entry), HttpError);
  assertEquals(err.code, "VEHICLE_NOT_REGISTERED");
});

Deno.test("provider responses map to stable error codes", async () => {
  const cases: [typeof fetch, number, string][] = [
    [respond(200, { kjoretoydataListe: [] }), 404, "VEHICLE_NOT_FOUND"],
    [respond(200, { feilmelding: "Kjøretøy ikke funnet" }), 404, "VEHICLE_NOT_FOUND"],
    [respond(204), 404, "VEHICLE_NOT_FOUND"],
    [respond(400, { feilmelding: "Ugyldig kjennemerke" }), 404, "VEHICLE_NOT_FOUND"],
    [respond(403), 503, "LOOKUP_UNAVAILABLE"],
    [respond(429), 429, "RATE_LIMITED"],
    [respond(502), 503, "LOOKUP_UNAVAILABLE"],
    [() => Promise.reject(new TypeError("network")), 503, "LOOKUP_UNAVAILABLE"],
  ];
  for (const [fetchImpl, status, code] of cases) {
    const err = await assertRejects(() => lookupVehicle("EN10257", log, { apiKey: "key" }, fetchImpl), HttpError);
    assertEquals([err.status, err.code], [status, code]);
  }
});

Deno.test("sends the plate as the kjennemerke query param with the API key header", async () => {
  let seen: Request | undefined;
  const fetchImpl: typeof fetch = (input, init) => {
    seen = new Request(input, init);
    return respond(200, { kjoretoydataListe: [sampleEntry()] })(input, init);
  };
  const result = await lookupVehicle("EN10257", log, { apiKey: "secret-key" }, fetchImpl);
  const url = new URL(seen!.url);
  assertEquals(url.origin + url.pathname, DEFAULT_API_URL);
  assertEquals(url.searchParams.get("kjennemerke"), "EN10257");
  assertEquals(seen!.headers.get("SVV-Authorization"), "secret-key");
  assertEquals(result.vehicle.model, "ET5 Touring");

  await lookupVehicle("EN10257", log, { apiKey: "k", apiUrl: "https://example.test/kjoretoydata" }, fetchImpl);
  assertEquals(seen!.url, "https://example.test/kjoretoydata?kjennemerke=EN10257");
});

Deno.test("plates are formatted for display", () => {
  assertEquals(formatPlate("EN10257"), "EN 10257");
  assertEquals(formatPlate("EJ82693"), "EJ 82693");
  assertEquals(formatPlate("LUXCAR"), "LUXCAR"); // personalised plates stay as-is
});

Deno.test("parses the full register data for the preview drawer", () => {
  const d = parseVehicleDetails(detailedEntry());
  assertEquals([d.registrationNumber, d.vin, d.brand, d.model, d.typeDesignation], [
    "EN10257",
    "LJ1EEAUU2PG584120",
    "NIO",
    "ET5 Touring",
    "NACC2T1",
  ]);
  assertEquals(d.registration, {
    status: "Registered",
    isRegistered: true,
    usage: "Taxi",
    isTaxi: true,
    firstRegisteredAt: "2025-01-22",
    firstRegisteredInNorwayAt: "2025-01-22",
    currentOwnerSince: "2025-07-09T14:12:17.363+02:00",
  });
  assertEquals(d.classification, {
    vehicleClass: "M1",
    description: "Passenger car",
    bodyType: "Stasjonsvogn (AC)",
    color: "Black",
  });
  assertEquals(d.inspection, { lastApprovedAt: "2026-01-23", nextDueAt: "2027-01-23" });
  assertEquals(d.powertrain, {
    fuel: "Electric",
    electricOnly: true,
    hybrid: "None",
    transmission: "Automatic",
    powerKw: 360,
    maxSpeedKmh: 200,
    euroClass: "0-utslipp",
    rangeKm: 560,
    energyConsumptionWhPerKm: 193,
    fuelConsumptionLPer100Km: null,
    co2GPerKm: null,
  });
  assertEquals(d.dimensions, { lengthMm: 4790, widthMm: 1960, heightMm: 1499 });
  assertEquals(d.weights, {
    kerbKg: 2210,
    maxTotalKg: 2730,
    payloadKg: 445,
    trailerBrakedKg: 1400,
    trailerUnbrakedKg: 750,
  });
  assertEquals(d.capacity, { seats: 5, frontSeats: 2, doors: 5 });
  assertEquals(d.tyres, [
    { axle: 1, tyre: "245/45R19", rim: "19×8.5J" },
    { axle: 2, tyre: "245/45R19", rim: "19×8.5J" },
  ]);
});

Deno.test("power falls back to the sum of the motors", () => {
  const entry = detailedEntry();
  delete entry.godkjenning.tekniskGodkjenning.tekniskeData.ovrigeTekniskeData;
  assertEquals(parseVehicleDetails(entry).powertrain.powerKw, 360);
});

Deno.test("preview shows deregistered vehicles instead of rejecting them", async () => {
  const entry = detailedEntry();
  entry.registrering.registreringsstatus = { kodeNavn: "Avregistrert", kodeVerdi: "AVREGISTRERT" };
  const details = await previewVehicle("EN10257", log, { apiKey: "k" }, respond(200, { kjoretoydataListe: [entry] }));
  assertEquals([details.registration.status, details.registration.isRegistered], ["Deregistered", false]);
});

Deno.test("preview tolerates a sparse register entry", () => {
  const d = parseVehicleDetails({ kjoretoyId: { kjennemerke: "AB 12345" } });
  assertEquals(d.registrationNumber, "AB12345");
  assertEquals([d.brand, d.model, d.powertrain.powerKw, d.tyres], [null, null, null, []]);
  assertEquals(d.registration.isRegistered, false);
});
