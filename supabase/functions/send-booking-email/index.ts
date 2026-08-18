import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-BOOKING-EMAIL] ${step}${detailsStr}`);
};

const parseBool = (value: string | undefined): boolean | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const smtpHost = Deno.env.get("SMTP_HOST")?.trim();
    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    const smtpPass = Deno.env.get("SMTP_PASS")?.trim();
    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS must be set for Nodemailer");
    }

    const {
      bookingId,
      emailType,
      language = 'en',
      checkoutUrl,
      adminNotes,
      adminFullName,
    } = await req.json();
    logStep("Request received", { bookingId, emailType, language });

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        car:cars(*),
        customer:customers(*),
        payment:payments(*)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;
    logStep("Retrieved booking details", { bookingNumber: booking.booking_number });

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('no-NO', {
        style: 'currency',
        currency: 'NOK',
        minimumFractionDigits: 0,
      }).format(price);
    };

    const formatDateTime = (dateTime: string) => {
      return new Date(dateTime).toLocaleString(language === 'no' ? 'no-NO' : 'en-US', {
        timeZone: 'Europe/Oslo',
        dateStyle: 'full',
        timeStyle: 'short',
      });
    };

    let subject, htmlContent;

    if (emailType === 'confirmation') {
      subject = language === 'no' 
        ? `Bestilling bekreftet - ${booking.booking_number}`
        : `Booking Confirmed - ${booking.booking_number}`;

      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e40af, #0ea5e9); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🏔️ Bookings</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">
              ${language === 'no' ? 'Luksus bilutleie i Norge' : 'Luxury Car Rental in Norway'}
            </p>
          </div>
          
          <div style="padding: 40px 20px;">
            <h2 style="color: #1e40af; margin-bottom: 20px;">
              ${language === 'no' ? '🎉 Din bestilling er bekreftet!' : '🎉 Your booking is confirmed!'}
            </h2>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="margin-top: 0; color: #334155;">${language === 'no' ? 'Bestillingsdetaljer' : 'Booking Details'}</h3>
              <p><strong>${language === 'no' ? 'Bestillingsnummer' : 'Booking Number'}:</strong> ${booking.booking_number}</p>
              <p><strong>${language === 'no' ? 'Bil' : 'Vehicle'}:</strong> ${booking.car.name}</p>
              <p><strong>${language === 'no' ? 'Henting' : 'Pickup'}:</strong> ${formatDateTime(booking.start_datetime)}</p>
              <p><strong>${language === 'no' ? 'Retur' : 'Return'}:</strong> ${formatDateTime(booking.end_datetime)}</p>
              <p><strong>${language === 'no' ? 'Hentested' : 'Pickup Location'}:</strong> ${booking.pickup_location}</p>
              ${booking.delivery_location ? `<p><strong>${language === 'no' ? 'Leveringssted' : 'Delivery Location'}:</strong> ${booking.delivery_location}</p>` : ''}
              <p><strong>${language === 'no' ? 'Total pris' : 'Total Price'}:</strong> ${formatPrice(booking.total_price)}</p>
            </div>
          </div>
          
        </div>
      `;
    } else if (emailType === 'admin_invoice') {
      // Invoice-style email for admin-initiated bookings. Includes a direct
      // Stripe Checkout link so the customer can pay immediately.
      const isNo = language === 'no';
      subject = isNo
        ? `Faktura for din bilutleie - ${booking.booking_number}`
        : `Invoice for your car rental - ${booking.booking_number}`;

      const durationHours = Math.max(
        1,
        Math.round(
          (new Date(booking.end_datetime).getTime() - new Date(booking.start_datetime).getTime()) /
            (1000 * 60 * 60)
        )
      );

      const lineRow = (label: string, amount: number) => `
        <tr>
          <td style="padding: 10px 0; color:#334155;">${label}</td>
          <td style="padding: 10px 0; text-align:right; color:#334155;">${formatPrice(amount)}</td>
        </tr>`;

      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af, #0ea5e9); padding: 32px 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 26px;">Prime Car Rental</h1>
            <p style="color: white; margin: 8px 0 0 0; opacity: 0.9; font-size:14px;">
              ${isNo ? 'Luksus bilutleie i Norge' : 'Luxury Car Rental in Norway'}
            </p>
          </div>

          <div style="padding: 32px 24px;">
            <h2 style="color: #1e40af; margin: 0 0 8px 0;">
              ${isNo ? 'Din bestilling er klar for betaling' : 'Your booking is ready for payment'}
            </h2>
            <p style="color:#475569; margin: 0 0 24px 0; line-height:1.5;">
              ${
                isNo
                  ? `Hei ${booking.customer.full_name}, ${
                      adminFullName ? `${adminFullName} ved Prime Car Rental` : 'vårt team'
                    } har opprettet en bestilling på dine vegne. Fullfør betalingen nedenfor for å bekrefte bestillingen.`
                  : `Hi ${booking.customer.full_name}, ${
                      adminFullName ? `${adminFullName} at Prime Car Rental` : 'our team'
                    } has created a booking on your behalf. Complete the payment below to confirm your reservation.`
              }
            </p>

            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px 0; color: #0f172a;">
                ${isNo ? 'Bestillingsdetaljer' : 'Booking Details'}
              </h3>
              <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <tbody>
                  <tr><td style="padding:4px 0; color:#64748b;">${isNo ? 'Bestillingsnr.' : 'Booking #'}</td>
                      <td style="padding:4px 0; text-align:right; font-weight:600;">${booking.booking_number}</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">${isNo ? 'Bil' : 'Vehicle'}</td>
                      <td style="padding:4px 0; text-align:right;">${booking.car.name}</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">${isNo ? 'Henting' : 'Pickup'}</td>
                      <td style="padding:4px 0; text-align:right;">${formatDateTime(booking.start_datetime)}</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">${isNo ? 'Retur' : 'Return'}</td>
                      <td style="padding:4px 0; text-align:right;">${formatDateTime(booking.end_datetime)}</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">${isNo ? 'Varighet' : 'Duration'}</td>
                      <td style="padding:4px 0; text-align:right;">${durationHours} h</td></tr>
                  <tr><td style="padding:4px 0; color:#64748b;">${isNo ? 'Hentested' : 'Pickup location'}</td>
                      <td style="padding:4px 0; text-align:right;">${booking.pickup_location}</td></tr>
                  ${booking.delivery_location
                    ? `<tr><td style="padding:4px 0; color:#64748b;">${isNo ? 'Leveringssted' : 'Delivery location'}</td>
                           <td style="padding:4px 0; text-align:right;">${booking.delivery_location}</td></tr>`
                    : ''}
                </tbody>
              </table>
            </div>

            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px 0; color: #0f172a;">
                ${isNo ? 'Faktura' : 'Invoice'}
              </h3>
              <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <tbody>
                  ${lineRow(isNo ? 'Grunnpris' : 'Base price', Number(booking.base_price))}
                  <tr>
                    <td style="padding: 12px 0 0 0; border-top:1px solid #e2e8f0; font-weight:700; color:#0f172a;">
                      ${isNo ? 'Totalt å betale' : 'Total due'}
                    </td>
                    <td style="padding: 12px 0 0 0; border-top:1px solid #e2e8f0; text-align:right; font-weight:700; font-size:16px; color:#0f172a;">
                      ${formatPrice(Number(booking.total_price))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            ${checkoutUrl
              ? `<div style="text-align:center; margin: 8px 0 28px 0;">
                   <a href="${checkoutUrl}"
                      style="display:inline-block; background:#0ea5e9; color:#ffffff; text-decoration:none;
                             padding:14px 28px; border-radius:8px; font-weight:600; font-size:16px;">
                     ${isNo ? 'Betal nå' : 'Pay now'}
                   </a>
                   <p style="color:#64748b; font-size:12px; margin-top:10px;">
                     ${isNo
                       ? 'Sikker betaling med kort via Stripe. Lenken utløper innen 24 timer.'
                       : 'Secure card payment via Stripe. This link expires within 24 hours.'}
                   </p>
                 </div>`
              : ''}

            ${adminNotes
              ? `<div style="background:#fef3c7; border:1px solid #f59e0b; padding:16px; border-radius:8px; margin-bottom:24px;">
                   <p style="margin:0; color:#92400e; font-size:14px;"><strong>${isNo ? 'Melding fra Primecar' : 'Note from Primecar'}:</strong> ${adminNotes}</p>
                 </div>`
              : ''}
          </div>
        </div>
      `;
    } else if (emailType === 'reminder') {
      subject = language === 'no' 
        ? `Påminnelse: Din bilutleie starter i morgen - ${booking.booking_number}`
        : `Reminder: Your car rental starts tomorrow - ${booking.booking_number}`;

      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e40af, #0ea5e9); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🏔️ Prime Car Rental</h1>
          </div>
          
          <div style="padding: 40px 20px;">
            <h2 style="color: #1e40af;">
              ${language === 'no' ? '⏰ Påminnelse: Din utleie starter i morgen!' : '⏰ Reminder: Your rental starts tomorrow!'}
            </h2>
            
            <p>${language === 'no' 
              ? `Hei ${booking.customer.full_name}, dette er en vennlig påminnelse om at din bilutleie starter i morgen.`
              : `Hi ${booking.customer.full_name}, this is a friendly reminder that your car rental starts tomorrow.`}
            </p>

            <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #92400e;">
                ${language === 'no' ? 'Bestillingsdetaljer' : 'Booking Details'}
              </h3>
              <p><strong>${language === 'no' ? 'Bil' : 'Vehicle'}:</strong> ${booking.car.name}</p>
              <p><strong>${language === 'no' ? 'Henting' : 'Pickup'}:</strong> ${formatDateTime(booking.start_datetime)}</p>
              <p><strong>${language === 'no' ? 'Sted' : 'Location'}:</strong> ${booking.pickup_location}</p>
            </div>

            <p>
              ${language === 'no' 
                ? 'Vennligst ha med deg gyldig førerkort og vær på hentestedet 15 minutter før avtalt tid.'
                : 'Please bring your valid driving license and be at the pickup location 15 minutes before the scheduled time.'}
            </p>
          </div>
        </div>
      `;
    }

    // Optional BOOKING_EMAIL_TO_OVERRIDE (e.g. balisaalik@gmail.com) for testing; otherwise
    // uses the customer email from the booking.
    const recipientOverride = Deno.env.get("BOOKING_EMAIL_TO_OVERRIDE")?.trim();
    const customerEmail = booking.customer?.email?.trim();
    // const customerEmail = "balisaalik@gmail.com";
    const toEmail = customerEmail;
    if (!toEmail) {
      throw new Error("No recipient: customer has no email and BOOKING_EMAIL_TO_OVERRIDE is not set");
    }
    if (recipientOverride && customerEmail && recipientOverride !== customerEmail) {
      logStep("Recipient override active", { actualCustomerEmail: customerEmail, sendingTo: toEmail });
    }

    // const fromAddress =
    //   Deno.env.get("BOOKING_SMTP_FROM")?.trim() ??
    //   Deno.env.get("SMTP_FROM")?.trim() ??
    //   smtpUser;
    const fromAddress = "dev.bahadurali@gmail.com";

    const smtpPort = Number(Deno.env.get("SMTP_PORT")?.trim() || "587");
    const envSecure = parseBool(Deno.env.get("SMTP_SECURE"));
    const primarySecure = envSecure ?? smtpPort === 465;
    const secureModes = envSecure === null ? [primarySecure, !primarySecure] : [primarySecure];

    let lastError: unknown = null;
    let sentInfo: { messageId?: string } | null = null;

    for (const secureMode of secureModes) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: secureMode,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        requireTLS: !secureMode,
        tls: { servername: smtpHost },
      });

      try {
        logStep("Attempting SMTP send", {
          host: smtpHost,
          port: smtpPort,
          secure: secureMode,
          toEmail,
          fromAddress,
        });
        sentInfo = await transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          subject: subject!,
          html: htmlContent!,
        });
        break;
      } catch (err) {
        lastError = err;
        const errMessage = err instanceof Error ? err.message : String(err);
        logStep("SMTP send attempt failed", {
          host: smtpHost,
          port: smtpPort,
          secure: secureMode,
          message: errMessage,
        });
      }
    }

    if (!sentInfo) {
      throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "smtp_send_failed"));
    }

    logStep("Email sent successfully", { messageId: sentInfo.messageId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in send-booking-email", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});