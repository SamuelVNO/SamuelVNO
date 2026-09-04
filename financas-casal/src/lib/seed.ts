import type { Category, DataSnapshot, Settings } from "./types";
import { nowISO, uid } from "./utils";

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  householdName: "Nossas Finanças",
  currency: "BRL",
  theme: "system",
  startDayOfMonth: 1,
  hideValues: false,
};

const EXPENSE_CATEGORIES: Array<[string, string, string]> = [
  ["Moradia", "#6366f1", "home"],
  ["Mercado", "#22c55e", "shopping-cart"],
  ["Alimentação", "#f97316", "utensils"],
  ["Transporte", "#0ea5e9", "car"],
  ["Saúde", "#ef4444", "heart-pulse"],
  ["Educação", "#8b5cf6", "graduation-cap"],
  ["Lazer", "#ec4899", "party-popper"],
  ["Compras", "#eab308", "shopping-bag"],
  ["Assinaturas", "#14b8a6", "repeat"],
  ["Pets", "#a855f7", "paw-print"],
  ["Cuidados pessoais", "#f43f5e", "sparkles"],
  ["Impostos e taxas", "#64748b", "landmark"],
  ["Presentes", "#d946ef", "gift"],
  ["Outros", "#94a3b8", "circle-ellipsis"],
];

const INCOME_CATEGORIES: Array<[string, string, string]> = [
  ["Salário", "#16a34a", "wallet"],
  ["Freelance", "#0d9488", "briefcase"],
  ["Investimentos", "#0891b2", "trending-up"],
  ["Reembolso", "#65a30d", "undo-2"],
  ["Presente recebido", "#c026d3", "gift"],
  ["Outras receitas", "#94a3b8", "circle-plus"],
];

export function defaultCategories(): Category[] {
  const mk = (kind: "income" | "expense") => ([name, color, icon]: [string, string, string]): Category => ({
    id: uid(),
    name,
    kind,
    color,
    icon,
  });
  return [
    ...EXPENSE_CATEGORIES.map(mk("expense")),
    ...INCOME_CATEGORIES.map(mk("income")),
  ];
}

export function emptySnapshot(names: [string, string] = ["Eu", "Esposa"]): DataSnapshot {
  const created = nowISO();
  return {
    version: SCHEMA_VERSION,
    people: [
      { id: uid(), name: names[0], color: "#6366f1" },
      { id: uid(), name: names[1], color: "#ec4899" },
    ],
    accounts: [
      {
        id: uid(),
        name: "Conta corrente",
        type: "checking",
        initialBalance: 0,
        color: "#6366f1",
        createdAt: created,
      },
      {
        id: uid(),
        name: "Dinheiro",
        type: "cash",
        initialBalance: 0,
        color: "#22c55e",
        createdAt: created,
      },
    ],
    categories: defaultCategories(),
    transactions: [],
    installments: [],
    recurrences: [],
    budgets: [],
    goals: [],
    settings: DEFAULT_SETTINGS,
    tombstones: [],
    updatedAt: created,
  };
}
