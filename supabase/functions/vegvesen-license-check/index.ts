// @ts-nocheck
// Statens vegvesen "Sjekk førerkort" lookup via Maskinporten.
//
// Flow: sign a JWT grant with the Buypass enterprise (authentication) certificate
// (RS256 + x5c) -> exchange it at Maskinporten for an access token -> call the
// Vegvesen licence-info API with that token.
//
// This function is public (verify_jwt = false) because the booking flow authenticates
// customers with BankID (Criipto), not Supabase Auth. To stop it being used as an
// open "look up anyone's licence" oracle, a lookup is only allowed for a NIN that
// already has a verified row in `bankid_verifications` — i.e. you can only check the
// identity you proved with BankID.
//
// Required secrets (supabase secrets set):
//   MASKINPORTEN_CLIENT_ID          e.g. 11fe5758-8319-42ba-a2cf-38660b954623
//   MASKINPORTEN_PRIVATE_KEY_B64    base64 of key.pem (PKCS#8, "BEGIN PRIVATE KEY")
//   MASKINPORTEN_CERT_CHAIN_B64     base64 of cert-chain.pem (leaf + intermediate)
// Optional (sensible defaults below):
//   MASKINPORTEN_SCOPE, MASKINPORTEN_AUDIENCE, MASKINPORTEN_TOKEN_URL,
//   VEGVESEN_RESOURCE, VEGVESEN_API_URL, VEGVESEN_REQUIRE_BANKID ("false" to disable gate)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID = Deno.env.get("MASKINPORTEN_CLIENT_ID");
const SCOPE = Deno.env.get("MASKINPORTEN_SCOPE") ?? "svv:forerkort/oppslag";
const AUDIENCE = Deno.env.get("MASKINPORTEN_AUDIENCE") ?? "https://maskinporten.no/";
const TOKEN_URL = Deno.env.get("MASKINPORTEN_TOKEN_URL") ?? "https://maskinporten.no/token";
const RESOURCE = Deno.env.get("VEGVESEN_RESOURCE") ?? "https://www.vegvesen.no";
const API_URL = Deno.env.get("VEGVESEN_API_URL")
  ?? "https://sjekk-forerkort-api.atlas.vegvesen.no/api/v1/licence-info";
// Default OFF (project decision): a licence check is allowed for any typed NIN,
// once, from the booking form. Set VEGVESEN_REQUIRE_BANKID=true to restrict
// lookups to identities that have completed BankID.
const REQUIRE_BANKID = (Deno.env.get("VEGVESEN_REQUIRE_BANKID") ?? "false").toLowerCase() === "true";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getAdminClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceRole, { auth: { persistSession: false } });
};

// ---- Certificate / key handling (cached across warm invocations) ----
function pemToDer(pem: string): ArrayBuffer {
  // Extract ONLY the base64 between the BEGIN/END markers, ignoring any
  // "Bag Attributes"/friendlyName/localKeyID preamble that OpenSSL's pkcs12
  // export prepends to the key file.
  const match = pem.match(/-----BEGIN [A-Z ]+-----([\s\S]*?)-----END [A-Z ]+-----/);
  const b64 = (match ? match[1] : pem).replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let signingKey: CryptoKey | null = null;
async function getSigningKey(): Promise<CryptoKey> {
  if (signingKey) return signingKey;
  const b64 = Deno.env.get("MASKINPORTEN_PRIVATE_KEY_B64");
  if (!b64) throw new Error("Missing MASKINPORTEN_PRIVATE_KEY_B64.");
  signingKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(atob(b64.replace(/\s+/g, ""))),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return signingKey;
}

let x5cCache: string[] | null = null;
function getX5c(): string[] {
  if (x5cCache) return x5cCache;
  const b64 = Deno.env.get("MASKINPORTEN_CERT_CHAIN_B64");
  if (!b64) throw new Error("Missing MASKINPORTEN_CERT_CHAIN_B64.");
  const pem = atob(b64.replace(/\s+/g, ""));
  x5cCache = (pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [])
    .map((c) => c.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, ""));
  if (x5cCache.length === 0) throw new Error("No certificates found in MASKINPORTEN_CERT_CHAIN_B64.");
  return x5cCache;
}

