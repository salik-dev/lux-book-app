import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthError, User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; isAdmin?: boolean }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
