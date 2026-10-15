/**
 * Minimal typed client for the Idura Signatures GraphQL API.
 * Docs: https://docs.idura.app/signatures/graphql/endpoints/
 *
 * Authentication is HTTP Basic with the application's client ID and secret, which
 * live only in edge-function secrets (IDURA_SIGNATURES_CLIENT_ID / _SECRET).
 */

const DEFAULT_ENDPOINT = "https://signatures.idura.app/v1/graphql";
const REQUEST_TIMEOUT_MS = 20_000;

export type IduraErrorCode =
  | "IDURA_NOT_CONFIGURED"
  | "IDURA_AUTH_FAILED"
  | "IDURA_TIMEOUT"
  | "IDURA_UNAVAILABLE"
  | "IDURA_REQUEST_REJECTED";

export class IduraError extends Error {
  constructor(
    readonly code: IduraErrorCode,
    /** Provider detail for server logs only. Never return this to the browser. */
    readonly logDetail?: string,
  ) {
    super(code);
    this.name = "IduraError";
  }
}

export type SignatureOrderStatus = "OPEN" | "CLOSED" | "CANCELLED" | "EXPIRED";
export type SignatoryStatus = "OPEN" | "SIGNED" | "REJECTED" | "ERROR" | "DELETED" | "APPROVED";

export interface IduraSignatory {
  id: string;
  reference: string | null;
  status: SignatoryStatus;
  href: string;
}

export interface IduraSignatureOrder {
  id: string;
  status: SignatureOrderStatus;
  expiresAt: string | null;
  closedAt: string | null;
  signatories: IduraSignatory[];
  documents: Array<{ id: string; reference: string | null }>;
}

export interface IduraSignedDocument {
  id: string;
  /** Base64-encoded signed PDF. */
  blob: string | null;
}

export interface CreateSignatureOrderInput {
  title: string;
  expiresAt: string;
  timezone: string;
  maxSignatories: number;
  ui: { language: "EN_US" | "NB_NO"; signatoryRedirectUri: string; enableCancel: boolean };
  documents: Array<{
    pdf: { title: string; blob: string; storageMode: "Temporary"; reference: string };
  }>;
  signatories: Array<{
    reference: string;
    signingAs: string;
    signingSequence: number;
    ui?: { signatoryRedirectUri: string };
  }>;
  webhook: { url: string; secret: string; validateConnectivity: boolean };
}

const ORDER_FIELDS = `
  id
  status
  expiresAt
  closedAt
  signatories { id reference status href }
  documents { id reference }
`;

interface Credentials {
  endpoint: string;
  authorization: string;
}

function readCredentials(): Credentials {
  const clientId = Deno.env.get("IDURA_SIGNATURES_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("IDURA_SIGNATURES_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) throw new IduraError("IDURA_NOT_CONFIGURED");
  const endpoint = Deno.env.get("IDURA_SIGNATURES_ENDPOINT")?.trim() || DEFAULT_ENDPOINT;
  const raw = new TextEncoder().encode(`${clientId}:${clientSecret}`);
  return { endpoint, authorization: `Basic ${btoa(String.fromCharCode(...raw))}` };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
}

export class IduraSignaturesClient {
  private readonly credentials: Credentials;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {
    this.credentials = readCredentials();
  }

