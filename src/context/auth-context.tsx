import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { AuthError, User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface OtpVerifyResult {
  error: string | null;
  reason?: string;
  attemptsRemaining?: number;
  waitSeconds?: number;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

interface AdminResolution {
  isActive: boolean;
  role: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; isAdmin?: boolean }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  /** Legacy generic (any-user) email OTP — kept for compatibility. */
  requestLoginOtp: (email: string) => Promise<{ error: string | null; waitSeconds?: number }>;
  verifyLoginOtp: (email: string, otp: string) => Promise<OtpVerifyResult>;
  /** Admin-gated OTP sign-in (6-char alphanumeric code, registered admins only). */
  requestAdminOtp: (email: string) => Promise<{ error: string | null; reason?: string; waitSeconds?: number }>;
  verifyAdminOtp: (email: string, otp: string) => Promise<OtpVerifyResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Hard cap on an admin session regardless of Supabase token refresh (24h). */
const ADMIN_SESSION_MAX_MS = 24 * 60 * 60 * 1000;
const ADMIN_SESSION_KEY = 'admin-session-started-at';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/** Resolves whether the Supabase user is an active admin, and their role. */
async function resolveAdminForUser(user: User): Promise<AdminResolution> {
  try {
    let { data: adminUser } = await supabase
      .from('admin_users')
      .select('role, is_active, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminUser && user.email) {
      const { data: adminByEmail } = await supabase
        .from('admin_users')
        .select('id, role, is_active, email')
        .eq('email', user.email)
        .maybeSingle();

      if (adminByEmail) {
        await supabase
          .from('admin_users')
          .update({ user_id: user.id })
          .eq('id', adminByEmail.id);

        adminUser = adminByEmail;
      }
    }

    const isActive = adminUser?.is_active === true;
    return { isActive, role: isActive ? adminUser?.role ?? null : null };
  } catch (error) {
    console.error('Error checking admin status:', error);
    return { isActive: false, role: null };
  }
}

function readSessionStartedAt(): number | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeSessionStartedAt(ts: number) {
  try {
    localStorage.setItem(ADMIN_SESSION_KEY, String(ts));
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

function clearSessionStartedAt() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // ignore
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const applyResolution = (res: AdminResolution) => {
    setIsAdmin(res.isActive);
    setIsSuperAdmin(res.role === 'super_admin');
  };

  useEffect(() => {
    let mounted = true;

    const run = async (session: Session | null) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const res = await resolveAdminForUser(session.user);
        if (!mounted) return;
        applyResolution(res);
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
      }
      setLoading(false);
    };

    // Initial session: must finish admin check before loading=false (fixes /admin reload redirect)
    void supabase.auth.getSession().then(({ data: { session } }) => run(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void run(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const doSignOut = async (silent = false) => {
    const { error } = await supabase.auth.signOut();
    if (error && !silent) {
      console.error('Error signing out:', error);
    }
    clearSessionStartedAt();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setLoading(false);
  };

  // 24h hard cap: auto sign-out once the admin session passes its max lifetime.
  const expiredRef = useRef(false);
  useEffect(() => {
    if (!user || !isAdmin) {
      expiredRef.current = false;
      return;
    }

    // Anchor the session start on first authenticated render (covers reloads).
    let startedAt = readSessionStartedAt();
    if (startedAt == null) {
      startedAt = Date.now();
      writeSessionStartedAt(startedAt);
    }

    const checkExpiry = () => {
      const elapsed = Date.now() - (readSessionStartedAt() ?? Date.now());
      if (elapsed >= ADMIN_SESSION_MAX_MS && !expiredRef.current) {
        expiredRef.current = true;
        void doSignOut(true);
        toast.error('Your session has expired. Please sign in again.');
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 30 * 1000);
    return () => clearInterval(interval);
  }, [user, isAdmin]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    const res = data.user ? await resolveAdminForUser(data.user) : { isActive: false, role: null };
    setSession(data.session ?? null);
    setUser(data.user ?? null);
    applyResolution(res);
    setLoading(false);
    return { error: null, isAdmin: res.isActive };
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: metadata },
    });
    return { error };
  };

  /** Exchanges a token_hash minted by an OTP-verify edge function for a real session. */
  const establishSessionFromTokenHash = async (tokenHash: string): Promise<OtpVerifyResult> => {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    if (error || !data.user) {
      return { error: error?.message ?? 'Something went wrong. Please try again.' };
    }
    const res = await resolveAdminForUser(data.user);
    setSession(data.session ?? null);
    setUser(data.user);
    applyResolution(res);
    setLoading(false);
    // Start the 24h session clock fresh on an interactive sign-in.
    writeSessionStartedAt(Date.now());
    expiredRef.current = false;
    return { error: null, isAdmin: res.isActive, isSuperAdmin: res.role === 'super_admin' };
  };

  const requestLoginOtp = async (email: string) => {
    const { data, error } = await supabase.functions.invoke('request-login-otp', { body: { email } });
    if (error || !data) return { error: 'Something went wrong. Please try again.' };
    if (!data.success) return { error: data.message ?? 'Something went wrong. Please try again.', waitSeconds: data.waitSeconds };
    return { error: null };
  };

  const verifyLoginOtp = async (email: string, otp: string): Promise<OtpVerifyResult> => {
    const { data, error } = await supabase.functions.invoke('verify-login-otp', { body: { email, otp } });
    if (error || !data?.success) {
      return { error: data?.message ?? 'Something went wrong. Please try again.', reason: data?.reason, attemptsRemaining: data?.attemptsRemaining };
    }
    return establishSessionFromTokenHash(data.tokenHash);
  };

  const requestAdminOtp = async (email: string) => {
    const { data, error } = await supabase.functions.invoke('request-admin-otp', { body: { email } });
    if (error || !data) return { error: 'Something went wrong. Please try again.' };
    if (!data.success) {
      return { error: data.message ?? 'Something went wrong. Please try again.', reason: data.reason, waitSeconds: data.waitSeconds };
    }
    return { error: null };
  };

  const verifyAdminOtp = async (email: string, otp: string): Promise<OtpVerifyResult> => {
    const { data, error } = await supabase.functions.invoke('admin-verify-otp', { body: { email, otp } });
    if (error || !data?.success) {
      return { error: data?.message ?? 'Something went wrong. Please try again.', reason: data?.reason, attemptsRemaining: data?.attemptsRemaining };
    }
    return establishSessionFromTokenHash(data.tokenHash);
  };

  const signOut = async () => {
    await doSignOut();
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAdmin,
    isSuperAdmin,
    signIn,
    signUp,
    signOut,
    requestLoginOtp,
    verifyLoginOtp,
    requestAdminOtp,
    verifyAdminOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
