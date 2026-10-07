// contact-us.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// 🔐 Environment Variables
const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT")) || 465;
const SMTP_USER = Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASS");
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: {
    persistSession: false
  }
});
// 🟢 Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: true,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405
    });
  }
  try {
    const { name, email, message } = await req.json();
    if (!name || !email || !message) {
      return new Response(JSON.stringify({
        error: "All fields are required."
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    // ✅ Optionally store contact request in Supabase
    await supabase.from("contact_requests").insert([
      {
        name,
        email,
        message
      }
    ]);
    // ✅ Prepare email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #1e40af;">📩 New Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p style="background: #f3f4f6; padding: 12px; border-radius: 6px;">${message}</p>
        <hr />
        <p style="font-size: 12px; color: #6b7280;">© 2025 PrimeCars — Contact Form Notification</p>
      </div>
    `;
    // ✅ Send email to admin (Daniel)
    await transporter.sendMail({
      from: `"PrimeCars Contact Form" <${SMTP_USER}>`,
      // to: "danielr@live.no",
      to: 'official.salikzero@gmail.com',
      subject: `📬 New Contact Message from ${name}`,
      html: htmlContent
    });
    console.log(`✅ Contact email sent successfully from ${email}`);
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (err) {
    console.error("❌ Error in contact-us function:", err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      headers: corsHeaders,
      status: 500
    });
  }
});