  /**
   * Executes a GraphQL operation. Only read operations are retried; mutations are
   * sent once so a timeout can never create a second signature order.
   */
  private async request<T>(query: string, variables: Record<string, unknown>, opts: { retry: boolean }): Promise<T> {
    const attempts = opts.retry ? 3 : 1;
    let lastError: IduraError = new IduraError("IDURA_UNAVAILABLE");

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.send<T>(query, variables);
      } catch (error) {
        lastError = error instanceof IduraError ? error : new IduraError("IDURA_UNAVAILABLE", String(error));
        const retryable = lastError.code === "IDURA_TIMEOUT" || lastError.code === "IDURA_UNAVAILABLE";
        if (!retryable || attempt === attempts) break;
        await sleep(250 * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  }

  private async send<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.credentials.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: this.credentials.authorization,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      throw new IduraError(name === "TimeoutError" || name === "AbortError" ? "IDURA_TIMEOUT" : "IDURA_UNAVAILABLE", name);
    }

    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      throw new IduraError("IDURA_AUTH_FAILED", `HTTP ${response.status}`);
    }
    if (response.status >= 500 || response.status === 429) {
      await response.body?.cancel();
      throw new IduraError("IDURA_UNAVAILABLE", `HTTP ${response.status}`);
    }

    let payload: GraphQLResponse<T>;
    try {
      payload = await response.json();
    } catch {
      throw new IduraError("IDURA_UNAVAILABLE", `HTTP ${response.status} non-JSON`);
    }

    if (payload.errors?.length) {
      const first = payload.errors[0];
      const code = first.extensions?.code ?? "";
      const message = (first.message ?? "").slice(0, 200);
      if (/UNAUTHENTICATED|FORBIDDEN/i.test(code)) throw new IduraError("IDURA_AUTH_FAILED", message);
      throw new IduraError("IDURA_REQUEST_REJECTED", `${code} ${message}`.trim());
    }
    if (!response.ok || !payload.data) {
      throw new IduraError("IDURA_REQUEST_REJECTED", `HTTP ${response.status}`);
    }
    return payload.data;
  }

  async createSignatureOrder(input: CreateSignatureOrderInput): Promise<IduraSignatureOrder> {
    const data = await this.request<{ createSignatureOrder: { signatureOrder: IduraSignatureOrder } }>(
      `mutation createSignatureOrder($input: CreateSignatureOrderInput!) {
        createSignatureOrder(input: $input) { signatureOrder { ${ORDER_FIELDS} } }
      }`,
      { input },
      { retry: false },
    );
    return data.createSignatureOrder.signatureOrder;
  }

  async getSignatureOrder(id: string): Promise<IduraSignatureOrder | null> {
    const data = await this.request<{ signatureOrder: IduraSignatureOrder | null }>(
      `query signatureOrder($id: ID!) { signatureOrder(id: $id) { ${ORDER_FIELDS} } }`,
      { id },
      { retry: true },
    );
    return data.signatureOrder;
  }

  /** Signed documents of an order closed with retained documents. */
  async getSignedDocuments(id: string): Promise<IduraSignedDocument[]> {
    const data = await this.request<{ signatureOrder: { documents: IduraSignedDocument[] } | null }>(
      `query signedDocuments($id: ID!) { signatureOrder(id: $id) { documents { id blob } } }`,
      { id },
      { retry: true },
    );
    return data.signatureOrder?.documents ?? [];
  }

  /**
   * Closes the order and returns the signed PDFs. Documents are retained for a few
   * days so a failed upload on our side can be retried via getSignedDocuments.
   */
  async closeSignatureOrder(id: string): Promise<IduraSignedDocument[]> {
    const data = await this.request<{ closeSignatureOrder: { signatureOrder: { documents: IduraSignedDocument[] } } }>(
      `mutation closeSignatureOrder($input: CloseSignatureOrderInput!) {
        closeSignatureOrder(input: $input) { signatureOrder { documents { id blob } } }
      }`,
      { input: { signatureOrderId: id, retainDocumentsForDays: 7 } },
      { retry: false },
    );
    return data.closeSignatureOrder.signatureOrder.documents;
  }

  /** Deletes retained documents once we have stored them. */
  async cleanupSignatureOrder(id: string): Promise<void> {
    await this.request(
      `mutation cleanupSignatureOrder($input: CleanupSignatureOrderInput!) {
        cleanupSignatureOrder(input: $input) { signatureOrder { id } }
      }`,
      { input: { signatureOrderId: id } },
      { retry: false },
    );
  }

  async cancelSignatureOrder(id: string): Promise<void> {
    await this.request(
      `mutation cancelSignatureOrder($input: CancelSignatureOrderInput!) {
        cancelSignatureOrder(input: $input) { signatureOrder { id } }
      }`,
      { input: { signatureOrderId: id } },
      { retry: false },
    );
  }
}
