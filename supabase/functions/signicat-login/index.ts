import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const suffix = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SIGNICAT-LOGIN] ${step}${suffix}`);
};

async function getAccessToken() {
  const tokenUrl = Deno.env.get("SIGNICAT_TOKEN_URL");
  const clientId = Deno.env.get("SIGNICAT_CLIENT_ID");
  const clientSecret = Deno.env.get("SIGNICAT_CLIENT_SECRET");

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error("Missing Signicat token env configuration.");
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "signicat-api",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const payload = await response
    .json()
    .catch(async () => ({ raw: await response.text() }));
  if (!response.ok) {
    logStep("Token request failed", payload);
    throw new Error(
      payload?.error_description ??
        payload?.error?.message ??
        payload?.raw ??
        "Failed to fetch Signicat token."
    );
  }

  if (!payload?.access_token) {
    throw new Error("Signicat access token missing in response.");
  }

  return payload.access_token as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    const token = await getAccessToken();

    const sessionUrl = Deno.env.get("SIGNICAT_SESSION_URL");
    if (!sessionUrl) {
      throw new Error("SIGNICAT_SESSION_URL is not set.");
    }

    const callbackBaseUrlRaw =
      Deno.env.get("SIGNICAT_CALLBACK_BASE_URL") ??
      req.headers.get("origin") ??
      "http://localhost:5173";
    const callbackBaseUrl = callbackBaseUrlRaw.replace(/\/$/, "");

    const sessionResponse = await fetch(sessionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        flow: "redirect",
        allowedProviders: ["nbid"],
        requestedAttributes: [
          "firstName",
          "lastName",
          "email",
          "dateOfBirth",
          "phoneNumber",
          "address",
          "gender",
          "nin",
        ],
        callbackUrls: {
          success: `${callbackBaseUrl}/auth/success`,
          abort: `${callbackBaseUrl}/auth/abort`,
          error: `${callbackBaseUrl}/auth/error`,
        },
        language: "no",
      }),
    });

    const sessionData = await sessionResponse
      .json()
      .catch(async () => ({ raw: await sessionResponse.text() }));
    if (!sessionResponse.ok) {
      logStep("Session creation failed", sessionData);
      return new Response(JSON.stringify(sessionData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: sessionResponse.status,
      });
    }

    const authenticationUrl =
      sessionData.authenticationUrl ?? sessionData.url ?? sessionData.redirectUrl;
    if (!authenticationUrl) {
      throw new Error("No authentication URL received from Signicat.");
    }

    const response = {
      authenticationUrl,
      sessionId: sessionData.id ?? sessionData.sessionId ?? null,
    };

    logStep("Session created", response);
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
