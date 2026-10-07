import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const logStep = (step, details) => {
  console.log(`[UPLOAD-LICENSE] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");
    
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      throw new Error("No file provided");
    }

    logStep("File received", {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Validate file type and size
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Only JPEG, JPG, and PNG are allowed.");
    }
    
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File size too large. Maximum size is 5MB.");
    }

    // Create unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `uploads/license-${Date.now()}.${fileExt}`;
    
    logStep("Uploading to storage", { fileName });

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('driver-licenses')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) throw uploadError;

    logStep("File uploaded successfully", {
      path: uploadData.path
    });

    // Get public URL for the uploaded file
    const { data: urlData } = supabaseClient
      .storage
      .from('driver-licenses')
      .getPublicUrl(fileName);

    logStep("Public URL created");

    return new Response(
      JSON.stringify({
        success: true,
        filePath: fileName,
        publicUrl: urlData.publicUrl
      }), 
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in upload-license", {
      message: errorMessage
    });
    
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 500
      }
    );
  }
});