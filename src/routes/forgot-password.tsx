import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";

const schema = z.object({ email: z.string().email("Email inválido") });
type FormData = z.infer<typeof schema>;

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
  head: () => ({
    meta: [
      { title: "Recuperar senha — Aline Dias Psicóloga" },
      { name: "description", content: "Receba um link por e-mail para redefinir sua senha do Aline Dias Psicóloga." },
      { property: "og:title", content: "Recuperar senha — Aline Dias Psicóloga" },
      { property: "og:description", content: "Receba um link por e-mail para redefinir sua senha do Aline Dias Psicóloga." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ForgotPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Enviamos um link para seu email");
  };

  return (
    <AuthLayout title="Recuperar acesso" subtitle="Enviaremos um link para redefinir sua senha">
      {sent ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          Verifique sua caixa de entrada e siga as instruções.
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <input
              type="email"
              {...register("email")}
              className="mt-1 w-full h-10 px-3 rounded-lg bg-background border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar link"}
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-xs text-muted-foreground">
        <Link to="/login" search={{ redirect: "/app" }} className="text-foreground hover:underline">
          Voltar para login
        </Link>
      </p>
    </AuthLayout>
  );
}
