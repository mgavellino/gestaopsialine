/**
 * Bloqueio local por biometria (Face ID / digital / Windows Hello) usando WebAuthn.
 *
 * Não substitui o login: o objetivo é permitir manter a sessão salva no aparelho
 * e proteger a abertura do app com a biometria do próprio dispositivo.
 * A credencial fica registrada no aparelho; guardamos apenas o id dela localmente.
 */

const KEY = "bio.credential";

export function biometricsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials
  );
}

export function biometricsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(KEY);
}

export function disableBiometrics() {
  localStorage.removeItem(KEY);
}

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bytes = new Uint8Array(new ArrayBuffer(b64.length));
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  void bytes;
  return out.buffer;
}

function randomChallenge(): ArrayBuffer {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  crypto.getRandomValues(bytes);
  return bytes.buffer;
}

/** Registra a biometria do aparelho. Retorna true se deu certo. */
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
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!credential) return false;
  localStorage.setItem(KEY, bufToB64(credential.rawId));
  return true;
}

/** Pede a biometria para desbloquear. Retorna true quando confirmada. */
export async function verifyBiometrics(): Promise<boolean> {
  const stored = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  if (!stored || !biometricsSupported()) return false;

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ type: "public-key", id: b64ToBuf(stored) }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return !!assertion;
}
