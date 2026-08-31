import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VERIFY-LOGIN-OTP] ${step}${detailsStr}`);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hashOtp(otp: string): Promise<string> {
  const bytes = new TextEncoder().encode(otp);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedOtp = typeof otp === "string" ? otp.trim() : "";

    if (!normalizedEmail || !/^\d{4}$/.test(normalizedOtp)) {
      return json({ success: false, reason: "invalid_request", message: "Please enter the 4-digit code." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: otpRow, error: lookupError } = await supabaseAdmin
      .from("login_otps")
      .select("id, otp_code_hash, otp_expires_at, otp_attempts")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!otpRow || !otpRow.otp_code_hash || !otpRow.otp_expires_at) {
      return json({ success: false, reason: "no_pending_otp", message: "No code was requested. Please request a new one." });
    }

    if (new Date(otpRow.otp_expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("login_otps")
        .update({ otp_code_hash: null, otp_expires_at: null, otp_attempts: 0 })
        .eq("id", otpRow.id);
      return json({ success: false, reason: "expired", message: "This code has expired. Please request a new one." });
    }

    if (otpRow.otp_attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin
        .from("login_otps")
        .update({ otp_code_hash: null, otp_expires_at: null, otp_attempts: 0 })
        .eq("id", otpRow.id);
      return json({ success: false, reason: "too_many_attempts", message: "Too many incorrect attempts. Please request a new code." });
    }

    const submittedHash = await hashOtp(normalizedOtp);
    if (!timingSafeEqual(submittedHash, otpRow.otp_code_hash)) {
      const nextAttempts = otpRow.otp_attempts + 1;
      await supabaseAdmin
        .from("login_otps")
        .update({ otp_attempts: nextAttempts })
        .eq("id", otpRow.id);
      const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - nextAttempts);
      return json({
        success: false,
        reason: "invalid_code",
        message: attemptsRemaining > 0 ? `Incorrect code. ${attemptsRemaining} attempt(s) remaining.` : "Too many incorrect attempts. Please request a new code.",
        attemptsRemaining,
      });
    }

    await supabaseAdmin
      .from("login_otps")
      .update({ otp_code_hash: null, otp_expires_at: null, otp_attempts: 0 })
      .eq("id", otpRow.id);

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
    });

    if (linkError) throw linkError;

    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) {
      throw new Error("Failed to generate a sign-in token.");
    }

    logStep("OTP verified, session token issued", { email: normalizedEmail });

    return json({ success: true, tokenHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return json({ success: false, reason: "server_error", message: "Something went wrong. Please try again." }, 500);
  }
});
