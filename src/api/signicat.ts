import { supabase } from "@/integrations/supabase/client";

export interface LoginResponse {
  authenticationUrl: string;
  sessionId?: string;
}

export interface SessionResponse {
  id: string;
  status: string;
  access_token?: string;
  subject?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    email?: string;
    address?: string;
    gender?: string;
    nin?: { value?: string; issuingCountry?: string; type?: string } | string;
    ssn?: string;
    attributes?: {
      firstName?: Array<{ value: string }>;
      lastName?: Array<{ value: string }>;
      dateOfBirth?: Array<{ value: string }>;
      ssn?: Array<{ value: string }>;
      phoneNumber?: Array<{ value: string }>;
      address?: Array<{ value: string }>;
      gender?: Array<{ value: string }>;
      nin?: Array<{ value: string }>;
      email?: Array<{ value: string }>;
    };
  };
  error?: {
    code: string;
    message: string;
    title: string;
  };
}

export interface UserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  gender?: string;
  nin?: string;
  dateOfBirth?: string;
  ssn?: string;
}

export interface ContractSigningResponse {
  documentId: string;
  signingUrl: string;
  signatureUrl?: string;
  sessionId?: string;
  externalReference?: string;
  status: string;
  fileUrl?: string;
}

export interface ContractStatusResponse {
  documentId: string;
  status: string;
  signedAt?: string;
  signedBy?: string;
  fileUrl?: string;
}

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return fallback;
};

export async function initiateLogin(): Promise<LoginResponse> {
  const { data, error } = await supabase.functions.invoke("signicat-login", {
    body: {},
  });

  if (error) {
    throw new Error(toErrorMessage(error, "Kunne ikke starte BankID-innlogging."));
  }

  if (!data?.authenticationUrl) {
    throw new Error("Mangler autentiseringslenke fra Signicat.");
  }

  return data as LoginResponse;
}

export async function fetchSession(sessionId: string): Promise<SessionResponse> {
  if (!sessionId) {
    throw new Error("Session ID mangler.");
  }

  const { data, error } = await supabase.functions.invoke("signicat-session", {
    body: { sessionId },
  });

  if (error) {
    throw new Error(toErrorMessage(error, "Kunne ikke hente Signicat-session."));
  }

  return data as SessionResponse;
}

export async function createContractSigning(
  sessionId?: string,
  userEmail?: string
): Promise<ContractSigningResponse> {
  const accessToken =
    typeof window !== "undefined"
      ? localStorage.getItem("signicat_access_token")
      : null;

  const { data, error } = await supabase.functions.invoke("signicat-contract", {
    body: {
      sessionId: sessionId || undefined,
      userEmail: userEmail || undefined,
      accessToken: accessToken || undefined,
    },
  });

  if (error) {
    throw new Error(toErrorMessage(error, "Failed to create contract signing"));
  }

  const normalized = data as ContractSigningResponse;
  if (!normalized.signingUrl && normalized.signatureUrl) {
    normalized.signingUrl = normalized.signatureUrl;
  }

  return normalized;
}

export async function getContractStatus(
  documentId: string
): Promise<ContractStatusResponse> {
  if (!documentId) {
    throw new Error("Document ID is required");
  }

  const { data, error } = await supabase.functions.invoke("signicat-contract-status", {
    body: { documentId },
  });

  if (error) {
    throw new Error(toErrorMessage(error, "Failed to get contract status"));
  }

  return data as ContractStatusResponse;
}

export function getContractDocumentPreviewUrl(documentId: string, type: "pdf" | "xml" = "pdf"): string {
  if (!documentId) return "";
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const params = new URLSearchParams({
    documentId,
    type,
  });
  return `${baseUrl}/functions/v1/signicat-document?${params.toString()}`;
}

export function extractUserData(session: SessionResponse): UserData | null {
  const subject = session.subject;
  if (!subject) {
    return null;
  }

  const attributes = subject.attributes;
  const firstAttributeValue = (
    values?: Array<{ value: string }>
  ): string | undefined => values?.[0]?.value?.trim() || undefined;

  const clean = (value?: string | null): string | undefined => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };

  const subjectNin =
    typeof subject.nin === "string" ? subject.nin : subject.nin?.value;

  const userData: UserData = {
    firstName: firstAttributeValue(attributes?.firstName) ?? clean(subject.firstName),
    lastName: firstAttributeValue(attributes?.lastName) ?? clean(subject.lastName),
    dateOfBirth:
      firstAttributeValue(attributes?.dateOfBirth) ?? clean(subject.dateOfBirth),
    email: firstAttributeValue(attributes?.email) ?? clean(subject.email),
    phoneNumber:
      firstAttributeValue(attributes?.phoneNumber) ?? clean(subject.phoneNumber),
    address: firstAttributeValue(attributes?.address) ?? clean(subject.address),
    gender: firstAttributeValue(attributes?.gender) ?? clean(subject.gender),
    nin:
      firstAttributeValue(attributes?.nin) ??
      firstAttributeValue(attributes?.ssn) ??
      clean(subjectNin) ??
      clean(subject.ssn),
    ssn: firstAttributeValue(attributes?.ssn) ?? clean(subject.ssn),
  };

  if (!Object.values(userData).some(Boolean)) {
    return null;
  }

  return userData;
}
