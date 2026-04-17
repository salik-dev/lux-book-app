// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getAdminClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceRole, { auth: { persistSession: false } });
};

const cleanupExpiredTokens = async (admin: ReturnType<typeof getAdminClient>) => {
  const nowIso = new Date().toISOString();
  await admin
    .from("bankid_verifications")
    .update({ jwt_access_token: null, bankid_access_token: null })
    .not("jwt_access_token", "is", null)
    .lte("contract_end_at", nowIso);
};

const createJwtToken = async (payload: {
  verificationId: string;
  sessionId: string;
  subjectId?: string | null;
  nin?: string | null;
  provider?: string | null;
}) => {
  const secret = Deno.env.get("BANKID_JWT_SECRET");
  if (!secret) {
    throw new Error("Missing BANKID_JWT_SECRET.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  // const expSec = nowSec + 7 * 24 * 60 * 60;
  const expSec = nowSec + 120;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const token = await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: payload.subjectId || payload.nin || payload.sessionId,
      vid: payload.verificationId,
      sid: payload.sessionId,
      nin: payload.nin || undefined,
      provider: payload.provider || "nbid",
      iat: nowSec,
      exp: expSec,
    },
    key
  );

  return {
    token,
    expiresAt: new Date(expSec * 1000).toISOString(),
  };
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const admin = getAdminClient();
    const body = await req.json().catch(() => ({}));
    await cleanupExpiredTokens(admin);
    const action = body.action || "issue_token";
    if (action === "cleanup_expired_jwt") {
      const nowIso = new Date().toISOString();
      const verificationId = body.verificationId || null;
      const sessionId = body.sessionId || null;

      if (verificationId || sessionId) {
        let query = admin
          .from("bankid_verifications")
          .update({ jwt_access_token: null, bankid_access_token: null })
          .not("jwt_access_token", "is", null)
          .lte("contract_end_at", nowIso);

        if (verificationId) {
          query = query.eq("id", verificationId);
        } else if (sessionId) {
          query = query.eq("session_id", sessionId);
        }

        await query;
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "sync_verification_state") {
      const nin = body.nin || null;
      const verificationIdIn = body.verificationId || null;
      const sessionIdIn = body.sessionId || null;

      if (!verificationIdIn && !nin && !sessionIdIn) {
        return new Response(JSON.stringify({ error: "verificationId, nin, or sessionId is required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const selectCols = "id, contract_status, contract_signed_at, contract_file_path";

      let row = null;
      if (verificationIdIn) {
        const { data } = await admin
          .from("bankid_verifications")
          .select(selectCols)
          .eq("id", verificationIdIn)
          .maybeSingle();
        row = data;
      }
      if (!row && nin) {
        const { data: rows } = await admin
          .from("bankid_verifications")
          .select(selectCols)
          .eq("nin", nin)
          .order("verified_at", { ascending: false })
          .limit(1);
        row = rows?.[0] ?? null;
      }
      if (!row && sessionIdIn) {
        const { data: rows } = await admin
          .from("bankid_verifications")
          .select(selectCols)
          .eq("session_id", sessionIdIn)
          .order("verified_at", { ascending: false })
          .limit(1);
        row = rows?.[0] ?? null;
      }

      return new Response(
        JSON.stringify({
          verificationId: row?.id ?? null,
          contractStatus: Boolean(row?.contract_status),
          contractSignedAt: row?.contract_signed_at ?? null,
          contractFilePath: row?.contract_file_path ?? null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const sessionId = body.sessionId || null;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const subjectId = body.subjectId || null;
    const nin = body.nin || null;
    const provider = body.provider || "nbid";
    const name = body.name || null;
    const birthDate = body.birthDate || null;
    const authLevel = body.authLevel || null;
    const nbidSid = body.nbidSid || null;
    const bankidAccessToken = body.bankidAccessToken || null;
    const raw = body.raw || null;
    const email = body.email || null;

    let customerId: string | null = null;
    if (email) {
      const { data: customer } = await admin
        .from("customers")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      customerId = customer?.id ?? null;
    }

    const basePayload = {
      customer_id: customerId,
      provider,
      subject_id: subjectId,
      nin,
      name,
      birth_date: birthDate,
      auth_level: authLevel,
      session_id: sessionId,
      nbid_sid: nbidSid,
      verified: true,
      verified_at: new Date().toISOString(),
      raw,
      bankid_access_token: bankidAccessToken,
    };

    let verificationId: string | null = null;
    const candidates: Array<{ column: string; value: string | null }> = [];
    if (nin) candidates.push({ column: "nin", value: nin });
    candidates.push({ column: "session_id", value: sessionId });
    if (nbidSid) candidates.push({ column: "nbid_sid", value: nbidSid });

    for (const candidate of candidates) {
      if (!candidate.value) continue;
      const { data: existing } = await admin
        .from("bankid_verifications")
        .select("id")
        .eq(candidate.column, candidate.value)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        verificationId = existing[0].id;
        await admin
          .from("bankid_verifications")
          .update(basePayload)
          .eq("id", verificationId);
        break;
      }
    }

    if (!verificationId) {
      const { data: inserted, error: insertError } = await admin
        .from("bankid_verifications")
        .insert(basePayload)
        .select("id")
        .single();
      if (insertError) {
        const code = insertError?.code ?? insertError?.details;
        const isUniqueViolation =
          code === "23505" ||
          String(insertError?.message ?? "").toLowerCase().includes("duplicate") ||
          String(insertError?.details ?? "").includes("23505");
        if (isUniqueViolation && nin) {
          const { data: rows } = await admin
            .from("bankid_verifications")
            .select("id")
            .eq("nin", nin)
            .limit(1);
          const existingId = rows?.[0]?.id ?? null;
          if (existingId) {
            verificationId = existingId;
            await admin.from("bankid_verifications").update(basePayload).eq("id", verificationId);
          } else {
            throw insertError;
          }
        } else {
          throw insertError;
        }
      } else {
        verificationId = inserted?.id ?? null;
      }
    }

    if (!verificationId) {
      throw new Error("Could not resolve bankid_verifications id.");
    }

    const { token, expiresAt } = await createJwtToken({
      verificationId,
      sessionId,
      subjectId,
      nin,
      provider,
    });

    const { error: jwtUpdateError } = await admin
      .from("bankid_verifications")
      .update({
        jwt_access_token: token,
        contract_end_at: expiresAt,
      })
      .eq("id", verificationId);
    if (jwtUpdateError) throw jwtUpdateError;

    const { data: contractRow } = await admin
      .from("bankid_verifications")
      .select("contract_status, contract_signed_at, contract_file_path")
      .eq("id", verificationId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        verificationId,
        jwtAccessToken: token,
        expiresAt,
        contractStatus: Boolean(contractRow?.contract_status),
        contractSignedAt: contractRow?.contract_signed_at ?? null,
        contractFilePath: contractRow?.contract_file_path ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
