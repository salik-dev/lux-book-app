import React, { useCallback, useEffect, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useDropzone } from "react-dropzone";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Upload, User, FileText, MapPin, Truck, Loader2, X, CheckCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { BookingData, CustomerData } from "@/@types/data";
import { useToast } from "@/hooks/use-toast";
import { generateUniqueId } from "@/utils/carPlaceholder";
import { supabase } from '@/integrations/supabase/client';
import { useCriiptoVerify } from "@criipto/verify-react";
import { createContractSigning, getContractDocumentPreviewUrl, getContractStatus, UserData } from "@/api/signicat";

/** Values not shown in the form; still sent to complete the booking. */
const HIDDEN_CUSTOMER_DEFAULTS = {
  fullName: "",
  phone: "",
  city: "Oslo",
} as const;

export const STORAGE_KEYS = {
  bankIdVerified: "bankid_verified",
  bankIdVerifiedAt: "bankid_verified_at",
  bankIdStatus: "bankid_auth_status",
  bankIdError: "bankid_auth_error",
  bankIdUserData: "signicat_user_data",
  bankIdSessionId: "bankid_session_id",
  bookingRestoreState: "booking_restore_state",
  contractStatus: "bankid_contract_status",
  contractDocumentId: "bankid_contract_document_id",
  contractSessionId: "bankid_contract_session_id",
  contractSigningUrl: "bankid_contract_signing_url",
  contractFileUrl: "bankid_contract_file_url",
  contractSignedAt: "bankid_contract_signed_at",
  contractError: "bankid_contract_error",
  signicatSessionId: "signicat_session_id",
  signicatExternalReference: "signicat_external_reference",
  signicatSessionMapping: "signicat_session_mapping",
  verificationRowId: "bankid_verification_row_id",
  bankContractStatus: "bank_contract_status",
  licenseStatus: "license_status",
  licenseCategories: "license_categories",
  licenseFullName: "license_full_name",
  licenseVerifiedAt: "license_verified_at",
} as const;

const SIGNED_STATUS_VALUES = ["signed", "completed", "complete", "success", "approved"];

/** Contract signing and manual driver's license upload are temporarily hidden while
 * driver's license verification is moved to an external API driven by NIN + last name. */
const SHOW_CONTRACT_SECTION = false;
const SHOW_DRIVER_LICENSE_UPLOAD = false;

/** Parse documentId/sessionId from a stored signicat-document function URL. */
const parseSignicatDocumentUrl = (
  raw: string | null | undefined
): { documentId?: string; sessionId?: string } => {
  if (!raw || typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed.includes("signicat-document")) return {};
  try {
    const u = new URL(trimmed);
    return {
      documentId: u.searchParams.get("documentId") || undefined,
      sessionId: u.searchParams.get("sessionId") || undefined,
    };
  } catch {
    return {};
  }
};

const toSafeISOString = (value: unknown, fallback: Date): string => {
  const asDate = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(asDate.getTime()) ? fallback.toISOString() : asDate.toISOString();
};