// ---- Maskinporten token (cached until ~5s before expiry) ----
let cachedToken: { token: string; expiresAt: number } | null = null;
async function getAccessToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now() + 5000) return cachedToken.token;
  if (!CLIENT_ID) throw new Error("Missing MASKINPORTEN_CLIENT_ID.");

  const key = await getSigningKey();
  const now = Math.floor(Date.now() / 1000);
  const assertion = await create(
    { alg: "RS256", typ: "JWT", x5c: getX5c() },
    { iss: CLIENT_ID, scope: SCOPE, aud: AUDIENCE, resource: RESOURCE, iat: now, exp: now + 100, jti: crypto.randomUUID() },
    key,
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Maskinporten token error (${res.status}): ${data.error_description || data.error || JSON.stringify(data)}`,
    );
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 100) * 1000 };
  return cachedToken.token;
}

async function callVegvesen(nin: string, lastName: string, token: string) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ lookupNinOrDnumber: nin, lookupLastName: lastName }),
  });
  const body = await res.json().catch(() => ({}));
  return { httpStatus: res.status, body };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { nin, lastName } = await req.json().catch(() => ({}));
    const cleanNin = String(nin ?? "").trim();
    const cleanLastName = String(lastName ?? "").trim();

    // --- Input validation ---
    if (!cleanNin || !cleanLastName) {
      return json({ error: "nin and lastName are required." }, 400);
    }
    if (!/^\d{11}$/.test(cleanNin)) {
      return json({ error: "National ID/D-number must be 11 digits." }, 400);
    }

    // --- Access gate: NIN must have a verified BankID record ---
    if (REQUIRE_BANKID) {
      const admin = getAdminClient();
      const { data: verifiedRows, error: gateError } = await admin
        .from("bankid_verifications")
        .select("id")
        .eq("nin", cleanNin)
        .eq("verified", true)
        .limit(1);
      if (gateError) throw new Error(`BankID gate lookup failed: ${gateError.message}`);
      if (!verifiedRows || verifiedRows.length === 0) {
        return json(
          { error: "Driving licence can only be verified for a BankID-verified identity. Please complete BankID first." },
          403,
        );
      }
    }

    // --- Token + lookup (retry once if the cached token was rejected) ---
    let token = await getAccessToken();
    let { httpStatus, body } = await callVegvesen(cleanNin, cleanLastName, token);
    if (httpStatus === 401) {
      token = await getAccessToken(true);
      ({ httpStatus, body } = await callVegvesen(cleanNin, cleanLastName, token));
    }

    const info = body?.meta?.licenceInfo;
    const success = httpStatus === 200 && (body?.code === "OK" || Boolean(info));

    // Best-effort audit (ignored if the table does not exist).
    try {
      const admin = getAdminClient();
      await admin.from("license_verifications").insert({
        nin: cleanNin,
        last_name: cleanLastName,
        verified: success,
        categories: success ? (info?.licenceCategories ?? []).map((c: any) => c.licenceCategory) : [],
        response_code: body?.code ?? null,
        checked_at: new Date().toISOString(),
      });
    } catch (_) { /* audit table optional */ }

    if (success) {
      const categories = (info?.licenceCategories ?? []).map((c: any) => c.licenceCategory);
      return json({
        verified: true,
        fullName: info?.fullName ?? null,
        ninOrDnumber: info?.ninOrDnumber ?? cleanNin,
        categories,
        hasValidLicence: categories.length > 0,
        dailyLookupsRemaining: body?.meta?.dailyLookupsRemaining ?? null,
        licenceInfo: info ?? null,
      });
    }

    // Lookup completed but negative (invalid id, name mismatch, no match).
    // Return 200 with verified:false so the frontend can show a friendly message.
    return json({
      verified: false,
      code: body?.code ?? "LOOKUP_FAILED",
      message: body?.detail
        ? String(body.detail)
        : "Driving licence could not be verified. Please check the national ID number and last name.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("vegvesen-license-check error:", message);
    return json({ error: message }, 500);
  }
});
