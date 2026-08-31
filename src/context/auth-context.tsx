import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthError, User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface OtpVerifyResult {
  error: string | null;
  reason?: string;
  attemptsRemaining?: number;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; isAdmin?: boolean }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  requestLoginOtp: (email: string) => Promise<{ error: string | null; waitSeconds?: number }>;
  verifyLoginOtp: (email: string, otp: string) => Promise<OtpVerifyResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/** Resolves whether the Supabase user is an active admin (same logic everywhere). */
async function resolveAdminForUser(user: User): Promise<boolean> {
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

    return adminUser?.is_active === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

async function applySession(
  session: Session | null,
  setSession: (s: Session | null) => void,
  setUser: (u: User | null) => void,
  setIsAdmin: (a: boolean) => void,
  setLoading: (l: boolean) => void
) {
  setSession(session);
  setUser(session?.user ?? null);
  if (session?.user) {
    const admin = await resolveAdminForUser(session.user);
    setIsAdmin(admin);
  } else {
    setIsAdmin(false);
  }
  setLoading(false);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async (session: Session | null) => {
      if (!mounted) return;
      await applySession(session, setSession, setUser, setIsAdmin, setLoading);
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

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error };

    const admin = data.user ? await resolveAdminForUser(data.user) : false;
    setSession(data.session ?? null);
    setUser(data.user ?? null);
    setIsAdmin(admin);
    setLoading(false);
    return { error: null, isAdmin: admin };
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata,
      },
    });
    return { error };
  };

  /** Exchanges a token_hash minted by an OTP-verify edge function for a real session, resolving admin status before returning (avoids the onAuthStateChange race). */
  const establishSessionFromTokenHash = async (tokenHash: string): Promise<OtpVerifyResult> => {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });
    if (error || !data.user) {
      return { error: error?.message ?? 'Something went wrong. Please try again.' };
    }
    const admin = await resolveAdminForUser(data.user);
    setSession(data.session ?? null);
    setUser(data.user);
    setIsAdmin(admin);
    setLoading(false);
    return { error: null, isAdmin: admin };
  };

  const requestLoginOtp = async (email: string): Promise<{ error: string | null; waitSeconds?: number }> => {
    const { data, error } = await supabase.functions.invoke('request-login-otp', {
      body: { email },
    });
    if (error || !data) {
      return { error: 'Something went wrong. Please try again.' };
    }
    if (!data.success) {
      return { error: data.message ?? 'Something went wrong. Please try again.', waitSeconds: data.waitSeconds };
    }
    return { error: null };
  };

  const verifyLoginOtp = async (email: string, otp: string): Promise<OtpVerifyResult> => {
    const { data, error } = await supabase.functions.invoke('verify-login-otp', {
      body: { email, otp },
    });
    if (error || !data?.success) {
      return { error: data?.message ?? 'Something went wrong. Please try again.', reason: data?.reason, attemptsRemaining: data?.attemptsRemaining };
    }
    return establishSessionFromTokenHash(data.tokenHash);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setLoading(false);
  };

  const value = {
    user,
    session,
    loading,
    isAdmin,
    signIn,
    signUp,
    signOut,
    requestLoginOtp,
    verifyLoginOtp,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
