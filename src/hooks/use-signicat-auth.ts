import { useCallback, useEffect, useState } from "react";
import {
  fetchSession,
  initiateLogin,
  LoginResponse,
  SessionResponse,
} from "@/api/signicat";

export const signicatKeys = {
  all: ["signicat"] as const,
  sessions: () => [...signicatKeys.all, "sessions"] as const,
  session: (sessionId: string) => [...signicatKeys.sessions(), sessionId] as const,
};

interface InitiateLoginState {
  mutate: () => Promise<void>;
  isPending: boolean;
}

export function useInitiateLogin(): InitiateLoginState {
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(async () => {
    setIsPending(true);
    try {
      const data: LoginResponse = await initiateLogin();
      if (data.sessionId) {
        localStorage.setItem("bankid_pending_session_id", data.sessionId);
      }
      if (data.authenticationUrl) {
        window.location.href = data.authenticationUrl;
      }
    } catch (error) {
      console.error("BankID login initiation error:", error);
      throw error;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { mutate, isPending };
}

interface SessionState {
  data: SessionResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSession(sessionId: string | null): SessionState {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const session = await fetchSession(sessionId);
      setData(session);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Ukjent feil"));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
