import { useEffect, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { biometricsEnabled, verifyBiometrics } from "@/lib/biometrics";

const SESSION_KEY = "bio.unlocked";

/**
 * Se a psicóloga ativou o bloqueio por biometria, pede a digital/Face ID
 * ao abrir o app. Enquanto a aba estiver aberta, não pede de novo.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const locked = biometricsEnabled() && sessionStorage.getItem(SESSION_KEY) !== "1";
    setNeedsUnlock(locked);
    setChecking(false);
    if (locked) void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyBiometrics();
      if (ok) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setNeedsUnlock(false);
      } else {
        setError("Não foi possível confirmar a biometria.");
      }
    } catch {
      setError("Biometria cancelada ou indisponível.");
    }
    setBusy(false);
  };

  if (checking) return null;
  if (!needsUnlock) return <>{children}</>;

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="w-full max-w-xs text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-brand/10 grid place-items-center">
          <Fingerprint className="h-8 w-8 text-brand" />
        </div>
        <h1 className="mt-5 text-lg font-semibold tracking-tight">Desbloquear</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use sua biometria para abrir o consultório.
        </p>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        <button
          onClick={unlock}
          disabled={busy}
          className="mt-6 w-full h-11 rounded-xl bg-foreground text-background text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
          {busy ? "Aguardando..." : "Usar biometria"}
        </button>
      </div>
    </div>
  );
}
