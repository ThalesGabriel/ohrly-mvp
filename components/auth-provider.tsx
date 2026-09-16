"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isPermanentUser, isSupabaseConfigured } from "@/lib/supabase";
import { setPrivateStorageScope } from "@/lib/local-private";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isLocalMode: boolean;
  isAuthenticated: boolean;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isLocalMode = !isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isLocalMode);

  useEffect(() => {
    if (isLocalMode) {
      setPrivateStorageScope("local");
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const nextUser = data.session?.user ?? null;
      const permanentUser = isPermanentUser(nextUser) ? nextUser : null;
      setPrivateStorageScope(permanentUser?.id ?? null);
      setUser(permanentUser);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      const permanentUser = isPermanentUser(nextUser) ? nextUser : null;
      setPrivateStorageScope(permanentUser?.id ?? null);
      setUser(permanentUser);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [isLocalMode]);

  const sendMagicLink = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase não está configurado.");

    const { data: currentSession } = await supabase.auth.getSession();
    if (currentSession.session?.user?.is_anonymous) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    }

    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isLocalMode,
    isAuthenticated: isLocalMode || Boolean(user),
    sendMagicLink,
    signOut,
  }), [user, loading, isLocalMode, sendMagicLink, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return value;
}
