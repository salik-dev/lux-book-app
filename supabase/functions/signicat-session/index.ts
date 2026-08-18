import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const suffix = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SIGNICAT-SESSION] ${step}${suffix}`);
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

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error_description ?? "Failed to fetch Signicat token.");
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
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const token = await getAccessToken();
    const sessionBaseUrl = Deno.env.get("SIGNICAT_SESSION_URL");
    if (!sessionBaseUrl) {
      throw new Error("SIGNICAT_SESSION_URL is not set.");
    }

    const url = `${sessionBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(sessionId)}`;
    logStep("Fetching session", { url, sessionId });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const data = await response.json();
    if (!response.ok) {
      logStep("Session fetch failed", { status: response.status, data });
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: response.status,
      });
    }

    return new Response(JSON.stringify({ ...data, access_token: token }), {
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
