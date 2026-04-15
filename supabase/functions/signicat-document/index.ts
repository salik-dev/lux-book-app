// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isHttpUrl = (value: unknown): value is string =>
  typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://"));

const findSignedResource = (
  value: unknown
): { signedUrl?: string; signedDocumentId?: string } => {
  const result: { signedUrl?: string; signedDocumentId?: string } = {};

  const visit = (node: unknown) => {
    if (!node || (result.signedUrl && result.signedDocumentId)) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (typeof node !== "object") return;

    const obj = node as Record<string, unknown>;

    const signedUrlKeys = [
      "signedDocumentUrl",
      "downloadUrl",
      "documentUrl",
      "padesUrl",
      "containerUrl",
      "fileUrl",
    ];
    const signedIdKeys = [
      "signedDocumentId",
      "resultDocumentId",
      "outputDocumentId",
      "documentId",
      "id",
    ];

    for (const key of signedUrlKeys) {
      const value = obj[key];
      if (isHttpUrl(value) && /sign|signed|pades|download|document/i.test(key)) {
        result.signedUrl = value;
        break;
      }
    }

    for (const key of signedIdKeys) {
      const value = obj[key];
      if (typeof value === "string" && value.trim().length > 0 && /document|signed|result|output/i.test(key)) {
        result.signedDocumentId = value;
        break;
      }
    }

    for (const [key, nested] of Object.entries(obj)) {
      if (key.toLowerCase().includes("status")) {
        const statusValue = typeof nested === "string" ? nested.toLowerCase() : "";
        if (statusValue && !["signed", "completed", "complete", "success", "approved"].includes(statusValue)) {
          // Continue traversal; there may still be nested resource pointers.
        }
      }
      visit(nested);
    }
  };

  visit(value);
  return result;
};

async function getAccessToken(): Promise<string> {
  const tokenUrl = Deno.env.get("SIGNICAT_TOKEN_URL");
  const clientId = Deno.env.get("SIGNICAT_CLIENT_ID");
  const clientSecret = Deno.env.get("SIGNICAT_CLIENT_SECRET");

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error("Missing Signicat token env configuration.");
  }

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "signicat-api",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(await tokenRes.text());
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId");
    const sessionId = url.searchParams.get("sessionId");
    const fileType = url.searchParams.get("type") || "pdf";

    if (!documentId && !sessionId) {
      return new Response(JSON.stringify({ error: "documentId or sessionId missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const token = await getAccessToken();

    let signedUrl: string | undefined;
    let signedDocumentId: string | undefined;

    if (sessionId) {
      const sessionRes = await fetch(
        `https://api.signicat.com/sign/signing-sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json().catch(() => null);
        const extracted = findSignedResource(sessionData);
        signedUrl = extracted.signedUrl;
        if (extracted.signedDocumentId && extracted.signedDocumentId !== sessionId) {
          signedDocumentId = extracted.signedDocumentId;
        }
      }
    }

    if (!signedDocumentId && documentId) {
      signedDocumentId = documentId;
    }

    let documentRes: Response;
    if (signedUrl) {
      documentRes = await fetch(signedUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } else {
      documentRes = await fetch(
        `https://api.signicat.com/sign/documents/${encodeURIComponent(signedDocumentId || "")}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }

    if (!documentRes.ok) {
      const errorText = await documentRes.text();
      return new Response(JSON.stringify({ error: errorText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: documentRes.status,
      });
    }

    const contentType =
      documentRes.headers.get("content-type") ||
      (fileType === "xml" ? "application/xml" : "application/pdf");
    const filename = fileType === "xml" ? "signature-result.xml" : "signed.pdf";
    const disposition = fileType === "xml" ? "attachment" : "inline";

    return new Response(await documentRes.arrayBuffer(), {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message || "failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
