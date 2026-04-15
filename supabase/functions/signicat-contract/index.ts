// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const suffix = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SIGNICAT-CONTRACT] ${step}${suffix}`);
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

const isLocalhostOrigin = (origin: string | null): boolean => {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

async function readContractPdf(
  originHeader: string | null,
  contractFileUrl?: string
): Promise<ArrayBuffer> {
  const configuredPath = Deno.env.get("SIGNICAT_CONTRACT_FILE_PATH") || "files/contract.pdf";
  const candidatePaths = [
    configuredPath,
    `./${configuredPath}`,
    `../${configuredPath}`,
    `../../${configuredPath}`,
    "files/contract.pdf",
    "./files/contract.pdf",
    "../files/contract.pdf",
    "../../files/contract.pdf",
  ];

  for (const candidate of candidatePaths) {
    try {
      const file = await Deno.readFile(candidate);
      logStep("Loaded contract PDF from local path", { path: candidate, bytes: file.length });
      return file.buffer;
    } catch {
      // Try next candidate path.
    }
  }

  const configuredFileUrl = Deno.env.get("SIGNICAT_CONTRACT_FILE_URL");
  const candidateUrls = [
    configuredFileUrl,
    contractFileUrl,
    !isLocalhostOrigin(originHeader) && originHeader
      ? `${originHeader.replace(/\/$/, "")}/files/contract.pdf`
      : undefined,
  ].filter((value): value is string => Boolean(value && value.trim()));

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        logStep("HTTP PDF fetch failed", { url, status: response.status });
        continue;
      }
      const buffer = await response.arrayBuffer();
      logStep("Loaded contract PDF via HTTP", { url, bytes: buffer.byteLength });
      return buffer;
    } catch (error) {
      logStep("HTTP PDF fetch error", {
        url,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new Error(
    "Could not load contract PDF. In hosted Supabase, set SIGNICAT_CONTRACT_FILE_URL to a publicly reachable URL for files/contract.pdf."
  );
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
    const body = await req.json().catch(() => ({}));
    const baseUrl =
      Deno.env.get("SIGNICAT_CALLBACK_BASE_URL") ??
      req.headers.get("origin") ??
      "http://localhost:5173";

    const accessToken = await getAccessToken();
    const uploadUrl = Deno.env.get("SIGNICAT_UPLOAD_URL") || "https://api.signicat.com/sign/documents";
    const collectionUrl =
      Deno.env.get("SIGNICAT_COLLECTION_URL") || "https://api.signicat.com/sign/document-collections";
    const signSessionUrl =
      Deno.env.get("SIGNICAT_SIGN_SESSION_URL") || "https://api.signicat.com/sign/signing-sessions";

    const pdfBytes = await readContractPdf(
      req.headers.get("origin"),
      typeof body?.contractFileUrl === "string" ? body.contractFileUrl : undefined
    );

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        Authorization: `Bearer ${accessToken}`,
      },
      body: pdfBytes,
    });

    const uploadData = await uploadRes.json().catch(async () => ({ raw: await uploadRes.text() }));
    if (!uploadRes.ok) {
      logStep("Upload failed", uploadData);
      return new Response(JSON.stringify({ error: uploadData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const documentId = uploadData?.documentId;
    if (!documentId) {
      throw new Error("Signicat upload response missing documentId.");
    }

    const collectionRes = await fetch(collectionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        documents: [{ documentId }],
      }),
    });

    const collectionData = await collectionRes.json().catch(async () => ({ raw: await collectionRes.text() }));
    if (!collectionRes.ok) {
      logStep("Collection failed", collectionData);
      return new Response(JSON.stringify({ error: collectionData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const documentCollectionId = collectionData?.id;
    if (!documentCollectionId) {
      throw new Error("Signicat collection response missing id.");
    }

    const externalReference = crypto.randomUUID();
    const title = typeof body?.title === "string" && body.title.trim() ? body.title : "Contract Signing";

    const signSessionRes = await fetch(signSessionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify([
        {
          title,
          externalReference,
          documents: [
            {
              action: "SIGN",
              documentCollectionId,
              documentId,
            },
          ],
          signingSetup: [
            {
              identityProviders: [{ idpName: "nbid" }],
              signingFlow: "AUTHENTICATION_BASED",
            },
          ],
          packageTo: ["PADES_CONTAINER"],
          ui: {
            language: "en",
          },
          redirectSettings: {
            success: `${baseUrl}/?contractSign=success&externalReference=${externalReference}`,
            cancel: `${baseUrl}/?contractSign=cancel&externalReference=${externalReference}`,
            error: `${baseUrl}/?contractSign=error&externalReference=${externalReference}`,
          },
        },
      ]),
    });

    const signSessionData = await signSessionRes
      .json()
      .catch(async () => ({ raw: await signSessionRes.text() }));
    if (!signSessionRes.ok) {
      logStep("Signing session failed", signSessionData);
      return new Response(JSON.stringify({ error: signSessionData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const firstSession = Array.isArray(signSessionData) ? signSessionData[0] : signSessionData;
    const signatureUrl = firstSession?.signatureUrl;
    const sessionIdFromResponse = firstSession?.id ?? null;
    let sessionIdFromUrl: string | null = null;

    if (!signatureUrl) {
      throw new Error("Signicat signing session response missing signatureUrl.");
    }

    try {
      const parsed = new URL(signatureUrl);
      sessionIdFromUrl = parsed.searchParams.get("sessionId") ?? parsed.searchParams.get("session_id");
    } catch {
      // Keep fallback from response.
    }

    const sessionId = sessionIdFromUrl || sessionIdFromResponse;

    const responsePayload = {
      signatureUrl,
      signingUrl: signatureUrl,
      externalReference,
      documentId,
      documentCollectionId,
      sessionId,
      responses: {
        upload: uploadData,
        collection: collectionData,
        signingSession: signSessionData,
      },
      signingSessionData: firstSession,
      status: "pending",
      fileUrl: undefined,
    };

    logStep("Signing session created", {
      externalReference,
      documentId,
      documentCollectionId,
      sessionId,
    });

    return new Response(JSON.stringify(responsePayload), {
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
