import React, { useCallback, useEffect, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useDropzone } from "react-dropzone";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Upload, User, FileText, MapPin, Truck, Loader2, X, CheckCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { BookingData, CustomerData } from "@/@types/data";
import { useToast } from "@/hooks/use-toast";
import { generateUniqueId } from "@/utils/carPlaceholder";
import { supabase } from '@/integrations/supabase/client';
import { useInitiateLogin } from "@/hooks/use-signicat-auth";
import { createContractSigning, getContractDocumentPreviewUrl, getContractStatus, UserData } from "@/api/signicat";

/** Values not shown in the form; still sent to complete the booking. */
const HIDDEN_CUSTOMER_DEFAULTS = {
  fullName: "",
  phone: "",
  city: "Oslo",
  dateOfBirth: new Date("1990-01-15"),
} as const;

const STORAGE_KEYS = {
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
} as const;

const SIGNED_STATUS_VALUES = ["signed", "completed", "complete", "success", "approved"];

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
  const { toast } = useToast();
  const { mutate: initiateLogin, isPending: isBankIDPending } = useInitiateLogin();

  const form = useForm<CustomerData>({
    defaultValues: {
      fullName: initialData?.fullName || HIDDEN_CUSTOMER_DEFAULTS.fullName,
      email: initialData?.email || "",
      phone: initialData?.phone || HIDDEN_CUSTOMER_DEFAULTS.phone,
      address: initialData?.address || "",
      postalCode: initialData?.postalCode || "",
      city: initialData?.city || HIDDEN_CUSTOMER_DEFAULTS.city,
      dateOfBirth: initialData?.dateOfBirth
        ? new Date(initialData.dateOfBirth)
        : new Date(HIDDEN_CUSTOMER_DEFAULTS.dateOfBirth),
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
        email: initialData.email || "",
        phone: initialData.phone || HIDDEN_CUSTOMER_DEFAULTS.phone,
        address: initialData.address || "",
        postalCode: initialData.postalCode || "",
        city: initialData.city || HIDDEN_CUSTOMER_DEFAULTS.city,
        dateOfBirth: initialData.dateOfBirth
          ? new Date(initialData.dateOfBirth)
          : new Date(HIDDEN_CUSTOMER_DEFAULTS.dateOfBirth),
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
      const savedDocumentId = localStorage.getItem(STORAGE_KEYS.contractDocumentId);
      const savedSessionId = localStorage.getItem(STORAGE_KEYS.contractSessionId);
      const savedSigningUrl = localStorage.getItem(STORAGE_KEYS.contractSigningUrl);
      const savedFileUrl = localStorage.getItem(STORAGE_KEYS.contractFileUrl);
      const savedSignedAt = localStorage.getItem(STORAGE_KEYS.contractSignedAt);
      const savedContractError = localStorage.getItem(STORAGE_KEYS.contractError) ?? "";

      if (savedContractStatus === "signed" || savedContractStatus === "existing") {
        setContractStatus(savedContractStatus);
      }
      if (savedDocumentId) setContractDocumentId(savedDocumentId);
      if (savedSessionId) setContractSessionId(savedSessionId);
      if (savedSigningUrl) setContractSigningUrl(savedSigningUrl);
      if (savedFileUrl) setContractFileUrl(savedFileUrl);
      if (savedSignedAt) setContractSignedAt(savedSignedAt);
      if (savedContractError) setContractError(savedContractError);
    } catch (error) {
      console.error("Failed to restore BankID/contract state:", error);
    }
  }, []);

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
  }, [bankIdVerified, bankIdUser, form]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("no-NO", {
      style: "currency",
      currency: "NOK",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const watchedEmail = form.watch("email");
  const hasSignedContractLocally =
    ["signed", "existing"].includes(contractStatus) ||
    Boolean(
      contractSignedAt ||
      localStorage.getItem(STORAGE_KEYS.contractSignedAt) ||
      contractFileUrl ||
      localStorage.getItem(STORAGE_KEYS.contractFileUrl)
    );

  const updateBankIdVerificationContractState = async (payload: {
    contract_status: boolean;
    contract_signed_at?: string | null;
    contract_file_path?: string | null;
  }) => {
    const verificationClient = supabase as any;
    const candidates: Array<{ column: string; value: string | null }> = [
      { column: "session_id", value: localStorage.getItem(STORAGE_KEYS.bankIdSessionId) },
      { column: "signicat_session_id", value: localStorage.getItem(STORAGE_KEYS.signicatSessionId) },
      { column: "external_reference", value: localStorage.getItem(STORAGE_KEYS.signicatExternalReference) },
      { column: "email", value: form.getValues("email") || null },
    ];

    for (const candidate of candidates) {
      if (!candidate.value) continue;
      try {
        const { error } = await verificationClient
          .from("bankid_verification")
          .update(payload)
          .eq(candidate.column, candidate.value);
        if (!error) return;
      } catch {
        // Try next candidate mapping.
      }
    }
  };

  useEffect(() => {
    if (!watchedEmail || contractStatus === "signed" || contractStatus === "existing") return;

    const timer = setTimeout(async () => {
      try {
        setIsCheckingContract(true);
        const verificationClient = supabase as any;
        const { data: verificationData } = await verificationClient
          .from("bankid_verification")
          .select("contract_status, contract_signed_at, contract_file_path")
          .eq("email", watchedEmail)
          .eq("contract_status", true)
          .not("contract_signed_at", "is", null)
          .order("contract_signed_at", { ascending: false })
          .limit(1);

        if (verificationData && verificationData.length > 0) {
          const row = verificationData[0] as { contract_signed_at: string | null; contract_file_path: string | null };
          const signedAt = row.contract_signed_at ?? new Date().toISOString();
          setContractStatus("existing");
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
  }, [watchedEmail, contractStatus]);

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
            startDateTime: bookingData.startDateTime.toISOString(),
            endDateTime: bookingData.endDateTime.toISOString(),
          },
          customerData: {
            ...form.getValues(),
            driverLicenseFile: undefined,
            dateOfBirth: form.getValues("dateOfBirth").toISOString(),
          },
        })
      );

      setBankIdStatus("pending");
      setBankIdError("");
      await initiateLogin();
    } catch (error) {
      const message = "Kunne ikke starte BankID-innlogging. Prøv igjen.";
      setBankIdStatus("failed");
      setBankIdError(message);
      localStorage.setItem(STORAGE_KEYS.bankIdStatus, "failed");
      localStorage.setItem(STORAGE_KEYS.bankIdError, message);
      toast({
        title: "Feil",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleCreateContract = async () => {
    try {
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
            startDateTime: bookingData.startDateTime.toISOString(),
            endDateTime: bookingData.endDateTime.toISOString(),
          },
          customerData: {
            ...form.getValues(),
            driverLicenseFile: undefined,
            dateOfBirth: form.getValues("dateOfBirth").toISOString(),
          },
        })
      );

      const bankIdSessionId = localStorage.getItem(STORAGE_KEYS.bankIdSessionId) ?? undefined;
      const result = await createContractSigning(bankIdSessionId, form.getValues("email"));
      const signatureUrl = result.signatureUrl ?? result.signingUrl;

      if (!signatureUrl) {
        throw new Error("Ufullstendig kontraktsvar fra Signicat.");
      }

      if (!result.documentId) {
        throw new Error("Mangler documentId fra Signicat.");
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
        title: "Kontrakt startet",
        description: "Fullfør signering i det nye vinduet, og sjekk deretter status.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kunne ikke starte kontraktssignering.";
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
        title: "Kontraktfeil",
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
        title: "Mangler dokument",
        description: "Start kontraktssignering først.",
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
          ? getContractDocumentPreviewUrl(contractDocumentId, "pdf")
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
          title: "Kontrakt signert",
          description: "Kontrakten er signert og klar.",
        });
      } else {
        setContractStatus("pending");
        toast({
          title: "Kontrakt ikke fullført ennå",
          description: `Nåværende status: ${status.status}`,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kunne ikke hente kontraktstatus.";
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
        title: "Kontraktfeil",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingContract(false);
    }
  };

  const fetchSignedDocumentBlob = async (type: "pdf" | "xml" = "pdf"): Promise<Blob> => {
    if (!contractDocumentId) {
      throw new Error("Mangler dokument-ID for kontrakt.");
    }

    const params = new URLSearchParams({
      documentId: contractDocumentId,
      type,
    });
    if (contractSessionId) {
      params.set("sessionId", contractSessionId);
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
      let message = "Kunne ikke hente signert dokument.";
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
      const blob = await fetchSignedDocumentBlob("pdf");
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      toast({
        title: "Kunne ikke vise PDF",
        description: error instanceof Error ? error.message : "Ukjent feil.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadSignedDocument = async () => {
    try {
      const blob = await fetchSignedDocumentBlob("pdf");
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "signed-contract.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      toast({
        title: "Kunne ikke laste ned PDF",
        description: error instanceof Error ? error.message : "Ukjent feil.",
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
      setContractError("Kontraktssignering ble avbrutt.");
      localStorage.setItem(STORAGE_KEYS.contractStatus, "failed");
      localStorage.setItem(STORAGE_KEYS.contractError, "Kontraktssignering ble avbrutt.");
      clearContractQueryParams();
      return;
    }

    if (contractSignType === "error") {
      setContractStatus("failed");
      setContractError("Signicat rapporterte en feil ved signering.");
      localStorage.setItem(STORAGE_KEYS.contractStatus, "failed");
      localStorage.setItem(STORAGE_KEYS.contractError, "Signicat rapporterte en feil ved signering.");
      clearContractQueryParams();
      return;
    }

    if (contractSignType !== "success") {
      clearContractQueryParams();
      return;
    }

    const provisionalDocumentId =
      contractDocumentId || localStorage.getItem(STORAGE_KEYS.contractDocumentId);
    const provisionalSignedAt =
      contractSignedAt || localStorage.getItem(STORAGE_KEYS.contractSignedAt) || new Date().toISOString();
    const provisionalFileUrl = provisionalDocumentId
      ? getContractDocumentPreviewUrl(provisionalDocumentId, "pdf")
      : null;

    setContractSignedAt(provisionalSignedAt);
    localStorage.setItem(STORAGE_KEYS.contractSignedAt, provisionalSignedAt);
    if (provisionalFileUrl) {
      setContractFileUrl(provisionalFileUrl);
      localStorage.setItem(STORAGE_KEYS.contractFileUrl, provisionalFileUrl);
    }

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
            const previewUrl = currentDocumentId
              ? getContractDocumentPreviewUrl(currentDocumentId, "pdf")
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
              title: "Kontrakt signert",
              description: "Kontrakten er signert og oppdatert i bestillingsskjemaet.",
            });
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        setContractStatus("pending");
        toast({
          title: "Signering registreres fortsatt",
          description: "Trykk 'Sjekk kontraktstatus' om noen sekunder.",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Kunne ikke hente kontraktstatus etter retur.";
        setContractStatus("failed");
        setContractError(message);
        localStorage.setItem(STORAGE_KEYS.contractStatus, "failed");
        localStorage.setItem(STORAGE_KEYS.contractError, message);
        await updateBankIdVerificationContractState({
          contract_status: false,
          contract_signed_at: null,
          contract_file_path: null,
        });
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
      title: "Ugyldig filtype",
      description: "Last opp en gyldig fil (JPEG, PNG eller PDF)",
      variant: "destructive",
    });
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast({
      title: "Filen er for stor",
      description: "Last opp en fil mindre enn 5 MB",
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
      title: "Opplasting feilet",
      description: "Kunne ikke laste opp førerkort. Prøv igjen.",
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
          title: "BankID kreves",
          description: "Fullfør BankID-verifisering før du går videre.",
          variant: "destructive",
        });
        return;
      }

      if (!hasSignedContractLocally) {
        const verificationClient = supabase as any;
        const { data: verificationRows } = await verificationClient
          .from("bankid_verification")
          .select("contract_status, contract_signed_at, contract_file_path")
          .eq("email", form.getValues("email"))
          .order("updated_at", { ascending: false })
          .limit(1);

        const verificationRow = verificationRows?.[0] as
          | { contract_status?: boolean; contract_signed_at?: string | null; contract_file_path?: string | null }
          | undefined;

        const verifiedAsSigned = Boolean(
          verificationRow?.contract_status &&
          (verificationRow?.contract_signed_at || verificationRow?.contract_file_path)
        );

        if (verifiedAsSigned) {
          const signedAt = verificationRow?.contract_signed_at ?? new Date().toISOString();
          const filePath = verificationRow?.contract_file_path ?? contractFileUrl ?? null;
          setContractStatus("signed");
          setContractSignedAt(signedAt);
          setContractFileUrl(filePath);
          localStorage.setItem(STORAGE_KEYS.contractStatus, "signed");
          localStorage.setItem(STORAGE_KEYS.contractSignedAt, signedAt);
          if (filePath) {
            localStorage.setItem(STORAGE_KEYS.contractFileUrl, filePath);
          }
        } else {
          toast({
            title: "Kontrakt kreves",
            description: "Signer kontrakten før du går videre til neste steg.",
            variant: "destructive",
          });
          return;
        }
      }

      if (!licenseFile) {
        toast({
          title: "Feil",
          description: "Last opp et gyldig førerkort",
          variant: "destructive",
        });
        return;
      }

      // Upload license first
      const licenseUrl = await uploadLicense();
      if (!licenseUrl) {
        toast({
          title: "Feil",
          description: "Kunne ikke laste opp førerkort. Prøv igjen.",
          variant: "destructive",
        });
        return;
      }

      const customerData: CustomerData = {
        ...data,
        fullName: data.fullName || HIDDEN_CUSTOMER_DEFAULTS.fullName,
        phone: data.phone || HIDDEN_CUSTOMER_DEFAULTS.phone,
        city: initialData?.city || HIDDEN_CUSTOMER_DEFAULTS.city,
        dateOfBirth: initialData?.dateOfBirth
          ? new Date(initialData.dateOfBirth)
          : new Date(HIDDEN_CUSTOMER_DEFAULTS.dateOfBirth),
        driverLicenseFile: licenseUrl,
        bankIdVerifiedAt:
          localStorage.getItem(STORAGE_KEYS.bankIdVerifiedAt) ?? new Date().toISOString(),
        contractSignedAt: contractSignedAt ?? localStorage.getItem(STORAGE_KEYS.contractSignedAt) ?? undefined,
        contractFilePath: contractFileUrl ?? localStorage.getItem(STORAGE_KEYS.contractFileUrl) ?? undefined,
        contractDocumentId:
          contractDocumentId ?? localStorage.getItem(STORAGE_KEYS.contractDocumentId) ?? undefined,
      };
      
      onComplete(customerData);
      console.log('customer data', customerData);

    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Feil",
        description: "Kunne ikke sende skjemaet. Prøv igjen.",
        variant: "destructive",
      });
    }
  };

  const decorationSummary = (
    [
      bookingData.decorationFlowers && "Blomster",
      bookingData.decorationRibbon && "Bånd",
      bookingData.decorationRedCarpets && "Røde løpere",
      bookingData.decorationDriverNeed && "Sjåfør ønskes",
    ].filter(Boolean) as string[]
  );
  
  return (
    <div className="space-y-6">
      {/* Booking Summary */}
      <div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
        <h3 className="mb-4 text-lg font-semibold text-[#E3C08D]">Oppsummering</h3>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <div>
              <h4 className="font-medium text-[#b1bdc3]">{bookingData.car.name}</h4>
              <p className="text-sm text-[#9eabb1]">
                {format(new Date(bookingData.startDateTime), "PPP p", { locale: nb })} –{" "}
                {format(new Date(bookingData.endDateTime), "PPP p", { locale: nb })}
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
                  <span className="text-[#b1bdc3]">Levering: {bookingData.deliveryLocation}</span>
                </div>
              )}
              <div className="border-t border-[#46555d] pt-3 text-xs leading-relaxed text-[#9eabb1]">
                <span className="font-medium text-[#b1bdc3]">Seter: </span>
                {bookingData.seatPricingMode === "daily-basis"
                  ? "Dagsbasis"
                  : "Fast pris"}
                {decorationSummary.length > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-[#b1bdc3]">Dekorasjon: </span>
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
              Estimert total
            </div>
            <div className="mt-1 text-xs text-[#9eabb1]">
              {Math.ceil((new Date(bookingData.endDateTime).getTime() - new Date(bookingData.startDateTime).getTime()) / (1000 * 60 * 60 * 24))} dager
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
        <h3 className="mb-4 text-lg font-semibold text-[#E3C08D]">BankID-verifisering</h3>
        <div className="space-y-4 rounded-md border border-[#3f4d54] bg-[#1b2529] p-4">
          <div>
            <p className="text-sm font-semibold text-[#d0d9dd]">Identifiser deg med BankID</p>
            <p className="mt-1 text-xs text-[#9eabb1]">
              Fullfør BankID for å hente navn/telefon og gå videre til kontrakt.
            </p>
          </div>

          <button
            type="button"
            onClick={handleBankIDLogin}
            disabled={bankIdVerified || isBankIDPending}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#4e1f67] bg-gradient-to-r from-[#39134C] to-[#4A1A60] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(57,19,76,0.35)] transition-all hover:from-[#470D70] hover:to-[#5a1d7a] focus:outline-none focus:ring-2 focus:ring-[#6d2b8f]/60 focus:ring-offset-2 focus:ring-offset-[#232e33] disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-[1px]"
          >
            {isBankIDPending || bankIdStatus === "pending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starter BankID ...
              </>
            ) : bankIdVerified ? (
              <>
                <CheckCircle className="h-4 w-4" />
                BankID bekreftet
              </>
            ) : (
              "Login with BankID"
            )}
          </button>

          {bankIdVerified && (
            <div className="rounded-md border border-emerald-300/30 bg-emerald-100/95 px-3 py-1.5 text-center text-sm font-semibold text-emerald-800">
              BankID er verifisert
            </div>
          )}
          {!bankIdVerified && bankIdStatus === "failed" && (
            <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
              {bankIdError || "BankID-verifisering feilet. Prøv igjen."}
            </div>
          )}
          {!bankIdVerified && bankIdStatus === "aborted" && (
            <div className="rounded-md border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
              BankID ble avbrutt. Start verifisering på nytt.
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3 rounded-md border border-[#3f4d54] bg-[#1b2529] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#d0d9dd]">Kontrakt</p>
              <p className="mt-1 text-xs text-[#9eabb1]">
                Etter BankID må kontrakten signeres før betaling.
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
                contractStatus === "signed" ||
                contractStatus === "existing" ||
                isCheckingContract ||
                isStartingContract
              }
              className="bg-[#E3C08D] text-black hover:bg-[#E3C08D]/90"
            >
              {isStartingContract ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starter kontrakt ...
                </>
              ) : (
                "Start kontrakt"
              )}
            </Button>
            {contractDocumentId && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviewSignedDocument}
                  className="border-[#46555d] bg-[#232e33] text-[#b1bdc3] hover:bg-[#2d3a40]"
                >
                  Vis PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadSignedDocument}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-[#46555d] bg-[#232e33] px-4 text-sm text-[#b1bdc3] hover:bg-[#2d3a40]"
                >
                  Last ned PDF
                </Button>
              </>
            )}
          </div>

          {(contractStatus === "signed" || contractStatus === "existing") && (
            <div className="rounded-md border border-emerald-300/30 bg-emerald-100/95 px-3 py-1.5 text-center text-sm font-semibold text-emerald-800">
              {contractStatus === "existing"
                ? "Tidligere signert kontrakt funnet - ny signering er ikke nødvendig."
                : "Kontrakt er signert."}
            </div>
          )}
          {contractStatus === "failed" && (
            <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
              {contractError || "Kontraktssignering feilet. Prøv igjen."}
            </div>
          )}
        </div>
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
                Personopplysninger
              </h3>
              <p className="mt-1 text-sm text-[#9eabb1]">Fyll inn opplysningene dine for å fullføre bestillingen</p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
                <FormField
                  control={form.control}
                  name="email"
                  rules={{
                    required: "E-post er påkrevd",
                    pattern: {
                      value:
                        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Ugyldig e-postadresse",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">E-post <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="email"
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="navn@eksempel.no"
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
                  rules={{ required: "Adresse er påkrevd" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Adresse <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="Gateadresse ..."
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
                    required: "Postnummer er påkrevd",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Postnummer <span className="text-red-500">*</span></FormLabel>
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
                  rules={{ required: "Førerkortnummer er påkrevd" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#b1bdc3]">Førerkortnummer <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            className="mt-1 block h-9 w-full rounded-md border border-[#46555d] bg-[#1b2529] text-[#b1bdc3]"
                            placeholder="Ditt førerkortnummer ..."
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500 mt-1" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

       {/* Driver's License Upload */}
<div className="rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3]">
  <div className="mb-6">
    <h3 className="flex items-center gap-2 text-lg font-semibold text-[#E3C08D]">
      <FileText className="h-5 w-5 text-primary" />
      Førerkort
    </h3>
    <p className="mt-1 text-sm text-[#9eabb1]">
      Last opp gyldig førerkort (JPEG, PNG eller PDF, maks 5 MB)
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
          <p className="text-[#9eabb1]">Laster opp …</p>
        </div>
      ) : licensePreview ? (
        <div className="relative">
          {licenseFile?.type.startsWith('image/') ? (
            <img
              src={licensePreview}
              alt="Forhåndsvisning av førerkort"
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
            <span className="sr-only">Fjern fil</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload className="mx-auto h-10 w-10 text-[#9eabb1]" />
          <p className="text-[#9eabb1]">
            {isDragActive
              ? "Slipp filen her …"
              : "Dra og slipp førerkortet her, eller klikk for å velge"}
          </p>
          <p className="text-sm text-[#9eabb1]">
            Støttet: JPEG, PNG, PDF (maks 5 MB)
          </p>
        </div>
      )}
    </div>
  </div>
</div>

          <Button
            type="submit"
            className="w-full bg-[#E3C08D] hover:bg-[#E3C08D]/90 text-white py-5 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:cursor-pointer"
            size="lg"
          >
            Fortsett
          </Button>
        </form>
      </FormProvider>
    </div>
  );
};