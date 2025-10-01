import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-CAR-IMAGES] ${step}${detailsStr}`);
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

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY is not set");

    const { carId, carName, brand, model, year } = await req.json();
    logStep("Request received", { carId, carName });

    // Create a detailed prompt for luxury car image generation
    const prompt = `A stunning professional photograph of a ${year} ${brand} ${model} luxury car in pristine condition. The car is positioned at a 3/4 front angle on a clean studio background with professional automotive lighting. The vehicle should showcase its premium design, elegant lines, and luxury features. High-resolution, commercial photography quality, with perfect reflections and shadows. The car should appear in its most attractive color scheme for a luxury rental service. Ultra-realistic, 8K quality, automotive magazine style photography.`;

    logStep("Generated prompt", { prompt });

    // Generate image using OpenAI
    const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: "1536x1024",
        quality: "high",
        output_format: "webp",
        output_compression: 90,
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      throw new Error(`OpenAI API error: ${imageResponse.status} - ${errorText}`);
    }

    const imageData = await imageResponse.json();
    logStep("Image generated successfully");

    if (!imageData.data || imageData.data.length === 0) {
      throw new Error("No image data received from OpenAI");
    }

    // Since gpt-image-1 returns base64, we need to decode and upload to Supabase storage
    const base64Image = imageData.data[0].b64_json;
    const imageBuffer = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

    // Upload to Supabase storage
    const fileName = `${carId}-${Date.now()}.webp`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('car-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) throw uploadError;
    logStep("Image uploaded to storage", { fileName });

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('car-images')
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;
    logStep("Generated public URL", { imageUrl });

    // Update car record with image URL
    const { error: updateError } = await supabaseClient
      .from('cars')
      .update({ image_url: imageUrl })
      .eq('id', carId);

    if (updateError) throw updateError;
    logStep("Car record updated with image URL");

    return new Response(JSON.stringify({ 
      success: true, 
      imageUrl,
      fileName 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in generate-car-images", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});