import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const OTP_PATTERN = /^[a-z0-9]{6}$/;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ADMIN-VERIFY-OTP] ${step}${detailsStr}`);
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

/**
 * Returns a magiclink token for `email`, provisioning the auth user if it does
 * not exist yet (seeded super admin, or an admin that was just added and has
 * never signed in). Returns the hashed token + the resolved auth user id.
 */
// deno-lint-ignore no-explicit-any
async function ensureTokenForEmail(
  supabaseAdmin: any,
  email: string
): Promise<{ tokenHash: string; userId: string | null }> {
  const generate = () =>
    supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });

  let { data, error } = await generate();

  if (error) {
    // Most likely the auth user doesn't exist yet — create it (email pre-confirmed,
    // passwordless) then retry generating the sign-in token.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError && !/already|exists|registered/i.test(createError.message)) {
      throw createError;
    }
    ({ data, error } = await generate());
    if (error) throw error;
  }

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Failed to generate a sign-in token.");
  }
  return { tokenHash, userId: data?.user?.id ?? null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedOtp = typeof otp === "string" ? otp.trim().toLowerCase() : "";

    if (!normalizedEmail || !OTP_PATTERN.test(normalizedOtp)) {
      return json({ success: false, reason: "invalid_request", message: "Please enter the 6-character code." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: adminUser, error: lookupError } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, user_id, is_active, otp_code_hash, otp_expires_at, otp_attempts")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!adminUser || !adminUser.is_active) {
      return json({ success: false, reason: "not_found", message: "We couldn't find an admin account for this email." });
    }

    if (!adminUser.otp_code_hash || !adminUser.otp_expires_at) {
      return json({ success: false, reason: "no_pending_otp", message: "No code was requested. Please request a new one." });
    }

    if (new Date(adminUser.otp_expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("admin_users")
        .update({ otp_code_hash: null, otp_expires_at: null, otp_attempts: 0 })
        .eq("id", adminUser.id);
      return json({ success: false, reason: "expired", message: "This code has expired. Please request a new one." });
    }

    if (adminUser.otp_attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin
        .from("admin_users")
        .update({ otp_code_hash: null, otp_expires_at: null, otp_attempts: 0 })
        .eq("id", adminUser.id);
      return json({ success: false, reason: "too_many_attempts", message: "Too many incorrect attempts. Please request a new code." });
    }

    const submittedHash = await hashOtp(normalizedOtp);
    if (!timingSafeEqual(submittedHash, adminUser.otp_code_hash)) {
      const nextAttempts = adminUser.otp_attempts + 1;
      await supabaseAdmin
        .from("admin_users")
        .update({ otp_attempts: nextAttempts })
        .eq("id", adminUser.id);
      const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - nextAttempts);
      return json({
        success: false,
        reason: "invalid_code",
        message: attemptsRemaining > 0 ? `Incorrect code. ${attemptsRemaining} attempt(s) remaining.` : "Too many incorrect attempts. Please request a new code.",
        attemptsRemaining,
      });
    }

    // Correct code — clear it immediately so it can't be replayed.
    await supabaseAdmin
      .from("admin_users")
      .update({ otp_code_hash: null, otp_expires_at: null, otp_attempts: 0 })
      .eq("id", adminUser.id);

    const { tokenHash, userId } = await ensureTokenForEmail(supabaseAdmin, adminUser.email);

    // Link the auth user id on first sign-in so RLS (auth.uid()) resolves directly.
    if (userId && adminUser.user_id !== userId) {
      await supabaseAdmin
        .from("admin_users")
        .update({ user_id: userId })
        .eq("id", adminUser.id);
    }

    logStep("OTP verified, session token issued", { email: adminUser.email });

    return json({ success: true, tokenHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return json({ success: false, reason: "server_error", message: "Something went wrong. Please try again." }, 500);
  }
});