interface CustomerFormProps {
  bookingData: BookingData;
  onComplete: (data: CustomerData) => void;
  initialData?: CustomerData;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ bookingData, onComplete, initialData }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [bankIdVerified, setBankIdVerified] = useState(false);
  const [bankIdStatus, setBankIdStatus] = useState<"idle" | "pending" | "success" | "failed" | "aborted">("idle");
  const [bankIdError, setBankIdError] = useState("");
  const [bankIdUser, setBankIdUser] = useState<UserData | null>(null);
  const [contractStatus, setContractStatus] = useState<"idle" | "pending" | "signed" | "failed" | "existing">("idle");
  const [contractDocumentId, setContractDocumentId] = useState<string | null>(null);
  const [contractSessionId, setContractSessionId] = useState<string | null>(null);
  const [contractSigningUrl, setContractSigningUrl] = useState<string | null>(null);
  const [contractFileUrl, setContractFileUrl] = useState<string | null>(null);
  const [contractSignedAt, setContractSignedAt] = useState<string | null>(null);
  const [contractError, setContractError] = useState("");
  const [isCheckingContract, setIsCheckingContract] = useState(false);
  const [isStartingContract, setIsStartingContract] = useState(false);
  const [hasHandledContractReturn, setHasHandledContractReturn] = useState(false);
  /** Mirrors `bankid_verifications.contract_status` from the server (null = not loaded yet). */
  const [serverContractSigned, setServerContractSigned] = useState<boolean | null>(null);
  // Statens vegvesen driver-licence verification
  const [licenseStatus, setLicenseStatus] = useState<"idle" | "checking" | "verified" | "failed">("idle");
  const [licenseCategories, setLicenseCategories] = useState<string[]>([]);
  const [licenseFullName, setLicenseFullName] = useState<string>("");
  const [licenseVerifiedAt, setLicenseVerifiedAt] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState("");
  const { toast } = useToast();
  const { loginWithRedirect, isLoading: isBankIDPending, isInitializing } = useCriiptoVerify();

  const form = useForm<CustomerData>({
    defaultValues: {
      fullName: initialData?.fullName || HIDDEN_CUSTOMER_DEFAULTS.fullName,
      lastName: initialData?.lastName || "",
      nin: initialData?.nin || "",
      email: initialData?.email || "",
      phone: initialData?.phone || HIDDEN_CUSTOMER_DEFAULTS.phone,
      bookingForCompany: initialData?.bookingForCompany ?? false,
      orgName: initialData?.orgName || "",
      orgNo: initialData?.orgNo || "",
      address: initialData?.address || "",
      postalCode: initialData?.postalCode || "",
      city: initialData?.city || HIDDEN_CUSTOMER_DEFAULTS.city,
      driverLicenseNumber: initialData?.driverLicenseNumber || "",
      driverLicenseFile: initialData?.driverLicenseFile,
    },
    mode: "onChange",
  });

  // Hydrate/reset when navigating back with existing data
  useEffect(() => {
    if (initialData) {
      form.reset({
        fullName: initialData.fullName || HIDDEN_CUSTOMER_DEFAULTS.fullName,
        lastName: initialData.lastName || "",
        nin: initialData.nin || "",
        email: initialData.email || "",
        phone: initialData.phone || HIDDEN_CUSTOMER_DEFAULTS.phone,
        bookingForCompany: initialData.bookingForCompany ?? false,
        orgName: initialData.orgName || "",
        orgNo: initialData.orgNo || "",
        address: initialData.address || "",
        postalCode: initialData.postalCode || "",
        city: initialData.city || HIDDEN_CUSTOMER_DEFAULTS.city,
        driverLicenseNumber: initialData.driverLicenseNumber || "",
        driverLicenseFile: initialData.driverLicenseFile,
      });
      // Also hydrate local file preview state so dropzone shows the file name
      if (initialData.driverLicenseFile) {
        setLicenseFile(initialData.driverLicenseFile as File);
      }
    }
  }, [initialData, form]);

  useEffect(() => {
    if (!bankIdVerified || !bankIdUser) return;

    const derivedName = [bankIdUser.firstName, bankIdUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (derivedName) form.setValue("fullName", derivedName);
    if (bankIdUser.phoneNumber) form.setValue("phone", bankIdUser.phoneNumber);
    if (bankIdUser.email && !form.getValues("email")) {
      form.setValue("email", bankIdUser.email);
    }
    if (bankIdUser.address && !form.getValues("address")) {
      form.setValue("address", bankIdUser.address);
    }
    if (bankIdUser.lastName && !form.getValues("lastName")) {
      form.setValue("lastName", bankIdUser.lastName);
    }
    if (bankIdUser.nin && !form.getValues("nin")) {
      form.setValue("nin", bankIdUser.nin);
    }
  }, [bankIdVerified, bankIdUser, form]);

  const applyVerificationContractFromServer = (data: {
    verificationId?: string | null;
    contractStatus?: boolean;
    contractSignedAt?: string | null;
    contractFilePath?: string | null;
  }) => {
    const signed = Boolean(data?.contractStatus);
    setServerContractSigned(signed);
    localStorage.setItem(STORAGE_KEYS.bankContractStatus, signed ? "true" : "false");

    if (data?.verificationId) {
      localStorage.setItem(STORAGE_KEYS.verificationRowId, String(data.verificationId));
    }

    if (signed) {
      if (data?.contractFilePath) {
        const path = String(data.contractFilePath);
        setContractFileUrl(path);
        localStorage.setItem(STORAGE_KEYS.contractFileUrl, path);
        const parsed = parseSignicatDocumentUrl(path);
        if (parsed.documentId) {
          setContractDocumentId(parsed.documentId);
          localStorage.setItem(STORAGE_KEYS.contractDocumentId, parsed.documentId);
        }
        if (parsed.sessionId) {
          setContractSessionId(parsed.sessionId);
          localStorage.setItem(STORAGE_KEYS.contractSessionId, parsed.sessionId);
        }
      }
      if (data?.contractSignedAt) {
        const at = String(data.contractSignedAt);
        setContractSignedAt(at);
        localStorage.setItem(STORAGE_KEYS.contractSignedAt, at);
      }
      setContractStatus("existing");
      localStorage.setItem(STORAGE_KEYS.contractStatus, "existing");
    } else {
      setContractStatus((prev) => {
        if (prev === "pending") return prev;
        localStorage.removeItem(STORAGE_KEYS.contractStatus);
        localStorage.removeItem(STORAGE_KEYS.contractSignedAt);
        localStorage.removeItem(STORAGE_KEYS.contractFileUrl);
        window.setTimeout(() => {
          setContractSignedAt(null);
          setContractFileUrl(null);
        }, 0);
        return "idle";
      });
    }
  };

  const syncVerificationFromServer = useCallback(async (): Promise<boolean | null> => {
    const verified = localStorage.getItem(STORAGE_KEYS.bankIdVerified) === "true";
    if (!verified) {
      setServerContractSigned(null);
      return null;
    }

    let nin: string | null = bankIdUser?.nin ?? null;
    if (!nin) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.bankIdUserData);
        if (raw) nin = (JSON.parse(raw) as UserData)?.nin ?? null;
      } catch {
        nin = null;
      }
    }

    const verificationId = localStorage.getItem(STORAGE_KEYS.verificationRowId);
    const sessionId = localStorage.getItem(STORAGE_KEYS.bankIdSessionId);

    if (!nin && !verificationId && !sessionId) {
      setServerContractSigned(false);
      localStorage.setItem(STORAGE_KEYS.bankContractStatus, "false");
      return false;
    }

    try {
      const client = supabase as any;
      const { data, error } = await client.functions.invoke("bankid-verification-token", {
        body: {
          action: "sync_verification_state",
          nin,
          verificationId,
          sessionId,
        },
      });
      if (error) {
        console.error("sync_verification_state failed:", error);
        setServerContractSigned(false);
        localStorage.setItem(STORAGE_KEYS.bankContractStatus, "false");
        return false;
      }
      applyVerificationContractFromServer(data ?? {});
      return Boolean(data?.contractStatus);
    } catch (e) {
      console.error("sync_verification_state:", e);
      setServerContractSigned(false);
      localStorage.setItem(STORAGE_KEYS.bankContractStatus, "false");
      return false;
    }
  }, [bankIdUser?.nin]);

  useEffect(() => {
    try {
      const verified = localStorage.getItem(STORAGE_KEYS.bankIdVerified) === "true";
      const status = (localStorage.getItem(STORAGE_KEYS.bankIdStatus) ??
        (verified ? "success" : "idle")) as
        | "idle"
        | "pending"
        | "success"
        | "failed"
        | "aborted";
      const error = localStorage.getItem(STORAGE_KEYS.bankIdError) ?? "";
      const userRaw = localStorage.getItem(STORAGE_KEYS.bankIdUserData);
      const user = userRaw ? (JSON.parse(userRaw) as UserData) : null;

      setBankIdVerified(verified);
      setBankIdStatus(status);
      setBankIdError(error);
      setBankIdUser(user);

      const savedContractStatus = localStorage.getItem(STORAGE_KEYS.contractStatus);
      let savedDocumentId = localStorage.getItem(STORAGE_KEYS.contractDocumentId);
      let savedSessionId = localStorage.getItem(STORAGE_KEYS.contractSessionId);
      const savedSigningUrl = localStorage.getItem(STORAGE_KEYS.contractSigningUrl);
      const savedFileUrl = localStorage.getItem(STORAGE_KEYS.contractFileUrl);
      const savedSignedAt = localStorage.getItem(STORAGE_KEYS.contractSignedAt);
      const savedContractError = localStorage.getItem(STORAGE_KEYS.contractError) ?? "";

      if ((!savedDocumentId || !savedSessionId) && savedFileUrl) {
        const parsed = parseSignicatDocumentUrl(savedFileUrl);
        if (!savedDocumentId && parsed.documentId) {
          savedDocumentId = parsed.documentId;
          localStorage.setItem(STORAGE_KEYS.contractDocumentId, parsed.documentId);
        }
        if (!savedSessionId && parsed.sessionId) {
          savedSessionId = parsed.sessionId;
          localStorage.setItem(STORAGE_KEYS.contractSessionId, parsed.sessionId);
        }
      }

      if (
        savedContractStatus === "signed" ||
        savedContractStatus === "existing" ||
        savedContractStatus === "failed" ||
        savedContractStatus === "pending"
      ) {
        setContractStatus(savedContractStatus);
      }
      if (savedDocumentId) setContractDocumentId(savedDocumentId);
      if (savedSessionId) setContractSessionId(savedSessionId);
      if (savedSigningUrl) setContractSigningUrl(savedSigningUrl);
      if (savedFileUrl) setContractFileUrl(savedFileUrl);
      if (savedSignedAt) setContractSignedAt(savedSignedAt);
      if (savedContractError) setContractError(savedContractError);

      // License verification is only meaningful against an already-verified BankID identity,
      // so only restore it alongside a still-verified BankID session.
      if (verified && localStorage.getItem(STORAGE_KEYS.licenseStatus) === "verified") {
        setLicenseStatus("verified");
        setLicenseFullName(localStorage.getItem(STORAGE_KEYS.licenseFullName) ?? "");
        setLicenseVerifiedAt(localStorage.getItem(STORAGE_KEYS.licenseVerifiedAt));
        try {
          const savedCategoriesRaw = localStorage.getItem(STORAGE_KEYS.licenseCategories);
          setLicenseCategories(savedCategoriesRaw ? JSON.parse(savedCategoriesRaw) : []);
        } catch {
          setLicenseCategories([]);
        }
      }
    } catch (error) {
      console.error("Failed to restore BankID/contract state:", error);
    }
  }, []);

  useEffect(() => {
    if (!bankIdVerified) {
      setServerContractSigned(null);
      return;
    }
    void syncVerificationFromServer();
  }, [bankIdVerified, bankIdUser?.nin, syncVerificationFromServer]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("no-NO", {
      style: "currency",
      currency: "NOK",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const watchedEmail = form.watch("email");
  const bookingForCompany = form.watch("bookingForCompany");
  const pdfActionsAllowed =
    serverContractSigned === true && Boolean(contractDocumentId || contractFileUrl);

  const updateBankIdVerificationContractState = async (payload: {
    contract_status: boolean;
    contract_signed_at?: string | null;
    contract_file_path?: string | null;
  }) => {
    const userRaw = localStorage.getItem(STORAGE_KEYS.bankIdUserData);
    const user = userRaw ? (JSON.parse(userRaw) as UserData) : null;
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    const verificationClient = supabase as any;
    const { data, error } = await verificationClient.functions.invoke(
      "bankid-verification-contract",
      {
        body: {
          verificationId: localStorage.getItem(STORAGE_KEYS.verificationRowId),
          sessionId: localStorage.getItem(STORAGE_KEYS.bankIdSessionId),
          nbidSid: localStorage.getItem(STORAGE_KEYS.signicatSessionId),
          nin: user?.nin || null,
          provider: "nbid",
          name: fullName || null,
          contractStatus: payload.contract_status,
          contractSignedAt: payload.contract_signed_at ?? null,
          contractFilePath: payload.contract_file_path ?? null,
        },
      }
    );

    if (error) {
      console.error("Failed to persist contract state in bankid_verifications:", error);
      return;
    }

    if (data?.verificationId) {
      localStorage.setItem(STORAGE_KEYS.verificationRowId, data.verificationId);
    }
    if (payload.contract_status) {
      void syncVerificationFromServer();
    }
  };

  useEffect(() => {
    if (!watchedEmail || serverContractSigned === true) return;

    const timer = setTimeout(async () => {
      try {
        setIsCheckingContract(true);
        const verificationClient = supabase as any;
        const lookupSessionId =
          localStorage.getItem(STORAGE_KEYS.bankIdSessionId) ||
          localStorage.getItem(STORAGE_KEYS.signicatSessionId);
        const { data: verificationData } = await verificationClient
          .from("bankid_verifications")
          .select("contract_status, contract_signed_at, contract_file_path")
          .eq(lookupSessionId ? "session_id" : "nin", lookupSessionId || bankIdUser?.nin || "")
          .eq("contract_status", true)
          .order("verified_at", { ascending: false })
          .limit(1);

        if (verificationData && verificationData.length > 0) {
          const row = verificationData[0] as { contract_signed_at: string | null; contract_file_path: string | null };
          const signedAt = row.contract_signed_at ?? new Date().toISOString();
          setContractStatus("existing");
          setServerContractSigned(true);
          localStorage.setItem(STORAGE_KEYS.bankContractStatus, "true");
          setContractSignedAt(signedAt);
          setContractFileUrl(row.contract_file_path);
          localStorage.setItem(STORAGE_KEYS.contractStatus, "existing");
          localStorage.setItem(STORAGE_KEYS.contractSignedAt, signedAt);
          if (row.contract_file_path) {
            localStorage.setItem(STORAGE_KEYS.contractFileUrl, row.contract_file_path);
          }
          return;
        }

        const { data, error } = await supabase
          .from("bookings")
          .select("contract_signed_at, contract_file_path, customer:customers!inner(email)")
          .eq("customer.email", watchedEmail)
          .not("contract_signed_at", "is", null)
          .order("contract_signed_at", { ascending: false })
          .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
          const row = data[0] as { contract_signed_at: string | null; contract_file_path: string | null };
          const signedAt = row.contract_signed_at ?? new Date().toISOString();
          setContractStatus("existing");
          setServerContractSigned(true);
          localStorage.setItem(STORAGE_KEYS.bankContractStatus, "true");
          setContractSignedAt(signedAt);
          setContractFileUrl(row.contract_file_path);
          localStorage.setItem(STORAGE_KEYS.contractStatus, "existing");
          localStorage.setItem(STORAGE_KEYS.contractSignedAt, signedAt);
          if (row.contract_file_path) {
            localStorage.setItem(STORAGE_KEYS.contractFileUrl, row.contract_file_path);
          }
        }
      } catch (error) {
        console.error("Failed checking previous contract:", error);
      } finally {
        setIsCheckingContract(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [watchedEmail, serverContractSigned, bankIdUser?.nin]);

  const handleVerifyLicense = async () => {
    const nin = (form.getValues("nin") || "").trim();
    const lastName = (form.getValues("lastName") || "").trim();

    if (!bankIdVerified) {
      toast({
        title: "BankID required",
        description: "Complete BankID verification before verifying your driver's licence.",
        variant: "destructive",
      });
      return;
    }
    if (!/^\d{11}$/.test(nin)) {
      form.setError("nin", { type: "manual", message: "National ID number must be 11 digits" });
      toast({ title: "Invalid national ID number", description: "National ID number must be 11 digits.", variant: "destructive" });
      return;
    }
    if (!lastName) {
      form.setError("lastName", { type: "manual", message: "Last name is required" });
      return;
    }

    try {
      setLicenseStatus("checking");
      setLicenseError("");

      const { data, error } = await supabase.functions.invoke("vegvesen-license-check", {
        body: { nin, lastName },
      });

      // A non-2xx response (400/403/500) surfaces as `error`; read the JSON body for the message.
      if (error) {
        let message = error.message || "Driver's licence verification failed.";
        try {
          const ctxBody = await (error as { context?: Response }).context?.json?.();
          if (ctxBody?.error) message = String(ctxBody.error);
        } catch {
          /* keep default message */
        }
        throw new Error(message);
      }

      if (!data?.verified) {
        const message = data?.message || "Driver's licence could not be verified. Please check the details.";
        setLicenseStatus("failed");
        setLicenseError(message);
        setLicenseCategories([]);
        setLicenseFullName("");
        localStorage.removeItem(STORAGE_KEYS.licenseStatus);
        localStorage.removeItem(STORAGE_KEYS.licenseCategories);
        localStorage.removeItem(STORAGE_KEYS.licenseFullName);
        localStorage.removeItem(STORAGE_KEYS.licenseVerifiedAt);
        toast({ title: "Driver's licence not verified", description: message, variant: "destructive" });
        return;
      }

      const categories: string[] = Array.isArray(data.categories) ? data.categories : [];

      // A car rental requires a valid class B (passenger car) licence. A successful
      // lookup with no B (or no categories at all) means no valid car licence.
      const REQUIRED_CATEGORY = "B";
      if (!categories.includes(REQUIRED_CATEGORY)) {
        const message = categories.length
          ? `Found licence categories (${categories.join(", ")}) but no class ${REQUIRED_CATEGORY} (passenger car). Cannot rent a car.`
          : "No valid driver's licence registered for this person.";
        setLicenseCategories(categories);
        setLicenseFullName(data.fullName || "");
        setLicenseStatus("failed");
        setLicenseError(message);
        localStorage.removeItem(STORAGE_KEYS.licenseStatus);
        localStorage.removeItem(STORAGE_KEYS.licenseCategories);
        localStorage.removeItem(STORAGE_KEYS.licenseFullName);
        localStorage.removeItem(STORAGE_KEYS.licenseVerifiedAt);
        toast({ title: "No valid driver's licence", description: message, variant: "destructive" });
        return;
      }

      const at = new Date().toISOString();
      setLicenseCategories(categories);
      setLicenseFullName(data.fullName || "");
      setLicenseVerifiedAt(at);
      setLicenseStatus("verified");
      localStorage.setItem(STORAGE_KEYS.licenseStatus, "verified");
      localStorage.setItem(STORAGE_KEYS.licenseCategories, JSON.stringify(categories));
      localStorage.setItem(STORAGE_KEYS.licenseFullName, data.fullName || "");
      localStorage.setItem(STORAGE_KEYS.licenseVerifiedAt, at);
      toast({
        title: "Driver's licence verified",
        description: `Valid driver's licence. Categories: ${categories.join(", ")}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error during driver's licence verification.";
      setLicenseStatus("failed");
      setLicenseError(message);
      setLicenseCategories([]);
      setLicenseFullName("");
      localStorage.removeItem(STORAGE_KEYS.licenseStatus);
      localStorage.removeItem(STORAGE_KEYS.licenseCategories);
      localStorage.removeItem(STORAGE_KEYS.licenseFullName);
      localStorage.removeItem(STORAGE_KEYS.licenseVerifiedAt);
      toast({ title: "Verification failed", description: message, variant: "destructive" });
    }
  };

  const handleBankIDLogin = async () => {
    try {
      localStorage.setItem(STORAGE_KEYS.bankIdStatus, "pending");
      localStorage.removeItem(STORAGE_KEYS.bankIdError);
      localStorage.setItem(
        STORAGE_KEYS.bookingRestoreState,
        JSON.stringify({
          step: 2,
          bookingData: {
            ...bookingData,
            startDateTime: toSafeISOString(bookingData.startDateTime, new Date()),
            endDateTime: toSafeISOString(
              bookingData.endDateTime,
              new Date(Date.now() + 60 * 60 * 1000)
            ),
          },
          customerData: {
            ...form.getValues(),
            driverLicenseFile: undefined,
          },
        })
      );

      setBankIdStatus("pending");
      setBankIdError("");
      await loginWithRedirect();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not start BankID login. Please try again.";
      setBankIdStatus("failed");
      setBankIdError(message);
      localStorage.setItem(STORAGE_KEYS.bankIdStatus, "failed");
      localStorage.setItem(STORAGE_KEYS.bankIdError, message);
      toast({
        title: "BankID error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleCreateContract = async () => {
    try {
      const preSync = await syncVerificationFromServer();
      if (preSync === true) {
        toast({
          title: "Contract already signed",
          description: "Use \"View PDF\" / \"Download PDF\" below.",
        });
        return;
      }

      setIsStartingContract(true);
      setContractStatus("pending");
      setContractError("");
      localStorage.setItem(STORAGE_KEYS.contractStatus, "pending");
      localStorage.removeItem(STORAGE_KEYS.contractError);
      localStorage.removeItem(STORAGE_KEYS.contractSignedAt);
      localStorage.removeItem(STORAGE_KEYS.contractFileUrl);
      await updateBankIdVerificationContractState({
        contract_status: false,
        contract_signed_at: null,
        contract_file_path: null,
      });

      localStorage.setItem(
        STORAGE_KEYS.bookingRestoreState,
        JSON.stringify({
          step: 2,
          bookingData: {
            ...bookingData,
            startDateTime: toSafeISOString(bookingData.startDateTime, new Date()),
            endDateTime: toSafeISOString(
              bookingData.endDateTime,
              new Date(Date.now() + 60 * 60 * 1000)
            ),
          },
          customerData: {
            ...form.getValues(),
            driverLicenseFile: undefined
                    },
        })
      );

      const bankIdSessionId = localStorage.getItem(STORAGE_KEYS.bankIdSessionId) ?? undefined;
      const result = await createContractSigning(bankIdSessionId, form.getValues("email"));
      const signatureUrl = result.signatureUrl ?? result.signingUrl;

      if (!signatureUrl) {
        throw new Error("Incomplete contract response from Signicat.");
      }

      if (!result.documentId) {
        throw new Error("Missing documentId from Signicat.");
      }

      const statusTrackingId = result.sessionId || result.documentId;
      setContractDocumentId(result.documentId);
      setContractSessionId(statusTrackingId);
      setContractSigningUrl(signatureUrl);
      localStorage.setItem(STORAGE_KEYS.contractDocumentId, result.documentId);
      localStorage.setItem(STORAGE_KEYS.contractSessionId, statusTrackingId);
      localStorage.setItem(STORAGE_KEYS.contractSigningUrl, signatureUrl);

      if (result.sessionId && result.externalReference) {
        localStorage.setItem(STORAGE_KEYS.signicatSessionId, result.sessionId);
        localStorage.setItem(STORAGE_KEYS.signicatExternalReference, result.externalReference);
        localStorage.setItem(
          STORAGE_KEYS.signicatSessionMapping,
          JSON.stringify({
            sessionId: result.sessionId,
            externalReference: result.externalReference,
          })
        );
      }

      window.location.href = signatureUrl;
      toast({
        title: "Contract started",
        description: "Complete signing in the new window, then check the status.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start contract signing.";
      setContractStatus("failed");
      setContractError(message);
      localStorage.setItem(STORAGE_KEYS.contractStatus, "failed");
      localStorage.setItem(STORAGE_KEYS.contractError, message);
      await updateBankIdVerificationContractState({
        contract_status: false,
        contract_signed_at: null,
        contract_file_path: null,
      });
      toast({
        title: "Contract error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsStartingContract(false);
    }
  };

  const handleCheckContractStatus = async () => {
    const statusTrackingId = contractSessionId || contractDocumentId;
    if (!statusTrackingId) {
      toast({
        title: "Missing document",
        description: "Start contract signing first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCheckingContract(true);
      const status = await getContractStatus(statusTrackingId);
      const normalizedStatus = (status.status ?? "").toLowerCase();
      const isSigned = SIGNED_STATUS_VALUES.includes(normalizedStatus);

      if (isSigned) {
        const signedAt = status.signedAt ?? new Date().toISOString();
        const previewUrl = contractDocumentId
          ? getContractDocumentPreviewUrl(contractDocumentId, "pdf", contractSessionId)
          : null;
        setContractStatus("signed");
        setContractSignedAt(signedAt);
        setContractFileUrl(status.fileUrl ?? previewUrl ?? null);
        localStorage.setItem(STORAGE_KEYS.contractStatus, "signed");
        localStorage.setItem(STORAGE_KEYS.contractSignedAt, signedAt);
        if (previewUrl || status.fileUrl) {
          localStorage.setItem(STORAGE_KEYS.contractFileUrl, status.fileUrl ?? previewUrl ?? "");
        }
        await updateBankIdVerificationContractState({
          contract_status: true,
          contract_signed_at: signedAt,
          contract_file_path: status.fileUrl ?? previewUrl ?? null,
        });
        toast({
          title: "Contract signed",
          description: "The contract is signed and ready.",
        });
      } else {
        setContractStatus("pending");
        toast({
          title: "Contract not yet completed",
          description: `Current status: ${status.status}`,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not fetch contract status.";
      setContractStatus("failed");
      setContractError(message);
      localStorage.setItem(STORAGE_KEYS.contractStatus, "failed");
      localStorage.setItem(STORAGE_KEYS.contractError, message);
      await updateBankIdVerificationContractState({
        contract_status: false,
        contract_signed_at: null,
        contract_file_path: null,
      });
      toast({
        title: "Contract error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingContract(false);
    }
  };

  const fetchSignedDocumentBlob = async (
    type: "pdf" | "xml" = "pdf",
    overrides?: { documentId?: string | null; sessionId?: string | null }
  ): Promise<Blob> => {
    const parsed = parseSignicatDocumentUrl(contractFileUrl);
    const documentId =
      overrides?.documentId ?? contractDocumentId ?? parsed.documentId ?? null;
    const sessionId = overrides?.sessionId ?? contractSessionId ?? parsed.sessionId ?? null;

    if (!documentId) {
      throw new Error("Missing document ID for contract.");
    }

    const params = new URLSearchParams({
      documentId,
      type,
    });
    if (sessionId) {
      params.set("sessionId", sessionId);
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signicat-document?${params.toString()}`,
      {
        method: "GET",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      let message = "Could not fetch signed document.";
      try {
        const payload = await response.json();
        if (payload?.error) message = String(payload.error);
      } catch {
        // Keep fallback message when response is not JSON.
      }
      throw new Error(message);
    }

    return await response.blob();
  };

  const handlePreviewSignedDocument = async () => {
    try {
      let allowed = serverContractSigned === true;
      if (!allowed) {
        const synced = await syncVerificationFromServer();
        allowed = synced === true;
      }
      if (!allowed) {
        toast({
          title: "Contract not signed",
          description: "The contract is not registered as signed in the system.",
          variant: "destructive",
        });
        return;
      }

      const parsed = parseSignicatDocumentUrl(contractFileUrl);
      const documentId = contractDocumentId || parsed.documentId;
      const sessionId = contractSessionId || parsed.sessionId;

      if (documentId) {
        const blob = await fetchSignedDocumentBlob("pdf", { documentId, sessionId });
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return;
      }

      if (contractFileUrl && !contractFileUrl.includes("blob:")) {
        window.open(contractFileUrl, "_blank", "noopener,noreferrer");
        return;
      }

      throw new Error("Missing document ID for contract.");
    } catch (error) {
      toast({
        title: "Could not display PDF",
        description: error instanceof Error ? error.message : "Unknown error.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadSignedDocument = async () => {
    try {
      let allowed = serverContractSigned === true;
      if (!allowed) {
        const synced = await syncVerificationFromServer();
        allowed = synced === true;
      }
      if (!allowed) {
        toast({
          title: "Contract not signed",
          description: "The contract is not registered as signed in the system.",
          variant: "destructive",
        });
        return;
      }

      const parsed = parseSignicatDocumentUrl(contractFileUrl);
      const documentId = contractDocumentId || parsed.documentId;
      const sessionId = contractSessionId || parsed.sessionId;

      if (documentId) {
        const blob = await fetchSignedDocumentBlob("pdf", { documentId, sessionId });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = "signed-contract.pdf";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return;
      }

      if (contractFileUrl && !contractFileUrl.includes("blob:")) {
        const anchor = document.createElement("a");
        anchor.href = contractFileUrl;
        anchor.download = "signed-contract.pdf";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        return;
      }

      throw new Error("Missing document ID for contract.");
    } catch (error) {
      toast({
        title: "Could not download PDF",
        description: error instanceof Error ? error.message : "Unknown error.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (hasHandledContractReturn) return;

    const params = new URLSearchParams(window.location.search);
    const contractSignType = params.get("contractSign");
    if (!contractSignType) return;

    setHasHandledContractReturn(true);
    const clearContractQueryParams = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("contractSign");
      url.searchParams.delete("externalReference");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    };

    if (contractSignType === "cancel") {
      setContractStatus("failed");
      setContractError("Contract signing was cancelled.");
      localStorage.setItem(STORAGE_KEYS.contractStatus, "failed");
      localStorage.setItem(STORAGE_KEYS.contractError, "Contract signing was cancelled.");
      clearContractQueryParams();
      return;
    }

    if (contractSignType === "error") {
      setContractStatus("failed");
      setContractError("Signicat reported an error during signing.");
      localStorage.setItem(STORAGE_KEYS.contractStatus, "failed");
      localStorage.setItem(STORAGE_KEYS.contractError, "Signicat reported an error during signing.");
      clearContractQueryParams();
      return;
    }

    if (contractSignType !== "success") {
      clearContractQueryParams();
      return;
    }

    const provisionalDocumentId =
      contractDocumentId || localStorage.getItem(STORAGE_KEYS.contractDocumentId);
    const provisionalSessionId =
      contractSessionId || localStorage.getItem(STORAGE_KEYS.contractSessionId);
    const provisionalSignedAt =
      contractSignedAt || localStorage.getItem(STORAGE_KEYS.contractSignedAt) || new Date().toISOString();
    const provisionalFileUrl = provisionalDocumentId
      ? getContractDocumentPreviewUrl(provisionalDocumentId, "pdf", provisionalSessionId)
      : null;

    setContractSignedAt(provisionalSignedAt);
    setContractStatus("signed");
    localStorage.setItem(STORAGE_KEYS.contractStatus, "signed");
    localStorage.setItem(STORAGE_KEYS.contractSignedAt, provisionalSignedAt);
    if (provisionalFileUrl) {
      setContractFileUrl(provisionalFileUrl);
      localStorage.setItem(STORAGE_KEYS.contractFileUrl, provisionalFileUrl);
    }
    // Mark contract as signed immediately on successful Signicat redirect.
    void updateBankIdVerificationContractState({
      contract_status: true,
      contract_signed_at: provisionalSignedAt,
      contract_file_path: provisionalFileUrl,
    });

    const trackingId =
      contractSessionId ||
      localStorage.getItem(STORAGE_KEYS.contractSessionId) ||
      contractDocumentId ||
      localStorage.getItem(STORAGE_KEYS.contractDocumentId);
    if (!trackingId) {
      clearContractQueryParams();
      return;
    }

    const syncContractStatus = async () => {
      setIsCheckingContract(true);
      try {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const status = await getContractStatus(trackingId);
          const normalizedStatus = (status.status ?? "").toLowerCase();
          const isSigned = SIGNED_STATUS_VALUES.includes(normalizedStatus);

          if (isSigned) {
            const signedAt = status.signedAt ?? new Date().toISOString();
            const currentDocumentId =
              contractDocumentId || localStorage.getItem(STORAGE_KEYS.contractDocumentId);
            const currentSessionId =
              contractSessionId || localStorage.getItem(STORAGE_KEYS.contractSessionId);
            const previewUrl = currentDocumentId
              ? getContractDocumentPreviewUrl(currentDocumentId, "pdf", currentSessionId)
              : null;
            setContractStatus("signed");
            setContractSignedAt(signedAt);
            setContractFileUrl(status.fileUrl ?? previewUrl ?? null);
            localStorage.setItem(STORAGE_KEYS.contractStatus, "signed");
            localStorage.setItem(STORAGE_KEYS.contractSignedAt, signedAt);
            if (previewUrl || status.fileUrl) {
              localStorage.setItem(STORAGE_KEYS.contractFileUrl, status.fileUrl ?? previewUrl ?? "");
            }
            await updateBankIdVerificationContractState({
              contract_status: true,
              contract_signed_at: signedAt,
              contract_file_path: status.fileUrl ?? previewUrl ?? null,
            });
            toast({
              title: "Contract signed",
              description: "The contract is signed and updated in the booking form.",
            });
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        setContractStatus("pending");
        toast({
          title: "Signing is still being registered",
          description: "Click 'Check contract status' in a few seconds.",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not fetch contract status after returning.";
        // Keep signed state from callback; polling can fail transiently.
        setContractError(message);
        localStorage.setItem(STORAGE_KEYS.contractError, message);
      } finally {
        setIsCheckingContract(false);
        clearContractQueryParams();
      }
    };

    void syncContractStatus();
  }, [contractDocumentId, contractSessionId, hasHandledContractReturn, toast]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
  const file = acceptedFiles[0];
  if (!file) return;

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    toast({
      title: "Invalid file type",
      description: "Please upload a valid file (JPEG, PNG or PDF)",
      variant: "destructive",
    });
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast({
      title: "File is too large",
      description: "Please upload a file smaller than 5 MB",
      variant: "destructive",
    });
    return;
  }

  setLicenseFile(file);
  
  // Create preview for images
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = () => {
      setLicensePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
}, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop,
  accept: {
    'image/jpeg': ['.jpeg', '.jpg'],
    'image/png': ['.png'],
    'application/pdf': ['.pdf']
  },
  maxFiles: 1,
});

const handleRemoveLicense = () => {
  setLicenseFile(null);
  setLicensePreview(null);
  // Clear the file input
  const fileInput = document.getElementById('driver-license-upload') as HTMLInputElement;
  if (fileInput) fileInput.value = '';
};

const uploadLicense = async (): Promise<string | null> => {
  if (!licenseFile) return null;

  try {
    setIsUploading(true);
    const fileExt = licenseFile.name.split('.').pop();
    const fileName = `${generateUniqueId()}.${fileExt}`;
    const filePath = `licenses/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('driver-licenses')
      .upload(filePath, licenseFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('driver-licenses')
      .getPublicUrl(filePath);

    return publicUrl;

  } catch (error) {
    console.error('Error uploading license:', error);
    toast({
      title: "Upload failed",
      description: "Could not upload driver's licence. Please try again.",
      variant: "destructive",
    });
    return null;
  } finally {
    setIsUploading(false);
  }
};

  // const onSubmit = (data: CustomerData) => {
  //   const customerData: CustomerData = {
  //     ...data,
  //     driverLicenseFile: licenseFile || undefined,
  const handleSubmit = async (e: React.FormEvent, data: CustomerData) => {
    e.preventDefault();

    try {
      if (!bankIdVerified) {
        toast({
          title: "BankID required",
          description: "Complete BankID verification before continuing.",
          variant: "destructive",
        });
        return;
      }

      if (licenseStatus !== "verified") {
        toast({
          title: "Driver's licence required",
          description: "Verify your driver's licence before continuing to payment.",
          variant: "destructive",
        });
        return;
      }

      if (SHOW_CONTRACT_SECTION) {
        let contractOk = serverContractSigned === true;
        if (!contractOk) {
          const synced = await syncVerificationFromServer();
          contractOk = synced === true;
        }
        if (!contractOk) {
          toast({
            title: "Contract required",
            description: "Sign the contract before continuing to the next step.",
            variant: "destructive",
          });
          return;
        }
      }

      if (SHOW_DRIVER_LICENSE_UPLOAD && !licenseFile) {
        toast({
          title: "Error",
          description: "Please upload a valid driver's licence",
          variant: "destructive",
        });
        return;
      }

      // Upload license first (skipped while manual upload is hidden)
      let licenseUrl: string | null = null;
      if (SHOW_DRIVER_LICENSE_UPLOAD) {
        licenseUrl = await uploadLicense();
        if (!licenseUrl) {
          toast({
            title: "Error",
            description: "Could not upload driver's licence. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      const customerData: CustomerData = {
        ...data,
        bookingForCompany: data.bookingForCompany ?? false,
        orgName: data.bookingForCompany ? data.orgName?.trim() : undefined,
        orgNo: data.bookingForCompany ? data.orgNo?.trim() : undefined,
        fullName: data.fullName || HIDDEN_CUSTOMER_DEFAULTS.fullName,
        phone: data.phone || HIDDEN_CUSTOMER_DEFAULTS.phone,
        city: initialData?.city || HIDDEN_CUSTOMER_DEFAULTS.city,
        driverLicenseFile: licenseUrl ?? undefined,
        bankIdVerifiedAt:
          localStorage.getItem(STORAGE_KEYS.bankIdVerifiedAt) ?? new Date().toISOString(),
        contractSignedAt: contractSignedAt ?? localStorage.getItem(STORAGE_KEYS.contractSignedAt) ?? undefined,
        contractFilePath: contractFileUrl ?? localStorage.getItem(STORAGE_KEYS.contractFileUrl) ?? undefined,
        contractDocumentId:
          contractDocumentId ?? localStorage.getItem(STORAGE_KEYS.contractDocumentId) ?? undefined,
        licenseVerified: licenseStatus === "verified",
        licenseCategories: licenseCategories.length ? licenseCategories : undefined,
        licenseVerifiedAt: licenseVerifiedAt ?? undefined,
      };
      
      onComplete(customerData);
      console.log('customer data', customerData);

    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "Could not submit the form. Please try again.",
        variant: "destructive",
      });
    }
  };

  const decorationSummary = (
    [
      bookingData.decorationFlowers && "Flowers",
      bookingData.decorationRibbon && "Ribbon",
      bookingData.decorationRedCarpets && "Red carpets",
      bookingData.decorationDriverNeed && "Driver requested",
    ].filter(Boolean) as string[]
  );
  
  return (
    <div className="space-y-6">
      {/* Booking Summary */}
      <div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
        <h3 className="mb-4 text-lg font-semibold text-[#E3C08D]">Summary</h3>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <div>
              <h4 className="font-medium text-[#b1bdc3]">{bookingData.car.name}</h4>
              <p className="text-sm text-[#9eabb1]">
                {format(new Date(bookingData.startDateTime), "PPP p", { locale: enUS })} –{" "}
                {format(new Date(bookingData.endDateTime), "PPP p", { locale: enUS })}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-[#9eabb1]" />
                <span className="text-[#b1bdc3]">{bookingData.pickupLocation}</span>
              </div>
              {bookingData.deliveryLocation && (
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-[#9eabb1]" />
                  <span className="text-[#b1bdc3]">Delivery: {bookingData.deliveryLocation}</span>
                </div>
              )}
              <div className="border-t border-[#46555d] pt-3 text-xs leading-relaxed text-[#9eabb1]">
                {decorationSummary.length > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-[#b1bdc3]">Decoration: </span>
                    {decorationSummary.join(", ")}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-[#E3C08D]">
              {formatPrice(bookingData.totalPrice)}
            </div>
            <div className="text-sm text-[#9eabb1]">
              Estimated total
            </div>
            <div className="mt-1 text-xs text-[#9eabb1]">
              {Math.ceil((new Date(bookingData.endDateTime).getTime() - new Date(bookingData.startDateTime).getTime()) / (1000 * 60 * 60 * 24))} days
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
        <h3 className="mb-4 text-lg font-semibold text-[#E3C08D]">BankID verification</h3>
        <div className="space-y-4 rounded-md border border-[#3f4d54] bg-[#1b2529] p-4">
          <div>
            <p className="text-sm font-semibold text-[#d0d9dd]">Identify yourself with BankID</p>
            <p className="mt-1 text-xs text-[#9eabb1]">
              Complete BankID to retrieve your name/phone number and continue to the contract.
            </p>
          </div>

          <button
            type="button"
            onClick={handleBankIDLogin}
            disabled={isBankIDPending || isInitializing || bankIdVerified}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#4e1f67] bg-gradient-to-r from-[#39134C] to-[#4A1A60] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(57,19,76,0.35)] transition-all hover:from-[#470D70] hover:to-[#5a1d7a] focus:outline-none focus:ring-2 focus:ring-[#6d2b8f]/60 focus:ring-offset-2 focus:ring-offset-[#232e33] disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-[1px]"
          >
            {isBankIDPending || bankIdStatus === "pending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting BankID ...
              </>
            ) : bankIdVerified ? (
              <>
                <CheckCircle className="h-4 w-4" />
                BankID confirmed
              </>
            ) : (
              "Login with BankID"
            )}
          </button>

          {bankIdVerified && (
            <div className="rounded-md border border-emerald-300/30 bg-emerald-100/95 px-3 py-1.5 text-center text-sm font-semibold text-emerald-800">
              BankID is verified
            </div>
          )}
          {!bankIdVerified && bankIdStatus === "failed" && (
            <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
              {bankIdError || "BankID verification failed. Please try again."}
            </div>
          )}
          {!bankIdVerified && bankIdStatus === "aborted" && (
            <div className="rounded-md border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
              BankID was cancelled. Please restart verification.
            </div>
          )}
        </div>

        {SHOW_CONTRACT_SECTION && (
          <div className="mt-4 space-y-3 rounded-md border border-[#3f4d54] bg-[#1b2529] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#d0d9dd]">Contract</p>
                <p className="mt-1 text-xs text-[#9eabb1]">
                  After BankID, the contract must be signed before payment.
                </p>
              </div>
              {isCheckingContract && <Loader2 className="h-4 w-4 animate-spin text-[#9eabb1]" />}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleCreateContract}
                disabled={
                  !bankIdVerified ||
                  serverContractSigned === true ||
                  serverContractSigned === null ||
                  isCheckingContract ||
                  isStartingContract
                }
                className="bg-[#E3C08D] text-black hover:bg-[#E3C08D]/90"
              >
                {isStartingContract ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting contract ...
                  </>
                ) : (
                  "Start contract"
                )}
              </Button>
              {pdfActionsAllowed && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreviewSignedDocument}
                    className="border-[#46555d] bg-[#232e33] text-[#b1bdc3] hover:bg-[#2d3a40]"
                  >
                    View PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadSignedDocument}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-[#46555d] bg-[#232e33] px-4 text-sm text-[#b1bdc3] hover:bg-[#2d3a40]"
                  >
                    Download PDF
                  </Button>
                </>
              )}
            </div>

            {serverContractSigned === true && (
              <div className="rounded-md border border-emerald-300/30 bg-emerald-100/95 px-3 py-1.5 text-center text-sm font-semibold text-emerald-800">
                {contractStatus === "existing"
                  ? "A previously signed contract was found - signing again is not necessary."
                  : "Contract is signed."}
              </div>
            )}
            {contractStatus === "failed" && (
              <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
                {contractError || "Contract signing failed. Please try again."}
              </div>
            )}
          </div>
        )}
      </div>

      <FormProvider {...form}>
        <form
          id="customer-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit((data) => handleSubmit(e, data))();
          }}
          className="space-y-6"
        >
          {/* Personal Information */}
          <div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
            <div className="mb-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-[#E3C08D]">
                <User className="h-5 w-5 text-primary" />
                Personal information
              </h3>
              <p className="mt-1 text-sm text-[#9eabb1]">Fill in your details to complete the booking</p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
                <FormField
                  control={form.control}
                  name="lastName"
                  rules={{ required: "Last name is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Last name <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="Last name ..."
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nin"
                  rules={{
                    required: "National ID number is required",
                    pattern: {
                      value: /^\d+$/,
                      message: "National ID number may only contain digits",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">National ID number <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="11-digit national ID number"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
                <FormField
                  control={form.control}
                  name="email"
                  rules={{
                    required: "Email is required",
                    pattern: {
                      value:
                        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Email <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="email"
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="name@example.com"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  rules={{ required: "Address is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Address <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="Street address ..."
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
                <FormField
                  control={form.control}
                  name="postalCode"
                  rules={{
                    required: "Postal code is required",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Postal code <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="1234"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="driverLicenseNumber"
                  rules={{ required: "Driver's licence number is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Driver's licence number <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="Your driver's licence number ..."
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Driver's licence verification (Statens vegvesen via Maskinporten) */}
              <div className="rounded-md border border-[#3f4d54] bg-[#1b2529] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#d0d9dd]">
                      <FileText className="h-4 w-4" />
                      Driver's licence verification
                    </p>
                    <p className="mt-0.5 text-[12px] tracking-wide text-[#9eabb1]">
                      Verify your driver's licence against Statens vegvesen using your national ID number and last name.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleVerifyLicense}
                    disabled={licenseStatus === "checking" || licenseStatus === "verified" || !bankIdVerified}
                    className="shrink-0 bg-[#E3C08D] text-black hover:bg-[#E3C08D]/90"
                  >
                    {licenseStatus === "checking" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying ...
                      </>
                    ) : licenseStatus === "verified" ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Verified
                      </>
                    ) : (
                      "Verify driver's licence"
                    )}
                  </Button>
                </div>

                {!bankIdVerified && (
                  <p className="text-[12px] tracking-wide text-amber-200/80">
                    Complete BankID verification before you can verify your driver's licence.
                  </p>
                )}

                {licenseStatus === "verified" && (
                  <div className="rounded-md border border-emerald-300/30 bg-emerald-100/95 px-3 py-2 text-sm text-emerald-900">
                    <p className="font-semibold">{licenseFullName || "Driver's licence verified"}</p>
                    {licenseCategories.length > 0 ? (
                      <p className="mt-0.5">
                        Licence categories: <span className="font-medium">{licenseCategories.join(", ")}</span>
                      </p>
                    ) : (
                      <p className="mt-0.5">No active driver's licence categories registered.</p>
                    )}
                  </div>
                )}

                {licenseStatus === "failed" && (
                  <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {licenseError || "Driver's licence could not be verified."}
                  </div>
                )}
              </div>

              <div className="rounded-md border border-[#3f4d54] bg-[#1b2529] p-4 space-y-3">
                <FormField
                  control={form.control}
                  name="bookingForCompany"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <FormLabel className="text-sm font-medium text-[#b1bdc3]">
                          Booking for company
                        </FormLabel>
                        <p className="text-xs text-[#9eabb1] mt-0.5">
                          Provide organization details for this booking.
                        </p>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={Boolean(field.value)}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border-[#46555d] accent-[#E3C08D]"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {bookingForCompany && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
                    <FormField
                      control={form.control}
                      name="orgNo"
                      rules={{
                        validate: (v) =>
                          !bookingForCompany || (v && v.trim().length > 0) || "Organization number is required",
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-[#b1bdc3]">
                            Organization number <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#232e33] text-[#b1bdc3]"
                              placeholder="e.g. 999999999"
                            />
                          </FormControl>
                          <FormMessage className="text-red-500 mt-1" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="orgName"
                      rules={{
                        validate: (v) =>
                          !bookingForCompany || (v && v.trim().length > 0) || "Organization name is required",
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-[#b1bdc3]">
                            Organization name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#232e33] text-[#b1bdc3]"
                              placeholder="Company AS"
                            />
                          </FormControl>
                          <FormMessage className="text-red-500 mt-1" />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

       {SHOW_DRIVER_LICENSE_UPLOAD && (
       <div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
  <div className="mb-6">
    <h3 className="flex items-center gap-2 text-lg font-semibold text-[#E3C08D]">
      <FileText className="h-5 w-5 text-primary" />
      Driver's licence
    </h3>
    <p className="mt-1 text-sm text-[#9eabb1]">
      Upload a valid driver's licence (JPEG, PNG or PDF, max 5 MB)
    </p>
  </div>

  <div className="space-y-4">
    <div
      {...getRootProps()}
      className={cn(
        "cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition-colors",
        isDragActive
          ? "border-[#E3C08D] bg-[#1b2529]"
          : "border-[#46555d] bg-[#1b2529] hover:border-[#E3C08D]",
      )}
    >
      <input
        {...getInputProps()}
        id="driver-license-upload"
        className="hidden"
      />

      {isUploading ? (
        <div className="flex flex-col items-center justify-center py-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
          <p className="text-[#9eabb1]">Uploading …</p>
        </div>
      ) : licensePreview ? (
        <div className="relative">
          {licenseFile?.type.startsWith('image/') ? (
            <img
              src={licensePreview}
              alt="Driver's licence preview"
              className="max-h-48 mx-auto mb-2 rounded-md"
            />
          ) : (
            <div className="mb-2 rounded-md bg-[#2a353a] p-4">
              <FileText className="h-12 w-12 mx-auto text-primary mb-2" />
              <p className="text-sm font-medium">{licenseFile?.name}</p>
              <p className="text-xs text-[#9eabb1]">
                {(licenseFile?.size || 0) / 1024 > 1024
                  ? `${((licenseFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB`
                  : `${Math.ceil((licenseFile?.size || 0) / 1024)} KB`}
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute -top-2 -right-2 rounded-full h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveLicense();
            }}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove file</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload className="mx-auto h-10 w-10 text-[#9eabb1]" />
          <p className="text-[#9eabb1]">
            {isDragActive
              ? "Drop the file here …"
              : "Drag and drop your driver's licence here, or click to select"}
          </p>
          <p className="text-sm text-[#9eabb1]">
            Supported: JPEG, PNG, PDF (max 5 MB)
          </p>
        </div>
      )}
    </div>
  </div>
</div>
       )}

          <Button
            type="submit"
            disabled={
              isBankIDPending ||
              bankIdStatus === "pending" ||
              licenseStatus === "checking" ||
              !bankIdVerified ||
              licenseStatus !== "verified" ||
              !form.formState.isValid
            }
            className="w-full bg-[#E3C08D] hover:bg-[#E3C08D]/90 text-white py-5 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            size="lg"
          >
            {isBankIDPending || bankIdStatus === "pending" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying BankID ...
              </>
            ) : licenseStatus === "checking" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying driver's licence ...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </FormProvider>
    </div>
  );
};