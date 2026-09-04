import type {
  Account,
  Budget,
  Category,
  DataSnapshot,
  Goal,
  Installment,
  Transaction,
} from "./types";
import {
  addMonthsToKey,
  daysBetween,
  monthKey,
  monthRange,
  round2,
  todayISO,
} from "./utils";

/* --------------------------------- saldos --------------------------------- */

/**
 * Saldo de uma conta considerando apenas lancamentos efetivados (`paid`).
 * Cartao de credito devolve a fatura em aberto como valor negativo.
 */
export function accountBalance(account: Account, txs: Transaction[], includePending = false): number {
  let total = account.type === "credit_card" ? 0 : account.initialBalance;
  for (const t of txs) {
    if (!t.paid && !includePending) continue;
    if (t.kind === "transfer") {
      if (t.accountId === account.id) total -= t.amount;
      if (t.toAccountId === account.id) total += t.amount;
      continue;
    }
    if (t.accountId !== account.id) continue;
    total += t.kind === "income" ? t.amount : -t.amount;
  }
  return round2(total);
}

/** Soma dos saldos das contas que compoem o patrimonio liquido. */
export function netWorth(accounts: Account[], txs: Transaction[]): number {
  return round2(
    accounts
      .filter((a) => !a.archived)
      .reduce((sum, a) => sum + accountBalance(a, txs), 0),
  );
}

/** Saldo disponivel: apenas contas de saque (exclui cartao de credito). */
export function availableBalance(accounts: Account[], txs: Transaction[]): number {
  return round2(
    accounts
      .filter((a) => !a.archived && a.type !== "credit_card")
      .reduce((sum, a) => sum + accountBalance(a, txs), 0),
  );
}

/** Total em aberto nos cartoes de credito (valor positivo = divida). */
export function creditCardDebt(accounts: Account[], txs: Transaction[]): number {
  return round2(
    accounts
      .filter((a) => !a.archived && a.type === "credit_card")
      .reduce((sum, a) => sum - accountBalance(a, txs, true), 0),
  );
}

/* --------------------------- fatura do cartao ----------------------------- */

export interface CardInvoice {
  month: string;
  total: number;
  paid: number;
  open: number;
  transactions: Transaction[];
  closingDate?: string;
  dueDate?: string;
}

export function cardInvoice(card: Account, txs: Transaction[], month: string): CardInvoice {
  const { start, end } = monthRange(month);
  const list = txs.filter(
    (t) =>
      t.accountId === card.id &&
      t.kind !== "transfer" &&
      t.date >= start &&
      t.date <= end,
  );
  const total = round2(
    list.reduce((s, t) => s + (t.kind === "expense" ? t.amount : -t.amount), 0),
  );
  const paid = round2(
    list.filter((t) => t.paid).reduce((s, t) => s + (t.kind === "expense" ? t.amount : -t.amount), 0),
  );
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    month,
    total,
    paid,
    open: round2(total - paid),
    transactions: list.sort((a, b) => b.date.localeCompare(a.date)),
    closingDate: card.closingDay ? `${month}-${pad(Math.min(card.closingDay, lastDay))}` : undefined,
    dueDate: card.dueDay ? `${month}-${pad(Math.min(card.dueDay, lastDay))}` : undefined,
  };
}

/* -------------------------------- resumo ---------------------------------- */

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  balance: number;
  incomePaid: number;
  expensePaid: number;
  incomePending: number;
  expensePending: number;
  overdue: number;
  count: number;
}

export function transactionsOfMonth(txs: Transaction[], month: string): Transaction[] {
  const { start, end } = monthRange(month);
  return txs.filter((t) => t.date >= start && t.date <= end);
}

