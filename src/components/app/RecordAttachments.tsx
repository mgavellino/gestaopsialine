import { useEffect, useRef, useState } from "react";
import { Paperclip, Trash2, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Doc = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type Props = {
  ownerId: string;
  recordId: string;
  patientId: string | null;
};

const MAX_BYTES = 25 * 1024 * 1024;

function prettySize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function RecordAttachments({ ownerId, recordId, patientId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, storage_path, mime_type, size_bytes, created_at")
      .eq("record_id", recordId)
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setDocs((data ?? []) as Doc[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const upload = async (files: FileList) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: máximo de 25 MB por arquivo`);
        continue;
      }
      const safe = file.name.replace(/[^\w.\-() ]+/g, "_");
      const path = `${ownerId}/${recordId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        continue;
      }
      const { error: dbErr } = await supabase.from("documents").insert({
        owner_id: ownerId,
        record_id: recordId,
        patient_id: patientId,
        name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (dbErr) {
        await supabase.storage.from("documents").remove([path]);
        toast.error(dbErr.message);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    toast.success("Anexos enviados");
    load();
  };

  const open = async (doc: Doc) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const remove = async (doc: Doc) => {
    if (!confirm(`Excluir "${doc.name}"?`)) return;
    await supabase.storage.from("documents").remove([doc.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Anexo removido");
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  };

  return (
    <div className="mt-6 rounded-2xl border border-border/60 bg-surface/40 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold">Anexos (testes, avaliações, laudos)</h2>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files?.length && upload(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          {uploading ? "Enviando..." : "Anexar arquivo"}
        </button>
      </div>

      {docs.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Nenhum anexo ainda. Aceita PDF, imagens, Word e planilhas (até 25 MB cada). Os arquivos
          ficam privados, visíveis só para você.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/50">
          {docs.map((d) => (
            <li key={d.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(d.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                  {d.size_bytes ? ` · ${prettySize(d.size_bytes)}` : ""}
                </div>
              </div>
              <button
                onClick={() => open(d)}
                className="h-9 px-3 rounded-lg border border-border/60 text-xs hover:bg-surface inline-flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Abrir
              </button>
              <button
                onClick={() => remove(d)}
                aria-label="Excluir anexo"
                className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
