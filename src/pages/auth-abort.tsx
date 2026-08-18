import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function AuthAbortPage() {
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem("bankid_auth_status", "aborted");
    localStorage.setItem("bankid_auth_error", "BankID-innlogging ble avbrutt.");
    localStorage.removeItem("bankid_verified");
    localStorage.removeItem("bankid_verified_at");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-[#334047] bg-[#232e33] p-6 text-[#b1bdc3] shadow-xl">
        <div className="mb-2 flex items-center gap-2 text-amber-300">
          <AlertCircle className="h-5 w-5" />
          <h1 className="text-xl font-semibold">BankID avbrutt</h1>
        </div>
        <p className="text-sm text-[#9eabb1]">
          Du avbrøt BankID-innloggingen. Start på nytt når du er klar.
        </p>
        <Button
          className="mt-4 w-full bg-[#334047] text-[#b1bdc3] hover:bg-[#3d4b53]"
          onClick={() => navigate("/", { replace: true })}
        >
          Til forsiden
        </Button>
      </div>
    </div>
  );
}