export function monthSummary(txs: Transaction[], month: string): MonthSummary {
  const list = transactionsOfMonth(txs, month).filter((t) => t.kind !== "transfer");
  const today = todayISO();
  let income = 0, expense = 0, incomePaid = 0, expensePaid = 0, overdue = 0;

  for (const t of list) {
    if (t.kind === "income") {
      income += t.amount;
      if (t.paid) incomePaid += t.amount;
    } else {
      expense += t.amount;
      if (t.paid) expensePaid += t.amount;
      else if (t.date < today) overdue += t.amount;
    }
  }

  return {
    month,
    income: round2(income),
    expense: round2(expense),
    balance: round2(income - expense),
    incomePaid: round2(incomePaid),
    expensePaid: round2(expensePaid),
    incomePending: round2(income - incomePaid),
    expensePending: round2(expense - expensePaid),
    overdue: round2(overdue),
    count: list.length,
  };
}

/** Serie dos ultimos N meses terminando em `month` (inclusive). */
export function monthlySeries(txs: Transaction[], month: string, months = 6): MonthSummary[] {
  return Array.from({ length: months }, (_, i) =>
    monthSummary(txs, addMonthsToKey(month, i - months + 1)),
  );
}

/* ---------------------------- por categoria ------------------------------- */

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string;
  total: number;
  count: number;
  share: number;
}

