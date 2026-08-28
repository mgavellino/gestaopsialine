/**
 * Bloqueio local por biometria (digital / Face ID / Windows Hello) via WebAuthn.
 *
 * Não substitui o login: serve para manter a sessão salva no aparelho e proteger
 * a abertura do app com a biometria do próprio dispositivo.
 * A credencial fica no aparelho; guardamos apenas o id dela + o domínio usado.
 */

const KEY = "bio.credential";
const HOST_KEY = "bio.host";

export function biometricsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials &&
    !!window.isSecureContext
  );
}

/** Android (Samsung/Chrome) e iOS só aceitam se houver autenticador de plataforma. */
export async function platformBiometricsAvailable(): Promise<boolean> {
  if (!biometricsSupported()) return false;
  try {
    const fn = (
      window.PublicKeyCredential as unknown as {
        isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
      }
    ).isUserVerifyingPlatformAuthenticatorAvailable;
    if (typeof fn !== "function") return false;
    return await fn.call(window.PublicKeyCredential);
  } catch {
    return false;
  }
}

export function biometricsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!localStorage.getItem(KEY)) return false;
  // Se o domínio mudou (ex.: outro endereço do site), a credencial não vale mais.
  const host = localStorage.getItem(HOST_KEY);
  if (host && host !== window.location.hostname) {
    disableBiometrics();
    return false;
  }
  return true;
}

export function disableBiometrics() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(HOST_KEY);
}

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): ArrayBuffer {
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

function randomChallenge(): ArrayBuffer {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  crypto.getRandomValues(bytes);
  return bytes.buffer;
}

/** Mensagem amigável para os erros mais comuns no Android/iOS. */
export function biometricErrorMessage(err: unknown): string {
  const e = err as { name?: string; message?: string } | null;
  switch (e?.name) {
    case "NotAllowedError":
      return "Biometria cancelada ou o tempo esgotou. Toque no botão e confirme a digital.";
    case "InvalidStateError":
      return "Este aparelho já tem a biometria registrada para o app.";
    case "NotSupportedError":
      return "Este aparelho não oferece biometria compatível para o navegador.";
    case "SecurityError":
      return "A biometria só funciona no endereço oficial do site (https).";
    case "AbortError":
      return "Pedido de biometria interrompido. Tente novamente.";
    default:
      return e?.message || "Não foi possível usar a biometria.";
  }
}

/** Registra a biometria do aparelho. Precisa ser chamada a partir de um toque do usuário. */
export async function enableBiometrics(userLabel: string): Promise<boolean> {
  if (!biometricsSupported()) return false;
  const userId = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(userId);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: "Consultório", id: window.location.hostname },
      user: { id: userId.buffer, name: userLabel, displayName: userLabel },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        // "required" cria credencial descobrível — no Android permite desbloquear
        // sem depender do id salvo no navegador.
        residentKey: "required",
        requireResidentKey: true,
      },
      excludeCredentials: [],
      timeout: 120_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!credential) return false;
  localStorage.setItem(KEY, bufToB64(credential.rawId));
  localStorage.setItem(HOST_KEY, window.location.hostname);
  return true;
}

/** Pede a biometria para desbloquear. Retorna true quando confirmada. */
export async function verifyBiometrics(): Promise<boolean> {
  if (!biometricsSupported()) return false;
  const stored = localStorage.getItem(KEY);
  if (!stored) return false;

  const base = {
    challenge: randomChallenge(),
    rpId: window.location.hostname,
    userVerification: "required" as const,
    timeout: 120_000,
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        ...base,
        allowCredentials: [
          { type: "public-key", id: b64ToBuf(stored), transports: ["internal"] },
        ],
      },
    });
    if (assertion) return true;
  } catch (err) {
    const name = (err as { name?: string }).name;
    // No Android o id salvo pode não ser aceito; tenta com credencial descobrível.
    if (name !== "NotAllowedError" && name !== "AbortError") throw err;
  }

  const assertion = await navigator.credentials.get({
    publicKey: { ...base, allowCredentials: [] },
  });
  return !!assertion;
}
