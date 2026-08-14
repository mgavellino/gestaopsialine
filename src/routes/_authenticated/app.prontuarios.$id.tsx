import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, History, Loader2, Check, Trash2, User, FileDown, FileText as FileTextIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { RecordEditor } from "@/components/app/RecordEditor";
import { RecordAttachments } from "@/components/app/RecordAttachments";
import { exportRecordAsPDF, exportRecordAsDOCX } from "@/lib/record-export";

export const Route = createFileRoute("/_authenticated/app/prontuarios/$id")({
  component: RecordEditorPage,
});

type Record = {
  id: string;
  owner_id: string;
  patient_id: string;
  title: string;
  content: object;
  content_text: string | null;
  version: number;
  updated_at: string;
};

type Version = {
  id: string;
  version: number;
  created_at: string;
  content: object;
};

type SaveStatus = "idle" | "typing" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 1500;
const VERSION_SNAPSHOT_MS = 60_000; // snapshot once per minute of active editing

function RecordEditorPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [record, setRecord] = useState<Record | null>(null);
  const [patientName, setPatientName] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<object | null>(null);
  const [contentText, setContentText] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshot = useRef<number>(Date.now());
  const dirty = useRef(false);

  // Load record
  useEffect(() => {
    if (!user) return;
    supabase
      .from("medical_records")
      .select("*")
      .eq("id", id)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          toast.error("Prontuário não encontrado");
          navigate({ to: "/app/prontuarios" });
          return;
        }
        const rec = data as Record;
        setRecord(rec);
        setTitle(rec.title);
        setContent(rec.content ?? { type: "doc", content: [{ type: "paragraph" }] });
        setContentText(rec.content_text ?? "");

        const { data: patient } = await supabase
          .from("patients")
          .select("full_name")
          .eq("id", rec.patient_id)
          .maybeSingle();
        if (patient) setPatientName(patient.full_name);
      });
  }, [id, user, navigate]);

  // Save logic
  const save = async (nextTitle: string, nextContent: object, nextText: string) => {
    if (!record) return;
    setStatus("saving");
    const shouldSnapshot = Date.now() - lastSnapshot.current >= VERSION_SNAPSHOT_MS;
    const nextVersion = shouldSnapshot ? record.version + 1 : record.version;

    const { error } = await supabase
      .from("medical_records")
      .update({
        title: nextTitle,
        content: nextContent as never,
        content_text: nextText,
        version: nextVersion,
      })
      .eq("id", record.id);

    if (error) {
      setStatus("error");
      toast.error("Erro ao salvar: " + error.message);
      return;
    }

    if (shouldSnapshot) {
      await supabase.from("medical_record_versions").insert({
        record_id: record.id,
        version: nextVersion,
        content: nextContent as never,
        created_by: user?.id,
      });
      lastSnapshot.current = Date.now();
      setRecord({ ...record, version: nextVersion });
    }

    dirty.current = false;
    setStatus("saved");
  };

  const scheduleSave = (nextTitle: string, nextContent: object, nextText: string) => {
    dirty.current = true;
    setStatus("typing");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save(nextTitle, nextContent, nextText);
    }, AUTOSAVE_MS);
  };

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirty.current && record) {
        save(title, content ?? {}, contentText);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before navigating away when unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleTitleChange = (next: string) => {
    setTitle(next);
    if (content) scheduleSave(next, content, contentText);
  };

  const handleEditorChange = (json: object, text: string) => {
    setContent(json);
    setContentText(text);
    scheduleSave(title, json, text);
  };

  const handleDelete = async () => {
    if (!record) return;
    if (!confirm("Excluir este prontuário e todas as versões?")) return;
    const { error } = await supabase.from("medical_records").delete().eq("id", record.id);
    if (error) return toast.error(error.message);
    toast.success("Prontuário excluído");
    navigate({ to: "/app/prontuarios" });
  };

  const loadVersions = async () => {
    if (!record) return;
    setShowHistory(true);
    const { data } = await supabase
      .from("medical_record_versions")
      .select("id, version, created_at, content")
      .eq("record_id", record.id)
      .order("version", { ascending: false });
    setVersions((data ?? []) as Version[]);
  };

  const restoreVersion = (v: Version) => {
    if (!confirm(`Restaurar versão v${v.version}? O conteúdo atual será sobrescrito.`)) return;
    setContent(v.content);
    setShowHistory(false);
    if (record) scheduleSave(title, v.content, contentText);
    toast.success(`Versão v${v.version} restaurada`);
  };

  if (!record || content === null) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Carregando prontuário...
      </div>
    );
  }

  return (
    <div className="max-w-4xl xl:max-w-5xl mx-auto px-1 sm:px-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-5">
        <Link
          to="/app/prontuarios"
          className="min-w-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
        <div className="flex flex-wrap min-w-0 items-center gap-1.5 justify-end">
          <SaveBadge status={status} />
          <button
            onClick={loadVersions}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors h-8 px-2.5 rounded-md hover:bg-surface"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Histórico </span>(v{record.version})
          </button>
          <button
            onClick={async () => {
              const { data: profile } = await supabase
                .from("profiles").select("full_name, crp").eq("id", user!.id).maybeSingle();
              exportRecordAsPDF(content ?? {}, {
                title: title || "Prontuário",
                patientName,
                professionalName: profile?.full_name ?? undefined,
                crp: profile?.crp ?? undefined,
              });
            }}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors h-8 px-2.5 rounded-md hover:bg-surface"
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </button>
          <button
            onClick={async () => {
              const { data: profile } = await supabase
                .from("profiles").select("full_name, crp").eq("id", user!.id).maybeSingle();
              await exportRecordAsDOCX(content ?? {}, {
                title: title || "Prontuário",
                patientName,
                professionalName: profile?.full_name ?? undefined,
                crp: profile?.crp ?? undefined,
              });
            }}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors h-8 px-2.5 rounded-md hover:bg-surface"
          >
            <FileTextIcon className="h-3.5 w-3.5" />
            DOCX
          </button>
          <button
            onClick={handleDelete}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors h-8 px-2.5 rounded-md hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        </div>
      </div>

      <div className="mb-4 md:mb-6">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Título do prontuário"
          className="w-full text-2xl md:text-3xl font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground/40"
        />
        {patientName && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {patientName}
          </div>
        )}
      </div>

      <ClientOnly fallback={<EditorSkeleton />}>
        <RecordEditor content={content} onChange={handleEditorChange} patientName={patientName} />
      </ClientOnly>

      {user && record && (
        <RecordAttachments ownerId={user.id} recordId={record.id} patientId={record.patient_id} />
      )}

      {showHistory && (
        <HistoryDrawer
          versions={versions}
          onClose={() => setShowHistory(false)}
          onRestore={restoreVersion}
        />
      )}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/30 p-8 min-h-[60vh] text-sm text-muted-foreground">
      Carregando editor...
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "saving" || status === "typing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground h-8 px-2.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        {status === "typing" ? "Digitando..." : "Salvando..."}
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[oklch(0.68_0.20_245)] h-8 px-2.5">
        <Check className="h-3 w-3" />
        Salvo
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive h-8 px-2.5">
        Erro ao salvar
      </span>
    );
  }
  return null;
}

function HistoryDrawer({
  versions,
  onClose,
  onRestore,
}: {
  versions: Version[];
  onClose: () => void;
  onRestore: (v: Version) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative ml-auto h-full w-full max-w-sm bg-background border-l border-border/60 overflow-y-auto">
        <div className="p-5 border-b border-border/60">
          <h3 className="text-lg font-semibold tracking-tight">Histórico de versões</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Snapshots automáticos a cada minuto de edição.
          </p>
        </div>
        <div className="p-3 space-y-1.5">
          {versions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Sem versões anteriores ainda. Continue editando — a primeira é gravada após 1 min.
            </p>
          ) : (
            versions.map((v) => (
              <button
                key={v.id}
                onClick={() => onRestore(v)}
                className="w-full text-left rounded-lg border border-border/40 bg-surface/40 hover:bg-surface px-4 py-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">v{v.version}</span>
                  <span className="text-[10px] text-muted-foreground">Restaurar</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(v.created_at), "d MMM yyyy 'às' HH:mm:ss", {
                    locale: ptBR,
                  })}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
