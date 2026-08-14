import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Fingerprint } from "lucide-react";
import {
  biometricsSupported,
  biometricsEnabled,
  enableBiometrics,
  disableBiometrics,
} from "@/lib/biometrics";
import { useAuth } from "@/hooks/use-auth";
import { AvatarUpload } from "@/components/app/AvatarUpload";
import { ThemeToggle } from "@/components/theme/ThemeProvider";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    crp: "",
    specialty: "",
    avatar_url: "" as string | null | "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            full_name: data.full_name ?? "",
            phone: data.phone ?? "",
            crp: data.crp ?? "",
            specialty: data.specialty ?? "",
            avatar_url: data.avatar_url ?? "",
          });
        }
        setLoading(false);
      });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        phone: form.phone,
        crp: form.crp,
        specialty: form.specialty,
        avatar_url: form.avatar_url || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  };

  const persistAvatar = async (url: string | null) => {
    setForm((f) => ({ ...f, avatar_url: url ?? "" }));
    if (!user) return;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados profissionais exibidos no app e em documentos.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-border/60 bg-surface/40 p-6 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Aparência</div>
          <div className="text-xs text-muted-foreground mt-0.5">Modo claro ou escuro.</div>
        </div>
        <ThemeToggle />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <form
          onSubmit={handleSave}
          className="space-y-5 rounded-2xl border border-border/60 bg-surface/40 p-6"
        >
          {user && (
            <div>
              <label className="text-xs text-muted-foreground">Foto de perfil</label>
              <div className="mt-2">
                <AvatarUpload
                  value={form.avatar_url || null}
                  onChange={persistAvatar}
                  ownerId={user.id}
                  pathPrefix="profile"
                  fallback={form.full_name || user.email || "U"}
                />
              </div>
            </div>
          )}

          <Field label="Nome completo">
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="CRP">
              <input
                value={form.crp}
                onChange={(e) => setForm({ ...form, crp: e.target.value })}
                className={inputCls}
                placeholder="06/12345"
              />
            </Field>
          </div>
          <Field label="Especialidade">
            <input
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              className={inputCls}
              placeholder="Psicologia clínica, TCC, ..."
            />
          </Field>
          <Field label="Email">
            <input value={user?.email ?? ""} disabled className={`${inputCls} opacity-60`} />
          </Field>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      )}

      <BiometricSetting userLabel={user?.email ?? "Consultório"} />
    </div>
  );
}

function BiometricSetting({ userLabel }: { userLabel: string }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(biometricsSupported());
    setEnabled(biometricsEnabled());
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        disableBiometrics();
        setEnabled(false);
        toast.success("Bloqueio por biometria desativado");
      } else {
        const ok = await enableBiometrics(userLabel);
        if (ok) {
          setEnabled(true);
          toast.success("Biometria ativada neste aparelho");
        } else {
          toast.error("Não foi possível ativar a biometria");
        }
      }
    } catch {
      toast.error("Biometria cancelada ou indisponível neste aparelho");
    }
    setBusy(false);
  };

  return (
    <div className="mt-6 rounded-2xl border border-border/60 bg-surface/40 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <Fingerprint className="h-5 w-5 text-brand mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Abrir com biometria</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Mantém você conectada e usa a digital ou o Face ID deste aparelho para abrir o sistema,
            sem digitar e-mail e senha.
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`mt-4 w-full sm:w-auto h-11 px-5 rounded-lg text-sm font-medium disabled:opacity-60 ${
          enabled
            ? "border border-border/60 hover:bg-surface"
            : "bg-foreground text-background hover:opacity-90"
        }`}
      >
        {busy ? "Aguardando..." : enabled ? "Desativar biometria" : "Ativar biometria"}
      </button>
    </div>
  );
}

const inputCls =
  "w-full h-10 px-3 rounded-lg bg-background border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
