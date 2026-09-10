import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isPasswordRecoveryRedirect() {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  return hash.get("type") === "recovery" || search.get("type") === "recovery";
}

function redirectToResetPassword() {
  if (typeof window === "undefined" || window.location.pathname === "/reset-password") return;
  window.location.replace(`/reset-password${window.location.search}${window.location.hash}`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPasswordRecoveryRedirect() && window.location.pathname !== "/reset-password") {
      redirectToResetPassword();
      return;
    }

    // Nunca deixe uma falha de configuração derrubar a tela toda:
    // sem sessão o app apenas mostra a tela de login.
    let unsubscribe = () => {};
    try {
      // Set up listener FIRST
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        setSession(newSession);
        setLoading(false);
        if (event === "PASSWORD_RECOVERY") {
          redirectToResetPassword();
        }
      });
      unsubscribe = () => subscription.unsubscribe();

      // Then check current session
      supabase.auth
        .getSession()
        .then(({ data }) => {
          setSession(data.session);
          setLoading(false);
          if (isPasswordRecoveryRedirect()) redirectToResetPassword();
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
    }
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
