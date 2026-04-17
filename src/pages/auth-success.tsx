import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useSession } from "@/hooks/use-signicat-auth";
import { extractUserData } from "@/api/signicat";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEYS = {
  verified: "bankid_verified",
  status: "bankid_auth_status",
  error: "bankid_auth_error",
  verifiedAt: "bankid_verified_at",
  sessionId: "bankid_session_id",
  pendingSessionId: "bankid_pending_session_id",
  accessToken: "signicat_access_token",
  userData: "signicat_user_data",
  jwtToken: "bankid_jwt_access_token",
  jwtExpiresAt: "bankid_jwt_expires_at",
  verificationRowId: "bankid_verification_row_id",
  contractStatus: "bankid_contract_status",
  contractFileUrl: "bankid_contract_file_url",
  contractSignedAt: "bankid_contract_signed_at",
  bankContractStatus: "bank_contract_status",
} as const;

export default function AuthSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [finalError, setFinalError] = useState<string | null>(null);

  const sessionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (
      params.get("sessionId") ||
      params.get("session_id") ||
      params.get("sid") ||
      params.get("id") ||
      localStorage.getItem(STORAGE_KEYS.pendingSessionId) ||
      null
    );
  }, [location.search]);

  const { data, isLoading, error } = useSession(sessionId);
  const normalizedStatus = data?.status?.toLowerCase();
  const extractedUser = useMemo(() => (data ? extractUserData(data) : null), [data]);
  const isSuccessfulSession = Boolean(
    data &&
      (
        ["success", "succeeded", "completed", "complete", "finished", "approved"].includes(
          normalizedStatus ?? ""
        ) ||
        // Fallback: session contains verified subject attributes from Signicat
        Boolean(extractedUser)
      )
  );

  useEffect(() => {
    if (!data || !isSuccessfulSession) return;

    try {
      localStorage.setItem(STORAGE_KEYS.verified, "true");
      localStorage.setItem(STORAGE_KEYS.status, "success");
      localStorage.removeItem(STORAGE_KEYS.error);
      localStorage.setItem(STORAGE_KEYS.verifiedAt, new Date().toISOString());
      localStorage.setItem(STORAGE_KEYS.sessionId, data.id);
      localStorage.removeItem(STORAGE_KEYS.pendingSessionId);
      if (data.access_token) {
        localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
      }

      if (extractedUser) {
        localStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(extractedUser));
      }

      const persistVerification = async () => {
        const verificationClient = supabase as any;
        const resolvedSessionId = data.id || sessionId || null;
        if (!resolvedSessionId) return;

        const fullName = [extractedUser?.firstName, extractedUser?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        const birthDate = extractedUser?.dateOfBirth
          ? extractedUser.dateOfBirth.slice(0, 10)
          : null;

        const { data: serverData, error: tokenError } = await verificationClient.functions.invoke(
          "bankid-verification-token",
          {
            body: {
              sessionId: resolvedSessionId,
              provider: data.provider || "nbid",
              subjectId: data.subject?.id || null,
              nin: extractedUser?.nin || null,
              name: fullName || null,
              birthDate,
              authLevel: data.authLevel || null,
              nbidSid: data.sid || null,
              bankidAccessToken: data.access_token || null,
              raw: data,
              email: extractedUser?.email || null,
            },
          }
        );

        if (tokenError) {
          console.error("Failed to persist bankid verification on server:", tokenError);
          return;
        }

        if (serverData?.verificationId) {
          localStorage.setItem(STORAGE_KEYS.verificationRowId, serverData.verificationId);
        }
        if (serverData?.jwtAccessToken) {
          localStorage.setItem(STORAGE_KEYS.jwtToken, serverData.jwtAccessToken);
        }
        if (serverData?.expiresAt) {
          localStorage.setItem(STORAGE_KEYS.jwtExpiresAt, serverData.expiresAt);
        }

        const contractIsSigned = Boolean(serverData?.contractStatus);
        if (contractIsSigned) {
          localStorage.setItem(STORAGE_KEYS.contractStatus, "existing");
          localStorage.setItem(STORAGE_KEYS.bankContractStatus, "true");
          if (serverData?.contractFilePath) {
            localStorage.setItem(STORAGE_KEYS.contractFileUrl, String(serverData.contractFilePath));
          }
          if (serverData?.contractSignedAt) {
            localStorage.setItem(STORAGE_KEYS.contractSignedAt, String(serverData.contractSignedAt));
          }
        } else {
          localStorage.removeItem(STORAGE_KEYS.contractStatus);
          localStorage.removeItem(STORAGE_KEYS.contractFileUrl);
          localStorage.removeItem(STORAGE_KEYS.contractSignedAt);
          localStorage.setItem(STORAGE_KEYS.bankContractStatus, "false");
        }
      };

      void persistVerification();
    } catch (storageError) {
      console.error("Failed to persist BankID session data:", storageError);
    }
  }, [data, extractedUser, isSuccessfulSession]);

  const isSuccess = isSuccessfulSession;
  const hasError = Boolean(finalError || error || normalizedStatus === "error");

  useEffect(() => {
    if (!isSuccess) return;
    const timer = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [isSuccess, navigate]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3] shadow-xl">
        <h1 className="mb-2 text-xl font-semibold text-[#E3C08D]">BankID-verifisering</h1>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Henter autentiseringsresultat ...
          </div>
        )}

        {!isLoading && isSuccess && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-300">
              <CheckCircle2 className="h-5 w-5" />
              <span>Innlogging med BankID er fullført.</span>
            </div>
            <p className="text-sm text-[#9eabb1]">
              Du kan nå gå tilbake til bestillingen og fortsette til betaling.
            </p>
            <Button
              className="mt-2 w-full bg-[#E3C08D] text-black hover:bg-[#E3C08D]/90"
              onClick={() => navigate("/", { replace: true })}
            >
              Gå til forsiden
            </Button>
          </div>
        )}

        {!isLoading && hasError && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-300">
              <XCircle className="h-5 w-5" />
              <span>BankID-verifisering mislyktes.</span>
            </div>
            <p className="text-sm text-[#9eabb1]">
              {finalError ||
                error?.message ||
                data?.error?.message ||
                "Ukjent feil fra Signicat."}
            </p>
            <Button
              className="mt-2 w-full bg-[#334047] text-[#b1bdc3] hover:bg-[#3d4b53]"
              onClick={() => navigate("/", { replace: true })}
            >
              Tilbake
            </Button>
          </div>
        )}

        {!isLoading && !isSuccess && !hasError && (
          <div className="space-y-3">
            <p className="text-sm text-[#9eabb1]">
              Fant ikke gyldig session-id i callbacken. Prøv BankID på nytt.
            </p>
            <Button
              className="mt-2 w-full bg-[#334047] text-[#b1bdc3] hover:bg-[#3d4b53]"
              onClick={() => setFinalError("Mangler session-id i callback-URL.")}
            >
              Vis feildetalj
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
