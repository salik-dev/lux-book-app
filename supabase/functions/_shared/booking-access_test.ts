import { assert, assertEquals, assertFalse, assertRejects } from "jsr:@std/assert@1";
import { accessKeyMatches, hashAccessKey, isAccessKey } from "./booking-access.ts";
import { HttpError } from "./http.ts";
import type { AdminClient } from "./supabase.ts";
import { FakeSupabase } from "./testing/fake-supabase.ts";
import { loadOwnedBooking } from "./contract/service.ts";

/** Same generator as the browser (src/hooks/use-booking-contract.ts). */
function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.test("access key format", () => {
  assert(isAccessKey(newKey()));
  assertFalse(isAccessKey("short"));
  assertFalse(isAccessKey(`${newKey()}x`));
  assertFalse(isAccessKey("a".repeat(42) + "+"));
  assertFalse(isAccessKey(undefined));
});

Deno.test("only the original key matches its hash", async () => {
  const key = newKey();
  const hash = await hashAccessKey(key);
  assertEquals(hash.length, 64);
  assert(await accessKeyMatches(key, hash));
  assertFalse(await accessKeyMatches(newKey(), hash));
  assertFalse(await accessKeyMatches(key, null)); // legacy bookings have no key
  assertFalse(await accessKeyMatches(undefined, hash));
});

async function bookingWithKey(key: string | null) {
  const db = new FakeSupabase();
  db.table("bookings").push({
    id: "b-1",
    status: "pending",
    access_key_hash: key ? await hashAccessKey(key) : null,
  });
  db.joins.set("bookings", (row) => ({ ...row, customer: { id: "c-1", user_id: null }, car: { id: "car-1" } }));
  return db as unknown as AdminClient;
}

Deno.test("loadOwnedBooking requires the booking's key and never returns its hash", async () => {
  const key = newKey();
  const admin = await bookingWithKey(key);

  const booking = await loadOwnedBooking(admin, "b-1", key);
  assertEquals(booking.id, "b-1");
  assertFalse("access_key_hash" in booking);

  for (const wrong of [newKey(), undefined, "", key.slice(1)]) {
    const err = await assertRejects(() => loadOwnedBooking(admin, "b-1", wrong), HttpError);
    assertEquals([err.status, err.code], [404, "BOOKING_NOT_FOUND"]);
  }
});

Deno.test("bookings without a key (legacy/admin) can't be opened via the customer API", async () => {
  const admin = await bookingWithKey(null);
  await assertRejects(() => loadOwnedBooking(admin, "b-1", newKey()), HttpError);
});

Deno.test("unknown booking ids look the same as wrong keys", async () => {
  const admin = await bookingWithKey(newKey());
  const err = await assertRejects(() => loadOwnedBooking(admin, "missing", newKey()), HttpError);
  assertEquals(err.code, "BOOKING_NOT_FOUND");
});