export function categoryBreakdown(
  txs: Transaction[],
  categories: Category[],
  kind: "income" | "expense",
): CategorySlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const acc = new Map<string | null, { total: number; count: number }>();

  for (const t of txs) {
    if (t.kind !== kind) continue;
    const key = t.categoryId ?? null;
    const cur = acc.get(key) ?? { total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    acc.set(key, cur);
  }

  const grand = [...acc.values()].reduce((s, v) => s + v.total, 0);
  return [...acc.entries()]
    .map(([categoryId, v]) => {
      const cat = categoryId ? byId.get(categoryId) : undefined;
      return {
        categoryId,
        name: cat?.name ?? "Sem categoria",
        color: cat?.color ?? "#94a3b8",
        total: round2(v.total),
        count: v.count,
        share: grand > 0 ? v.total / grand : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/* ------------------------------ parcelamentos ------------------------------ */

export interface InstallmentProgress {
  installment: Installment;
  transactions: Transaction[];
  paidCount: number;
  remainingCount: number;
  paidAmount: number;
  remainingAmount: number;
  percent: number;
  nextDue?: Transaction;
  done: boolean;
}

export function installmentProgress(
  installment: Installment,
  txs: Transaction[],
): InstallmentProgress {
  const list = txs
    .filter((t) => t.installmentId === installment.id)
    .sort((a, b) => (a.installmentNo ?? 0) - (b.installmentNo ?? 0));

  const paid = list.filter((t) => t.paid);
  const pending = list.filter((t) => !t.paid);
  const paidAmount = round2(paid.reduce((s, t) => s + t.amount, 0));
  const remainingAmount = round2(pending.reduce((s, t) => s + t.amount, 0));
  const total = list.length || installment.count;

  return {
    installment,
    transactions: list,
    paidCount: paid.length,
    remainingCount: pending.length,
    paidAmount,
    remainingAmount,
    percent: total > 0 ? paid.length / total : 0,
    nextDue: pending[0],
    done: pending.length === 0 && list.length > 0,
  };
}

export function allInstallmentProgress(snap: DataSnapshot): InstallmentProgress[] {
  return snap.installments
    .map((i) => installmentProgress(i, snap.transactions))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ad = a.nextDue?.date ?? "9999-12-31";
      const bd = b.nextDue?.date ?? "9999-12-31";
      return ad.localeCompare(bd);
    });
}

/** Quanto ainda esta comprometido com parcelas em cada mes futuro. */
export function futureInstallmentLoad(
  txs: Transaction[],
  fromMonth: string,
  months = 12,
): Array<{ month: string; total: number; count: number }> {
  return Array.from({ length: months }, (_, i) => {
    const m = addMonthsToKey(fromMonth, i);
    const list = txs.filter(
      (t) => t.installmentId && !t.paid && monthKey(t.date) === m,
    );
    return {
      month: m,
      total: round2(list.reduce((s, t) => s + t.amount, 0)),
      count: list.length,
    };
  });
}

/* -------------------------------- orcamentos ------------------------------- */

export interface BudgetStatus {
  budget: Budget;
  category?: Category;
  spent: number;
  remaining: number;
  percent: number;
  over: boolean;
}

export function budgetStatus(snap: DataSnapshot, month: string): BudgetStatus[] {
  const byId = new Map(snap.categories.map((c) => [c.id, c]));
  const monthTxs = transactionsOfMonth(snap.transactions, month).filter(
    (t) => t.kind === "expense",
  );
  const relevant = snap.budgets.filter((b) => !b.month || b.month === month);

  return relevant
    .map((budget) => {
      const spent = round2(
        monthTxs
          .filter((t) => t.categoryId === budget.categoryId)
          .reduce((s, t) => s + t.amount, 0),
      );
      return {
        budget,
        category: byId.get(budget.categoryId),
        spent,
        remaining: round2(budget.amount - spent),
        percent: budget.amount > 0 ? spent / budget.amount : 0,
        over: spent > budget.amount,
      };
    })
    .sort((a, b) => b.percent - a.percent);
}

/* ---------------------------------- metas ---------------------------------- */

export interface GoalProgress {
  goal: Goal;
  saved: number;
  remaining: number;
  percent: number;
  monthsLeft?: number;
  suggestedMonthly?: number;
  done: boolean;
}

export function goalProgress(goal: Goal): GoalProgress {
  const saved = round2(goal.contributions.reduce((s, c) => s + c.amount, 0));
  const remaining = round2(Math.max(0, goal.targetAmount - saved));
  let monthsLeft: number | undefined;
  let suggestedMonthly: number | undefined;

  if (goal.targetDate) {
    const days = daysBetween(todayISO(), goal.targetDate);
    monthsLeft = Math.max(0, Math.ceil(days / 30));
    suggestedMonthly = monthsLeft > 0 ? round2(remaining / monthsLeft) : remaining;
  }

  return {
    goal,
    saved,
    remaining,
    percent: goal.targetAmount > 0 ? Math.min(1, saved / goal.targetAmount) : 0,
    monthsLeft,
    suggestedMonthly,
    done: remaining === 0 && goal.targetAmount > 0,
  };
}

/* ------------------------------ contas a pagar ----------------------------- */

export function upcomingBills(txs: Transaction[], days = 30, limit = 20): Transaction[] {
  const until = new Date();
  until.setDate(until.getDate() + days);
  const untilISO = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, "0")}-${String(until.getDate()).padStart(2, "0")}`;

  return txs
    .filter((t) => !t.paid && t.kind !== "transfer" && t.date <= untilISO)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

export const isOverdue = (t: Transaction): boolean => !t.paid && t.date < todayISO();

/* ------------------------------- por pessoa -------------------------------- */

export function personBreakdown(snap: DataSnapshot, month: string) {
  const list = transactionsOfMonth(snap.transactions, month).filter(
    (t) => t.kind === "expense",
  );
  const rows = snap.people.map((p) => {
    const total = round2(
      list.filter((t) => t.personId === p.id).reduce((s, t) => s + t.amount, 0),
    );
    return { id: p.id, name: p.name, color: p.color, total };
  });
  const shared = round2(
    list.filter((t) => !t.personId).reduce((s, t) => s + t.amount, 0),
  );
  if (shared > 0) {
    rows.push({ id: "shared", name: "Conjunto", color: "#64748b", total: shared });
  }
  return rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
}

/* --------------------------------- saude ----------------------------------- */

/** Taxa de poupanca do mes: quanto sobrou da receita, em %. */
export function savingsRate(summary: MonthSummary): number {
  if (summary.income <= 0) return 0;
  return Math.max(-1, Math.min(1, (summary.income - summary.expense) / summary.income));
}
