import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { BiometricGate } from "@/components/app/BiometricGate";


function hasStoredSession() {
  if (typeof window === "undefined") return false;
  try {
    return Object.keys(window.localStorage).some(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
    );
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!hasStoredSession()) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href || "/app" },
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <BiometricGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </BiometricGate>
  );
}

