import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  bullets: z.string().min(3).max(4000),
  template: z.enum(["soap", "girp", "darn"]).default("soap"),
  patientContext: z.string().max(2000).optional(),
});

const PROMPTS: Record<string, string> = {
  soap: `Você é um assistente clínico para psicóloga. Receba os bullets abaixo da sessão e devolva uma evolução SOAP profissional, em português do Brasil, sem inventar dados. Formato exato:

## S — Subjetivo
[relato, queixa, contexto]

## O — Objetivo
[observação clínica: humor, afeto, fala, comportamento]

## A — Avaliação
[hipóteses, formulação, evolução]

## P — Plano
[intervenções, tarefas, próximos passos]

Se algum campo não tiver info nos bullets, escreva "—". Seja objetiva, evite jargão excessivo.`,
  girp: `Você é assistente clínico. Converta os bullets em evolução GIRP profissional em pt-BR:

## G — Objetivo da sessão
## I — Intervenção realizada
## R — Resposta da paciente
## P — Plano próxima sessão

Não invente. Campo sem info = "—".`,
  darn: `Converta os bullets em formato DARN-CAT (entrevista motivacional) em pt-BR, separando Desejo / Habilidade / Razões / Necessidade / Compromisso-Ativação-Tomada de ação.`,
};

export const generateSoapDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const system = PROMPTS[data.template];
    const userMsg = data.patientContext
      ? `Contexto da paciente: ${data.patientContext}\n\nBullets da sessão:\n${data.bullets}`
      : `Bullets da sessão:\n${data.bullets}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (response.status === 429) throw new Error("Muitas requisições. Aguarde.");
    if (response.status === 402) throw new Error("Créditos de IA esgotados.");
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Falha ao gerar rascunho.");
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content ?? "";
    return { markdown: text };
  });
