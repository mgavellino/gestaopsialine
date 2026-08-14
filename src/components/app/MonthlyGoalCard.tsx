import { useEffect, useState } from "react";
import { Target, Save, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { parseMoneyToCents, centsToInput } from "@/lib/money";


type Props = {
  receivedCents: number;
  pendingCents: number;
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function MonthlyGoalCard({ receivedCents, pendingCents }: Props) {
  const { user } = useAuth();
  const [goal, setGoal] = useState<number>(0);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("monthly_goal_cents")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as { monthly_goal_cents?: number } | null)?.monthly_goal_cents ?? 0;
        setGoal(v);
        setInput(v ? centsToInput(v) : "");

      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    const cents = parseMoneyToCents(input);
    if (Number.isNaN(cents) || cents < 0) return toast.error("Valor inválido");

    const { error } = await supabase.from("profiles").update({ monthly_goal_cents: cents }).eq("id", user.id);
    if (error) return toast.error(error.message);
    setGoal(cents);
    setEditing(false);
    toast.success("Meta salva");
  };

  // Forecast: received + pending (all that should land this month)
  const forecast = receivedCents + pendingCents;
  const pct = goal > 0 ? Math.min(100, (receivedCents / goal) * 100) : 0;
  const forecastPct = goal > 0 ? Math.min(100, (forecast / goal) * 100) : 0;
  const remaining = Math.max(0, goal - receivedCents);

  // Days info
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  const daysLeft = Math.max(0, daysInMonth - day);
  const dailyNeeded = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold">Meta do mês</h2>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {goal > 0 ? "Editar" : "Definir meta"}
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">R$</span>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              pattern="[0-9]*[,.]?[0-9]*"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onTouchStart={(e) => {
                e.currentTarget.focus();
                e.currentTarget.select();
              }}
              placeholder="10000"
              className="h-9 w-28 px-2 rounded-md bg-background border border-border/60 text-base sm:text-sm text-right"
            />
            <button
              onClick={save}
              className="h-8 w-8 grid place-items-center rounded-md bg-brand text-primary-foreground"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {goal === 0 ? (
        <p className="text-sm text-muted-foreground">
          Defina uma meta mensal pra acompanhar seu progresso e previsão.
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-2xl md:text-3xl font-semibold tracking-tight">{brl(receivedCents)}</span>
            <span className="text-xs text-muted-foreground">de {brl(goal)}</span>
          </div>

          {/* Progress bar with forecast overlay */}
          <div className="relative h-2.5 rounded-full bg-surface overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-brand/30"
              style={{ width: `${forecastPct}%` }}
              title="Previsão (recebido + a receber)"
            />
            <div
              className="absolute inset-y-0 left-0 bg-brand rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Atingido</div>
              <div className="font-semibold">{pct.toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Previsão
              </div>
              <div className="font-semibold">{brl(forecast)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{daysLeft}d restantes</div>
              <div className="font-semibold">
                {dailyNeeded > 0 ? `${brl(dailyNeeded)}/dia` : remaining === 0 ? "✓ batida" : "—"}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
