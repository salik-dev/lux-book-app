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

export function extractUserData(session: SessionResponse): UserData | null {
  if (!session.subject?.attributes) {
    return null;
  }

  const attributes = session.subject.attributes;
  return {
    firstName: attributes.firstName?.[0]?.value,
    lastName: attributes.lastName?.[0]?.value,
    dateOfBirth: attributes.dateOfBirth?.[0]?.value,
    email: attributes.email?.[0]?.value,
    phoneNumber: attributes.phoneNumber?.[0]?.value,
    address: attributes.address?.[0]?.value,
    gender: attributes.gender?.[0]?.value,
    nin: attributes.nin?.[0]?.value,
    ssn: attributes.ssn?.[0]?.value,
  };
}
