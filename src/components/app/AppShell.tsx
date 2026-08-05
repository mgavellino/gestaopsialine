import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Sparkles,
  Clock,
  Network,
  BookOpen,
  CalendarX,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Logo } from "@/components/brand/Logo";
import { AiAssistant } from "@/components/app/AiAssistant";
import { PomodoroWidget } from "@/components/app/PomodoroWidget";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const nav = [
  { to: "/app", icon: LayoutDashboard, label: "Início" },
  { to: "/app/agenda", icon: Calendar, label: "Agenda" },
  { to: "/app/pacientes", icon: Users, label: "Pacientes" },
  { to: "/app/prontuarios", icon: FileText, label: "Prontuários" },
  { to: "/app/financeiro", icon: CreditCard, label: "Financeiro" },
];

const navExtras = [
  { to: "/app/lista-espera", icon: Clock, label: "Lista de espera" },
  { to: "/app/bloqueios", icon: CalendarX, label: "Bloqueios" },
  { to: "/app/encaminhamentos", icon: Network, label: "Encaminhamentos" },
  { to: "/app/biblioteca", icon: BookOpen, label: "Biblioteca" },
  
  { to: "/app/configuracoes", icon: Settings, label: "Ajustes" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [user]);

  const initial = (user?.user_metadata?.full_name || user?.email || "A")
    .toString()
    .charAt(0)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Até logo, Aline.");
    navigate({ to: "/login", search: { redirect: "/app" } });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/60 bg-surface/40">
        <div className="p-5">
          <Logo />
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {nav.map((item) => {
            const active =
              item.to === "/app"
                ? location.pathname === "/app"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="mt-3 pt-3 border-t border-border/40 space-y-0.5">
            {navExtras.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-surface-elevated text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="p-3 border-t border-border/60 space-y-1">
          <button
            onClick={() => setAiOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-brand/10 text-brand hover:bg-brand/15 border border-brand/30 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Assistente IA
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border/60 flex items-center px-4 md:px-6 gap-3 bg-background/80 backdrop-blur sticky top-0 z-30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="md:hidden">
            <Logo showWordmark={false} size={28} />
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-9 w-9 grid place-items-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setAiOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/30 hover:bg-brand/15 transition-colors"
            aria-label="Abrir assistente IA"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">IA</span>
          </button>
          <Link
            to="/app/configuracoes"
            className="h-9 w-9 rounded-full bg-brand grid place-items-center text-sm font-medium text-primary-foreground overflow-hidden"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </Link>
        </header>
        <main className="flex-1 p-3 sm:p-4 md:p-8 pb-28 md:pb-8">{children}</main>
      </div>

      {/* Mobile drawer with full navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-background border-r border-border/60 flex flex-col overflow-y-auto">
            <div className="p-4 flex items-center justify-between border-b border-border/60">
              <Logo />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-0.5">
              {nav.map((item) => {
                const active =
                  item.to === "/app"
                    ? location.pathname === "/app"
                    : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-surface-elevated text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="mt-3 pt-3 border-t border-border/40 space-y-0.5">
                {navExtras.map((item) => {
                  const active = location.pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        active
                          ? "bg-surface-elevated text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
            <div className="p-3 border-t border-border/60 space-y-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAiOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm bg-brand/10 text-brand hover:bg-brand/15 border border-brand/30 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Assistente IA
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur">
        <div className="flex items-stretch justify-around h-16 px-1 pb-[env(safe-area-inset-bottom)]">
          {nav.slice(0, 5).map((item) => {
            const active =
              item.to === "/app"
                ? location.pathname === "/app"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] rounded-lg transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className={`h-5 w-5 ${active ? "text-brand" : ""}`} />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AiAssistant open={aiOpen} onOpenChange={setAiOpen} />
      <div className="hidden md:block">
        <PomodoroWidget />
      </div>
    </div>
  );
}
