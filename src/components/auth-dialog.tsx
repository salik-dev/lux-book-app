import React, { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogPortal, DialogOverlay, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import logo from '../assets/logo.png';

const OTP_LENGTH = 4;
const OTP_TTL_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRING_REASONS = new Set(['expired', 'too_many_attempts', 'not_found', 'no_pending_otp']);

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function AuthDialog({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { requestLoginOtp, verifyLoginOtp } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [stepAnimation, setStepAnimation] = useState<'step-enter-forward' | 'step-enter-back'>('step-enter-forward');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);

  const [otp, setOtp] = useState('');
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [signedInAsAdmin, setSignedInAsAdmin] = useState(false);

  useEffect(() => {
    if (step !== 'otp') return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const expired = step === 'otp' && secondsLeft === 0;

  const resetOtp = () => {
    setOtp('');
    setOtpResetKey((k) => k + 1);
  };

  const resetAll = () => {
    setStep('email');
    setStepAnimation('step-enter-forward');
    setEmail('');
    setEmailError(null);
    setOtpError(null);
    resetOtp();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Let the close animation finish before resetting the form underneath it.
      setTimeout(resetAll, 200);
    }
  };

  const sendCode = async (targetEmail: string) => {
    setSendingCode(true);
    setEmailError(null);
    try {
      const result = await requestLoginOtp(targetEmail);
      if (result.error) {
        setEmailError(result.error);
        return false;
      }
      return true;
    } finally {
      setSendingCode(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmail(trimmedEmail);

    const sent = await sendCode(trimmedEmail);
    if (!sent) return;

    resetOtp();
    setOtpError(null);
    setSecondsLeft(OTP_TTL_SECONDS);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setStepAnimation('step-enter-forward');
    setStep('otp');
    toast({
      title: 'Code sent',
      description: `We've sent a ${OTP_LENGTH}-digit code to ${trimmedEmail}.`,
    });
  };

  const handleBack = () => {
    setStepAnimation('step-enter-back');
    setStep('email');
    setOtpError(null);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH || expired) return;

    setVerifying(true);
    setOtpError(null);
    try {
      const result = await verifyLoginOtp(email, otp);
      if (result.error) {
        setOtpError(result.error);
        triggerShake();
        if (result.reason && EXPIRING_REASONS.has(result.reason)) {
          setSecondsLeft(0);
        } else {
          resetOtp();
        }
        return;
      }
      setSignedInAsAdmin(!!result.isAdmin);
      setStep('success');
      setTimeout(() => {
        setOpen(false);
        toast({
          title: 'Welcome back',
          description: result.isAdmin && 'Welcome to admin dashboard.',
        });
        navigate(result.isAdmin ? '/admin' : '/bookings');
        setTimeout(resetAll, 200);
      }, 700);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || sendingCode) return;
    const sent = await sendCode(email);
    if (!sent) return;
    resetOtp();
    setOtpError(null);
    setSecondsLeft(OTP_TTL_SECONDS);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    toast({ title: 'Code resent', description: `We've sent a new code to ${email}.` });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-booking-sheet
          className="fixed top-0 right-0 left-auto z-50 h-screen w-full max-w-[440px] overflow-y-auto border-l border-[#334047] bg-[#232e33] p-0 text-[#b1bdc3] shadow-2xl"
        >
        <DialogPrimitive.Close className="absolute top-4 right-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4 text-[#b1bdc3]" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
        <div className="p-4 sm:px-8 sm:pb-0">
          <span className="flex justify-center">
            <img src={logo} alt="Logo" className="h-40 w-40 object-contain p-2" />
          </span>

          {step === 'email' && (
            <div key="email" className={stepAnimation}>
              <DialogHeader className="mb-2">
                <DialogTitle className="text-center text-2xl font-bold text-[#E3C08D]">
                  Welcome Back
                </DialogTitle>
              </DialogHeader>
              <p className="mb-6 text-center text-sm text-[#9eabb1]">
                Enter your email and we'll send you a one-time code to sign in.
              </p>

              <form onSubmit={handleEmailSubmit} className="mt-8 space-y-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#d0d9dd]">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9eabb1]" />
                    <Input
                      type="email"
                      autoFocus
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError(null);
                      }}
                      className="h-9 rounded-md border border-[#46555d] bg-[#1b2529] pl-10 text-[#b1bdc3] placeholder:text-[#7d8a91] focus-visible:ring-1 focus-visible:ring-[#E3C08D]"
                    />
                  </div>
                  {emailError && (
                    <p className="mt-2 text-xs text-red-400">{emailError}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={sendingCode}
                  className="h-9 w-full rounded-md bg-[#E3C08D] font-medium text-black hover:cursor-pointer hover:bg-[#d4b27f]"
                >
                  {sendingCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    'Send code'
                  )}
                </Button>
              </form>
            </div>
          )}

          {step === 'otp' && (
            <div key="otp" className={stepAnimation}>
              <button
                type="button"
                onClick={handleBack}
                className="mt-2 mb-4 flex items-center gap-1 text-sm text-[#9eabb1] hover:text-[#d0d9dd]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#E3C08D]/15">
                  <ShieldCheck className="h-5 w-5 text-[#E3C08D]" />
                </div>
                <DialogTitle className="text-2xl font-bold text-[#E3C08D]">
                  Enter verification code
                </DialogTitle>
                <p className="mt-2 text-sm text-[#9eabb1]">
                  We sent a {OTP_LENGTH}-digit code to <span className="text-[#d0d9dd]">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-5">
                <OtpInput
                  key={otpResetKey}
                  length={OTP_LENGTH}
                  value={otp}
                  onChange={(v) => {
                    setOtp(v);
                    setOtpError(null);
                  }}
                  disabled={expired || verifying}
                  autoFocus
                  shake={shake}
                  inputClassName="border-[#46555d] bg-[#1b2529] text-[#d0d9dd] focus-visible:ring-[#E3C08D]"
                />

                {otpError && (
                  <p className="text-center text-sm text-red-400">{otpError}</p>
                )}

                <p className={`text-center text-sm ${expired ? 'text-red-400' : 'text-[#9eabb1]'}`}>
                  {expired ? 'Code expired.' : `Code expires in ${formatTime(secondsLeft)}`}
                </p>

                <Button
                  type="submit"
                  disabled={verifying || expired || otp.length !== OTP_LENGTH}
                  className="h-9 w-full rounded-md bg-[#E3C08D] font-medium text-black hover:cursor-pointer hover:bg-[#d4b27f]"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </Button>

                <div className="pb-6 text-center">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || sendingCode}
                    className="text-sm text-[#E3C08D] hover:underline disabled:cursor-not-allowed disabled:text-[#7d8a91] disabled:no-underline"
                  >
                    {sendingCode
                      ? 'Resending...'
                      : resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : 'Resend code'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 'success' && (
            <div key="success" className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="success-pop mb-4 h-14 w-14 text-emerald-400" />
              <DialogTitle className="text-2xl font-bold text-[#E3C08D]">Verified</DialogTitle>
              <p className="mt-2 text-sm text-[#9eabb1]">
                {signedInAsAdmin ? 'Welcome to admin dashboard!' : 'Redirecting to your bookings...'}
              </p>
            </div>
          )}
        </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
