// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const suffix = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SIGNICAT-CONTRACT-STATUS] ${step}${suffix}`);
};

const findFirstLikelyFileUrl = (value: unknown): string | undefined => {
  if (!value) return undefined;

  if (typeof value === "string") {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value;
    }
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findFirstLikelyFileUrl(item);
      if (result) return result;
    }
    return undefined;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const prioritizedKeys = [
      "signedDocumentUrl",
      "documentUrl",
      "downloadUrl",
      "signedPackageUrl",
      "padesUrl",
      "url",
    ];

    for (const key of prioritizedKeys) {
      const raw = obj[key];
      if (typeof raw === "string" && (raw.startsWith("http://") || raw.startsWith("https://"))) {
        return raw;
      }
    }

    for (const nestedValue of Object.values(obj)) {
      const result = findFirstLikelyFileUrl(nestedValue);
      if (result) return result;
    }
  }

  return undefined;
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

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { documentId } = await req.json();
    if (!documentId || typeof documentId !== "string") {
      return new Response(JSON.stringify({ error: "documentId is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const accessToken = await getAccessToken();
    const signSessionBaseUrl =
      Deno.env.get("SIGNICAT_SIGN_SESSION_URL") || "https://api.signicat.com/sign/signing-sessions";

    const sessionStatusUrl = `${signSessionBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(documentId)}`;
    logStep("Fetching session status", { sessionStatusUrl, sessionId: documentId });

    const sessionRes = await fetch(sessionStatusUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const sessionData = await sessionRes
      .json()
      .catch(async () => ({ raw: await sessionRes.text() }));

    if (!sessionRes.ok) {
      logStep("Session status fetch failed", { status: sessionRes.status, sessionData });
      return new Response(
        JSON.stringify({
          error: sessionData,
          documentId,
          status: "unknown",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: sessionRes.status,
        }
      );
    }

    const status =
      (typeof sessionData?.status === "string" && sessionData.status) ||
      (typeof sessionData?.state === "string" && sessionData.state) ||
      "pending";

    const signedAt =
      sessionData?.completedAt ??
      sessionData?.updatedAt ??
      sessionData?.lastUpdatedAt ??
      undefined;

    const fileUrl =
      sessionData?.signedDocumentUrl ??
      sessionData?.documentUrl ??
      sessionData?.downloadUrl ??
      findFirstLikelyFileUrl(sessionData);

    return new Response(
      JSON.stringify({
        documentId,
        status,
        signedAt,
        signedBy: undefined,
        fileUrl,
        raw: sessionData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
