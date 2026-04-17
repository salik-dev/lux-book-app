// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    await cleanupExpiredTokens(admin);

    const body = await req.json().catch(() => ({}));
    const verificationId = body.verificationId || null;
    const sessionId = body.sessionId || null;
    const nbidSid = body.nbidSid || null;
    const nin = body.nin || null;
    const provider = body.provider || "nbid";
    const name = body.name || null;
    const birthDate = body.birthDate || null;
    const contractStatus = Boolean(body.contractStatus);
    const contractSignedAt = contractStatus
      ? body.contractSignedAt || new Date().toISOString()
      : body.contractSignedAt ?? null;
    const contractFilePath = body.contractFilePath ?? null;

    const payload = {
      provider,
      session_id: sessionId,
      nbid_sid: nbidSid,
      nin,
      name,
      birth_date: birthDate,
      contract_status: contractStatus,
      contract_signed_at: contractSignedAt,
      contract_file_path: contractFilePath,
    };

    const candidates: Array<{ column: string; value: string | null }> = [
      { column: "id", value: verificationId },
      { column: "session_id", value: sessionId },
      { column: "nbid_sid", value: nbidSid },
      { column: "nin", value: nin },
    ];

    for (const candidate of candidates) {
      if (!candidate.value) continue;
      const { data: existing } = await admin
        .from("bankid_verifications")
        .select("id")
        .eq(candidate.column, candidate.value)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const rowId = existing[0].id;
        const { error: updateError } = await admin
          .from("bankid_verifications")
          .update(payload)
          .eq("id", rowId);
        if (updateError) throw updateError;

        return new Response(JSON.stringify({ ok: true, verificationId: rowId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const { data: inserted, error: insertError } = await admin
      .from("bankid_verifications")
      .insert({
        ...payload,
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ ok: true, verificationId: inserted?.id ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
