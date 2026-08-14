/**
 * Converte texto digitado em centavos, entendendo o formato brasileiro.
 * "3.000"    -> 300000  (ponto como separador de milhar)
 * "3.000,50" -> 300050
 * "3000,50"  -> 300050
 * "3000.50"  -> 300050  (ponto decimal, quando há 1-2 casas)
 * "3 mil"    -> NaN
 */
export function parseMoneyToCents(input: string): number {
  const raw = (input ?? "").trim().replace(/\s|R\$/gi, "");
  if (!raw) return NaN;
  if (!/^[0-9.,]+$/.test(raw)) return NaN;

  let normalized: string;
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma) {
    // vírgula é decimal; pontos são separador de milhar
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = raw.split(".");
    const last = parts[parts.length - 1];
    // ponto decimal só quando existe um único ponto com 1 ou 2 casas
    normalized = parts.length === 2 && last.length <= 2 ? raw : parts.join("");
  } else {
    normalized = raw;
  }

  const value = parseFloat(normalized);
  if (Number.isNaN(value)) return NaN;
  return Math.round(value * 100);
}

/** Formata centavos como "1.234,56" (sem símbolo). */
export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
