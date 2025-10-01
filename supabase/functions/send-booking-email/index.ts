import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-BOOKING-EMAIL] ${step}${detailsStr}`);
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

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is not set");

    const { bookingId, emailType, language = 'en' } = await req.json();
    logStep("Request received", { bookingId, emailType, language });

    const resend = new Resend(resendKey);

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
            <h1 style="color: white; margin: 0; font-size: 28px;">🏔️ Fjord Fleet</h1>
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

            <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="margin-top: 0; color: #059669;">
                ${language === 'no' ? '📋 Neste steg' : '📋 Next Steps'}
              </h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>${language === 'no' ? 'Du vil motta en SMS bekrefelse kort tid' : 'You will receive an SMS confirmation shortly'}</li>
                <li>${language === 'no' ? 'Ha med deg gyldig førerkort ved henting' : 'Bring your valid driving license for pickup'}</li>
                <li>${language === 'no' ? 'Vårt team vil kontakte deg før henting' : 'Our team will contact you before pickup'}</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #64748b;">
                ${language === 'no' 
                  ? 'Har du spørsmål? Kontakt oss på support@fjordfleet.no eller +47 123 45 678' 
                  : 'Questions? Contact us at support@fjordfleet.no or +47 123 45 678'}
              </p>
            </div>
          </div>
          
          <div style="background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
            <p>© 2024 Fjord Fleet. ${language === 'no' ? 'Alle rettigheter reservert.' : 'All rights reserved.'}</p>
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
            <h1 style="color: white; margin: 0; font-size: 28px;">🏔️ Fjord Fleet</h1>
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

    const { error: emailError } = await resend.emails.send({
      from: 'Fjord Fleet <bookings@fjordfleet.no>',
      to: [booking.customer.email],
      subject: subject!,
      html: htmlContent!,
    });

    if (emailError) throw emailError;
    logStep("Email sent successfully");

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