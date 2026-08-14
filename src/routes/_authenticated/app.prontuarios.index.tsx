import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Plus, ChevronRight, Search, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Patient } from "@/components/app/PatientFormSheet";
import { ANAMNESIS_TEMPLATES } from "@/lib/anamnesis-templates";

export const Route = createFileRoute("/_authenticated/app/prontuarios/")({
  component: RecordsListPage,
});

type RecordRow = {
  id: string;
  title: string;
  patient_id: string;
  updated_at: string;
  version: number;
  content_text: string | null;
};

function RecordsListPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [templateId, setTemplateId] = useState("blank");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("medical_records")
        .select("id, title, patient_id, updated_at, version, content_text")
        .order("updated_at", { ascending: false }),
      supabase.from("patients").select("*").order("full_name"),
    ]).then(([r, p]) => {
      if (r.error) toast.error(r.error.message);
      else setRecords((r.data ?? []) as RecordRow[]);
      if (!p.error) setPatients((p.data ?? []) as Patient[]);
      setLoading(false);
    });
  }, [user]);

  const filtered = records.filter((r) => {
    const q = query.toLowerCase();
    if (!q) return true;
    const patient = patients.find((p) => p.id === r.patient_id);
    return (
      r.title.toLowerCase().includes(q) ||
      patient?.full_name.toLowerCase().includes(q) ||
      r.content_text?.toLowerCase().includes(q)
    );
  });

  const handleCreate = async () => {
    if (!selectedPatient || !user) return toast.error("Selecione um paciente");
    const template = ANAMNESIS_TEMPLATES.find((t) => t.id === templateId) ?? ANAMNESIS_TEMPLATES[0];
    setCreating(true);
    const { data, error } = await supabase
      .from("medical_records")
      .insert({
        owner_id: user.id,
        patient_id: selectedPatient,
        title: template.id === "blank" ? "Novo prontuário" : template.label,
        content: template.doc as never,
        content_text: "",
      })
      .select("id")
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    setShowCreate(false);
    window.location.href = `/app/prontuarios/${data.id}`;
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Prontuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Editor com autosave em tempo real e histórico de versões.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background text-sm font-medium px-4 py-2.5 hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Novo prontuário
        </button>
      </div>

      {showCreate && (
        <div className="mb-5 rounded-2xl border border-border/60 bg-surface/40 p-5">
          <label className="text-xs text-muted-foreground">
            Paciente para o novo prontuário
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full sm:flex-1 h-11 px-3 rounded-lg bg-background border border-border/60 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="">Selecione...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              disabled={creating || !selectedPatient}
              className="w-full sm:w-auto h-11 px-5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {creating ? "Criando..." : "Criar prontuário"}
            </button>
          </div>

          <div className="mt-4">
            <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[oklch(0.68_0.20_245)]" />
              Modelo de anamnese
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ANAMNESIS_TEMPLATES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    templateId === t.id
                      ? "border-[oklch(0.55_0.22_260)]/50 bg-[oklch(0.55_0.22_260)]/10"
                      : "border-border/60 bg-background/40 hover:bg-surface"
                  }`}
                >
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t.specialty}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{t.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {patients.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Cadastre um paciente antes de criar um prontuário.{" "}
              <Link to="/app/pacientes" className="text-[oklch(0.68_0.20_245)] hover:underline">
                Ir para pacientes
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título, paciente ou conteúdo"
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface border border-border/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface/40 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {query ? "Nenhum prontuário encontrado." : "Nenhum prontuário ainda."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {filtered.map((r) => {
              const patient = patients.find((p) => p.id === r.patient_id);
              const preview = (r.content_text ?? "").trim().slice(0, 120);
              return (
                <li key={r.id}>
                  <Link
                    to="/app/prontuarios/$id"
                    params={{ id: r.id }}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-surface/60 transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-surface-elevated grid place-items-center shrink-0">
                      <FileText className="h-5 w-5 text-[oklch(0.68_0.20_245)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium truncate">{r.title}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          v{r.version}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {patient?.full_name ?? "Paciente removido"} ·{" "}
                        {format(new Date(r.updated_at), "d MMM yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </div>
                      {preview && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {preview}
                          {(r.content_text?.length ?? 0) > 120 ? "..." : ""}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
