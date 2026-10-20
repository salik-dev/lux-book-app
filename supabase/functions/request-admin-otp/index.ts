import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OTP_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;
const OTP_DIGITS = "0123456789";
const OTP_LETTERS = "abcdefghijklmnopqrstuvwxyz";
const OTP_ALPHABET = OTP_LETTERS + OTP_DIGITS;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REQUEST-ADMIN-OTP] ${step}${detailsStr}`);
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

/** Unbiased secure index in [0, max) via rejection sampling. */
function secureIndex(max: number): number {
  const maxUnbiased = 256 - (256 % max);
  const buf = new Uint8Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < maxUnbiased) return buf[0] % max;
  }
}

function randomChar(alphabet: string): string {
  return alphabet[secureIndex(alphabet.length)];
}

/**
 * Cryptographically secure 6-char code that ALWAYS contains at least one digit
 * and at least one lowercase letter. We seed one of each, fill the rest from the
 * full alphabet, then securely shuffle so the guaranteed chars aren't positional.
 */
function generateOtp(): string {
  const chars: string[] = [randomChar(OTP_DIGITS), randomChar(OTP_LETTERS)];
  while (chars.length < OTP_LENGTH) {
    chars.push(randomChar(OTP_ALPHABET));
  }
  // Fisher–Yates shuffle with secure randomness.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return json({ success: false, reason: "invalid_request", message: "A valid email address is required." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: adminUser, error: lookupError } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, is_active, otp_last_sent_at")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) throw lookupError;

    // Not a registered (active) admin -> friendly, non-enumerating message.
    if (!adminUser || !adminUser.is_active) {
      return json({
        success: false,
        reason: "not_found",
        message: "We couldn't find an admin account for this email. Please contact your administrator.",
      });
    }

    if (adminUser.otp_last_sent_at) {
      const secondsSinceLastSend = (Date.now() - new Date(adminUser.otp_last_sent_at).getTime()) / 1000;
      if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
        const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLastSend);
        return json({
          success: false,
          reason: "cooldown",
          waitSeconds,
          message: `Please wait ${waitSeconds}s before requesting another code.`,
        });
      }
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

    const { error: updateError } = await supabaseAdmin
      .from("admin_users")
      .update({
        otp_code_hash: otpHash,
        otp_expires_at: expiresAt.toISOString(),
        otp_attempts: 0,
        otp_last_sent_at: now.toISOString(),
      })
      .eq("id", adminUser.id);

    if (updateError) throw updateError;

    const smtpHost = Deno.env.get("SMTP_HOST")?.trim();
    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    const smtpPass = Deno.env.get("SMTP_PASS")?.trim();
    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS must be set for Nodemailer");
    }
    const smtpPort = Number(Deno.env.get("SMTP_PORT")?.trim() || "587");
    const smtpSecure = smtpPort === 465;
    const fromAddress = Deno.env.get("ADMIN_OTP_EMAIL_FROM")?.trim() || smtpUser;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      requireTLS: !smtpSecure,
      tls: { servername: smtpHost },
    });

    const htmlContent = `
      <div style="margin:0; padding:40px 24px; background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#1f2937;">
        <div style="max-width:420px; margin:0 auto;">
          <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#111827;">Your sign-in code</p>
          <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#6b7280;">
            Use the code below to sign in to the Admin Portal. It expires in ${OTP_TTL_MINUTES} minutes.
          </p>
          <p style="margin:0 0 24px; font-size:32px; font-weight:700; letter-spacing:8px; color:#111827; font-family:'SF Mono',Menlo,Consolas,monospace;">
            ${otp}
          </p>
          <p style="margin:0; font-size:13px; line-height:1.6; color:#9ca3af;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: fromAddress,
      to: adminUser.email,
      subject: "Your admin sign-in code",
      html: htmlContent,
    });

    logStep("OTP sent", { email: adminUser.email });

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return json({ success: false, reason: "server_error", message: "Something went wrong while sending the code. Please try again." }, 500);
  }
});
