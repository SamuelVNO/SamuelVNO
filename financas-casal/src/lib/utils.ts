import type { AccountType, RecurrenceFreq } from "./types";

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const nowISO = () => new Date().toISOString();

/* ---------------------------------- datas --------------------------------- */

/** YYYY-MM-DD do dia de hoje no fuso local. */
export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Converte YYYY-MM-DD para Date local (sem pulo de fuso). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export const monthKey = (isoDate: string) => isoDate.slice(0, 7);

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function addMonthsToKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Soma meses preservando o dia quando possivel (31/01 + 1 mes = 28/02). */
export function addMonths(isoDate: string, delta: number): string {
  const d = parseISODate(isoDate);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISODate(target);
}

export function addDays(isoDate: string, delta: number): string {
  const d = parseISODate(isoDate);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS_PT[m - 1] ?? "";
  return short ? `${name.slice(0, 3)}/${String(y).slice(2)}` : `${name} de ${y}`;
}

export function formatDate(isoDate: string): string {
  const d = parseISODate(isoDate);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateShort(isoDate: string): string {
  const d = parseISODate(isoDate);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function relativeDueLabel(isoDate: string): string {
  const diff = daysBetween(todayISO(), isoDate);
  if (diff === 0) return "Vence hoje";
  if (diff === 1) return "Vence amanhã";
  if (diff === -1) return "Venceu ontem";
  if (diff > 1) return `Em ${diff} dias`;
  return `Atrasado ${Math.abs(diff)} dias`;
}

export function stepDate(isoDate: string, freq: RecurrenceFreq, times = 1): string {
  switch (freq) {
    case "weekly":
      return addDays(isoDate, 7 * times);
    case "monthly":
      return addMonths(isoDate, times);
    case "bimonthly":
      return addMonths(isoDate, 2 * times);
    case "quarterly":
      return addMonths(isoDate, 3 * times);
    case "semiannual":
      return addMonths(isoDate, 6 * times);
    case "yearly":
      return addMonths(isoDate, 12 * times);
  }
}

export const FREQ_LABEL: Record<RecurrenceFreq, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual",
};

/* --------------------------------- moeda ---------------------------------- */

export function formatMoney(value: number, hide = false): string {
  if (hide) return "R$ ••••";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCompact(value: number, hide = false): string {
  if (hide) return "••••";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace(".", ",")}k`;
  return formatMoney(value);
}

/** Converte texto digitado ("1.234,56", "1234.56", "R$ 90") em number. */
export function parseMoney(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d,.-]/g, "");
  const hasComma = cleaned.includes(",");
  const normalized = hasComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Arredonda para 2 casas evitando erro de ponto flutuante. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Divide um total em N parcelas sem perder centavos:
 * a diferenca do arredondamento vai para a primeira parcela.
 */
export function splitInstallments(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor((total * 100) / count) / 100;
  const parts = Array.from({ length: count }, () => base);
  const diff = round2(total - base * count);
  parts[0] = round2(parts[0] + diff);
  return parts;
}

/* --------------------------------- diversos -------------------------------- */

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  investment: "Investimento",
};

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
