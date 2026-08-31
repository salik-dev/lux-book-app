import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OTP_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 30;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REQUEST-LOGIN-OTP] ${step}${detailsStr}`);
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

function generateOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(1000 + (buf[0] % 9000));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return json({ success: false, message: "A valid email address is required." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: existingRow, error: lookupError } = await supabaseAdmin
      .from("login_otps")
      .select("id, otp_last_sent_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existingRow?.otp_last_sent_at) {
      const secondsSinceLastSend = (Date.now() - new Date(existingRow.otp_last_sent_at).getTime()) / 1000;
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

    const { error: upsertError } = await supabaseAdmin
      .from("login_otps")
      .upsert(
        {
          email: normalizedEmail,
          otp_code_hash: otpHash,
          otp_expires_at: expiresAt.toISOString(),
          otp_attempts: 0,
          otp_last_sent_at: now.toISOString(),
        },
        { onConflict: "email" }
      );

    if (upsertError) throw upsertError;

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
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af, #0ea5e9); padding: 32px 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Your Login Code</h1>
        </div>
        <div style="padding: 32px 24px; text-align: center;">
          <p style="color: #475569; margin: 0 0 24px 0;">Use this code to sign in:</p>
          <div style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #0f172a; margin: 0 0 24px 0;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: fromAddress,
      to: normalizedEmail,
      subject: "Your login code",
      html: htmlContent,
    });

    logStep("OTP sent", { email: normalizedEmail });

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return json({ success: false, message: "Something went wrong while sending the code. Please try again." }, 500);
  }
});
