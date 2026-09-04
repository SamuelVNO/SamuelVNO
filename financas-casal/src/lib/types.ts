export type UUID = string;

export type TxKind = "income" | "expense" | "transfer";
export type AccountType =
  | "checking"
  | "savings"
  | "cash"
  | "credit_card"
  | "investment";

export type RecurrenceFreq = "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly";

export interface Person {
  id: UUID;
  name: string;
  color: string;
  archived?: boolean;
}

export interface Account {
  id: UUID;
  name: string;
  type: AccountType;
  initialBalance: number;
  color: string;
  /** Cartao de credito */
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  archived?: boolean;
  createdAt: string;
}

export interface Category {
  id: UUID;
  name: string;
  kind: "income" | "expense";
  color: string;
  icon: string;
  archived?: boolean;
}

export interface Transaction {
  id: UUID;
  kind: TxKind;
  description: string;
  /** Sempre positivo. O sinal vem de `kind`. */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  accountId: UUID;
  /** Destino, apenas para transferencias */
  toAccountId?: UUID;
  categoryId?: UUID;
  personId?: UUID;
  paid: boolean;
  notes?: string;
  /** Vinculo com uma compra parcelada */
  installmentId?: UUID;
  installmentNo?: number;
  installmentTotal?: number;
  /** Vinculo com uma conta fixa/recorrente */
  recurrenceId?: UUID;
  createdAt: string;
  updatedAt: string;
}

export interface Installment {
  id: UUID;
  description: string;
  /** Valor total da compra */
  totalAmount: number;
  count: number;
  /** YYYY-MM-DD da primeira parcela */
  firstDueDate: string;
  accountId: UUID;
  categoryId?: UUID;
  personId?: UUID;
  kind: "expense" | "income";
  notes?: string;
  createdAt: string;
}

export interface Recurrence {
  id: UUID;
  description: string;
  amount: number;
  kind: "income" | "expense";
  frequency: RecurrenceFreq;
  /** YYYY-MM-DD da primeira ocorrencia */
  startDate: string;
  /** YYYY-MM-DD opcional */
  endDate?: string;
  accountId: UUID;
  categoryId?: UUID;
  personId?: UUID;
  active: boolean;
  /** Ultima competencia YYYY-MM ja lancada */
  lastGenerated?: string;
  createdAt: string;
}

export interface Budget {
  id: UUID;
  categoryId: UUID;
  amount: number;
  /** YYYY-MM, ou null para valer todo mes */
  month?: string;
  createdAt: string;
}

export interface GoalContribution {
  id: UUID;
  amount: number;
  date: string;
  note?: string;
}

export interface Goal {
  id: UUID;
  name: string;
  targetAmount: number;
  targetDate?: string;
  color: string;
  contributions: GoalContribution[];
  archived?: boolean;
  createdAt: string;
}

export interface Settings {
  householdName: string;
  currency: string;
  theme: "light" | "dark" | "system";
  /** Dia em que o mes financeiro comeca (1 = dia 1) */
  startDayOfMonth: number;
  hideValues: boolean;
}

export type CollectionName =
  | "people"
  | "accounts"
  | "categories"
  | "transactions"
  | "installments"
  | "recurrences"
  | "budgets"
  | "goals";

export interface Tombstone {
  id: UUID;
  collection: CollectionName;
  at: string;
}

export interface DataSnapshot {
  version: number;
  people: Person[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  installments: Installment[];
  recurrences: Recurrence[];
  budgets: Budget[];
  goals: Goal[];
  settings: Settings;
  tombstones: Tombstone[];
  updatedAt: string;
}
