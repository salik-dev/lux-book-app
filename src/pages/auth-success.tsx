import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCriiptoVerify } from "@criipto/verify-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { UserData } from "@/api/signicat";

const STORAGE_KEYS = {
  verified: "bankid_verified",
  status: "bankid_auth_status",
  error: "bankid_auth_error",
  verifiedAt: "bankid_verified_at",
  sessionId: "bankid_session_id",
  pendingSessionId: "bankid_pending_session_id",
  accessToken: "signicat_access_token",
  userData: "signicat_user_data",
  verificationRowId: "bankid_verification_row_id",
  contractStatus: "bankid_contract_status",
  contractFileUrl: "bankid_contract_file_url",
  contractSignedAt: "bankid_contract_signed_at",
  bankContractStatus: "bank_contract_status",
} as const;

/** Best-effort extraction of user attributes from Idura's decoded id_token claims — the exact
 * claim set varies per eID provider, so every field is optional. */
function extractUserDataFromClaims(claims: Record<string, unknown> | null): UserData | null {
  if (!claims) return null;

  const asString = (value: unknown): string | undefined => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed ? trimmed : undefined;
  };

  const userData: UserData = {
    firstName: asString(claims.given_name),
    lastName: asString(claims.family_name),
    dateOfBirth: asString(claims.birthdate),
    email: asString(claims.email),
    phoneNumber: asString(claims.phone_number),
    address: asString(claims.address),
    gender: asString(claims.gender),
    nin: asString(claims.ssn) ?? asString(claims.nin) ?? asString(claims.social_security_number),
    ssn: asString(claims.ssn),
  };

  if (!userData.firstName && !userData.lastName) {
    const fullName = asString(claims.name);
    if (fullName) {
      const [first, ...rest] = fullName.split(" ");
      userData.firstName = first;
      userData.lastName = rest.join(" ") || undefined;
    }
  }

  if (!Object.values(userData).some(Boolean)) {
    return null;
  }

  return userData;
}

export default function AuthSuccessPage() {
  const navigate = useNavigate();
  const [finalError, setFinalError] = useState<string | null>(null);
  const { result, claims, error, isLoading } = useCriiptoVerify();

  const extractedUser = useMemo(() => extractUserDataFromClaims(claims), [claims]);
  const idToken = result && "id_token" in result ? result.id_token : undefined;
  const isSuccessfulSession = Boolean(!isLoading && !error && claims && idToken);

  useEffect(() => {
    if (!isSuccessfulSession || !claims) return;

    console.log("[Idura] BankID authentication successful");
    console.log("[Idura] result:", result);
    console.log("[Idura] claims:", claims);
    console.log("[Idura] extracted user data:", extractedUser);

    try {
      localStorage.setItem(STORAGE_KEYS.verified, "true");
      localStorage.setItem(STORAGE_KEYS.status, "success");
      localStorage.removeItem(STORAGE_KEYS.error);
      localStorage.setItem(STORAGE_KEYS.verifiedAt, new Date().toISOString());
      localStorage.setItem(STORAGE_KEYS.sessionId, claims.sub);
      localStorage.removeItem(STORAGE_KEYS.pendingSessionId);
      if (idToken) {
        localStorage.setItem(STORAGE_KEYS.accessToken, idToken);
      }

      if (extractedUser) {
        localStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(extractedUser));
      }

      const persistVerification = async () => {
        const verificationClient = supabase as any;

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
              sessionId: claims.sub,
              provider: "idura",
              subjectId: claims.sub,
              nin: extractedUser?.nin || null,
              name: fullName || null,
              birthDate,
              authLevel: claims.identityscheme || claims.authenticationtype || null,
              nbidSid: null,
              bankidAccessToken: idToken || null,
              raw: claims,
              email: extractedUser?.email || null,
            },
          }
        );

        if (tokenError) {
          console.error("Failed to persist Idura verification on server:", tokenError);
          return;
        }

        console.log("[Idura] bankid-verification-token server response:", serverData);

        if (serverData?.verificationId) {
          localStorage.setItem(STORAGE_KEYS.verificationRowId, serverData.verificationId);
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
      console.error("Failed to persist Idura verification data:", storageError);
    }
  }, [claims, extractedUser, idToken, isSuccessfulSession]);

  const isSuccess = isSuccessfulSession;
  const hasError = Boolean(finalError || error);

  useEffect(() => {
    if (!isSuccess) return;
    const timer = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [isSuccess, navigate]);

  useEffect(() => {
    if (!error) return;
    localStorage.setItem(STORAGE_KEYS.status, "failed");
    localStorage.setItem(STORAGE_KEYS.error, error.message);
    localStorage.removeItem(STORAGE_KEYS.verified);
    localStorage.removeItem(STORAGE_KEYS.verifiedAt);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3] shadow-xl">
        <h1 className="mb-2 text-xl font-semibold text-[#E3C08D]">BankID Verification</h1>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Retrieving authentication result...
          </div>
        )}

        {!isLoading && isSuccess && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-300">
              <CheckCircle2 className="h-5 w-5" />
              <span>BankID login completed.</span>
            </div>
            <p className="text-sm text-[#9eabb1]">
              You can now return to your booking and continue to payment.
            </p>
            <Button
              className="mt-2 w-full bg-[#E3C08D] text-black hover:bg-[#E3C08D]/90"
              onClick={() => navigate("/", { replace: true })}
            >
              Go to Homepage
            </Button>
          </div>
        )}

        {!isLoading && hasError && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-300">
              <XCircle className="h-5 w-5" />
              <span>BankID verification failed.</span>
            </div>
            <p className="text-sm text-[#9eabb1]">
              {finalError || error?.message || "Unknown error from Idura."}
            </p>
            <Button
              className="mt-2 w-full bg-[#334047] text-[#b1bdc3] hover:bg-[#3d4b53]"
              onClick={() => navigate("/", { replace: true })}
            >
              Back
            </Button>
          </div>
        )}

        {!isLoading && !isSuccess && !hasError && (
          <div className="space-y-3">
            <p className="text-sm text-[#9eabb1]">
              No valid authentication result was found in the callback. Please try BankID again.
            </p>
            <Button
              className="mt-2 w-full bg-[#334047] text-[#b1bdc3] hover:bg-[#3d4b53]"
              onClick={() => setFinalError("Missing authentication result in the callback URL.")}
            >
              Show Error Details
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
