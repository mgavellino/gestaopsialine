import { useEffect, useRef, useState } from "react";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Bloco avulso: um único post-it de texto livre por profissional, sem prioridade
 * nem data — pra anotações soltas do dia a dia. Diferente do QuickNotes (lista de
 * lembretes/tarefas), aqui é só um bloco de texto que autosalva.
 */
export function ScratchNotes() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savedContent = useRef("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("scratch_notes")
        .select("content")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!error && data) {
        setContent(data.content);
        savedContent.current = data.content;
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async (value: string) => {
    if (!user || value === savedContent.current) return;
    setSaving(true);
    const { error } = await supabase
      .from("scratch_notes")
      .upsert({ owner_id: user.id, content: value }, { onConflict: "owner_id" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar a anotação");
      return;
    }
    savedContent.current = value;
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          Bloco de notas
        </div>
        {saving && <span className="text-[11px] text-muted-foreground">salvando…</span>}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        disabled={loading}
        placeholder="Anotações soltas, sem compromisso — recados, lembretes rápidos, o que quiser..."
        rows={6}
        className="w-full resize-y rounded-xl bg-surface/60 border border-border/40 px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}
