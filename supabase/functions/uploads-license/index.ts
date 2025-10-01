import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[UPLOAD-LICENSE] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file provided");

    logStep("File received", { 
      name: file.name, 
      size: file.size, 
      type: file.type 
    });

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Only JPEG, JPG, and PNG are allowed.");
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      throw new Error("File size too large. Maximum size is 5MB.");
    }

    // Create unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/license-${Date.now()}.${fileExt}`;

    logStep("Uploading to storage", { fileName });

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('driver-licenses')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;
    logStep("File uploaded successfully", { path: uploadData.path });

    // Get signed URL for secure access
    const { data: urlData, error: urlError } = await supabaseClient.storage
      .from('driver-licenses')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // Valid for 7 days

    if (urlError) throw urlError;
    logStep("Signed URL created");

    return new Response(JSON.stringify({ 
      success: true, 
      filePath: fileName,
      signedUrl: urlData.signedUrl
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in upload-license", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});