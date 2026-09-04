"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Account,
  Budget,
  Category,
  CollectionName,
  DataSnapshot,
  Goal,
  GoalContribution,
  Installment,
  Person,
  Recurrence,
  Settings,
  Transaction,
} from "./types";
import { emptySnapshot } from "./seed";
import {
  loadLocal,
  mergeSnapshots,
  normalize,
  saveLocal,
} from "./storage";
import {
  createHousehold as rpcCreate,
  getSession,
  isSyncConfigured,
  joinHousehold as rpcJoin,
  myHousehold,
  pullSnapshot,
  pushSnapshot,
  signOut as sbSignOut,
  subscribeHousehold,
  type Household,
} from "./supabase";
import {
  addMonths,
  monthKey,
  nowISO,
  round2,
  splitInstallments,
  stepDate,
  todayISO,
  uid,
} from "./utils";

export type SyncState = "off" | "signed-out" | "idle" | "syncing" | "error";

interface StoreValue {
  data: DataSnapshot;
  ready: boolean;
  syncState: SyncState;
  syncError: string | null;
  household: Household | null;
  syncAvailable: boolean;

  /* transacoes */
  addTransaction: (t: NewTransaction) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  setPaid: (id: string, paid: boolean) => void;
  bulkSetPaid: (ids: string[], paid: boolean) => void;

  /* parcelamentos */
  addInstallment: (i: NewInstallment) => Installment;
  deleteInstallment: (id: string, removeTransactions: boolean) => void;
  payNextInstallment: (installmentId: string) => void;
  settleInstallment: (installmentId: string) => void;

  /* recorrencias */
  addRecurrence: (r: NewRecurrence) => Recurrence;
  updateRecurrence: (id: string, patch: Partial<Recurrence>) => void;
  deleteRecurrence: (id: string) => void;

  /* cadastros */
  addAccount: (a: Omit<Account, "id" | "createdAt">) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addCategory: (c: Omit<Category, "id">) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addPerson: (p: Omit<Person, "id">) => Person;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;

  /* orcamentos e metas */
  setBudget: (categoryId: string, amount: number, month?: string) => void;
  deleteBudget: (id: string) => void;

  addGoal: (g: Omit<Goal, "id" | "createdAt" | "contributions">) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addContribution: (goalId: string, amount: number, date: string, note?: string) => void;
  deleteContribution: (goalId: string, contributionId: string) => void;

  /* geral */
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (snap: DataSnapshot) => void;
  resetAll: () => void;

  /* sincronia */
  connectHousehold: (name: string) => Promise<void>;
  joinHousehold: (code: string) => Promise<void>;
  refreshSync: () => Promise<void>;
  disconnectSync: () => Promise<void>;
}

export type NewTransaction = Omit<Transaction, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<Transaction, "id">>;

export interface NewInstallment {
  description: string;
  totalAmount: number;
  count: number;
  firstDueDate: string;
  accountId: string;
  categoryId?: string;
  personId?: string;
  kind: "expense" | "income";
  notes?: string;
  /** Marca as N primeiras parcelas como ja pagas. */
  alreadyPaid?: number;
  /** Informar o valor de cada parcela em vez do total. */
  amountIsPerInstallment?: boolean;
}

export interface NewRecurrence {
  description: string;
  amount: number;
  kind: "income" | "expense";
  frequency: Recurrence["frequency"];
  startDate: string;
  endDate?: string;
  accountId: string;
  categoryId?: string;
  personId?: string;
  /** Quantas ocorrencias futuras ja lancar (padrao 12). */
  horizon?: number;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de <StoreProvider>.");
  return ctx;
}

const PUSH_DEBOUNCE_MS = 900;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DataSnapshot>(() => emptySnapshot());
  const [ready, setReady] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("off");
  const [syncError, setSyncError] = useState<string | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const householdRef = useRef<Household | null>(null);
  householdRef.current = household;
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemote = useRef(false);

  /* ------------------------------ carregamento ------------------------------ */

  useEffect(() => {
    const local = loadLocal();
    if (local) setData(local);
    setReady(true);
  }, []);

  /* ---------------------------- gravacao + push ----------------------------- */

  const commit = useCallback((next: DataSnapshot) => {
    const stamped = { ...next, updatedAt: nowISO() };
    setData(stamped);
    saveLocal(stamped);

    if (!householdRef.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      const h = householdRef.current;
      if (!h) return;
      try {
        setSyncState("syncing");
        await pushSnapshot(h.id, dataRef.current);
        setSyncState("idle");
        setSyncError(null);
      } catch (err) {
        setSyncState("error");
        setSyncError(err instanceof Error ? err.message : "Falha ao sincronizar.");
      }
    }, PUSH_DEBOUNCE_MS);
  }, []);

  const mutate = useCallback(
    (fn: (draft: DataSnapshot) => DataSnapshot) => {
      commit(fn(dataRef.current));
    },
    [commit],
  );

  const tombstone = (snap: DataSnapshot, collection: CollectionName, id: string): DataSnapshot => ({
    ...snap,
    tombstones: [...snap.tombstones, { id, collection, at: nowISO() }],
  });

  /* -------------------------------- sincronia ------------------------------- */

  const adoptRemote = useCallback(
    (remote: DataSnapshot) => {
      applyingRemote.current = true;
      const merged = mergeSnapshots(dataRef.current, remote);
      setData(merged);
      saveLocal(merged);
      applyingRemote.current = false;
      return merged;
    },
    [],
  );

  const bootstrapSync = useCallback(async () => {
    if (!isSyncConfigured()) {
      setSyncState("off");
      return;
    }
    try {
      const session = await getSession();
      if (!session) {
        setSyncState("signed-out");
        setHousehold(null);
        return;
      }
      setSyncState("syncing");
      const h = await myHousehold();
      if (!h) {
        setHousehold(null);
        setSyncState("signed-out");
        return;
      }
      setHousehold(h);
      const remote = await pullSnapshot(h.id);
      const merged = remote ? adoptRemote(remote) : dataRef.current;
      await pushSnapshot(h.id, merged);
      setSyncState("idle");
      setSyncError(null);
    } catch (err) {
      setSyncState("error");
      setSyncError(err instanceof Error ? err.message : "Falha ao sincronizar.");
    }
  }, [adoptRemote]);

  useEffect(() => {
    if (!ready) return;
    void bootstrapSync();
  }, [ready, bootstrapSync]);

  useEffect(() => {
    if (!household) return;
    const unsub = subscribeHousehold(household.id, (remote) => {
      adoptRemote(remote);
    });
    return unsub;
  }, [household, adoptRemote]);

  /* ------------------------- recorrencias automaticas ------------------------ */

  useEffect(() => {
    if (!ready) return;
    const snap = dataRef.current;
    const generated = generateRecurrenceTransactions(snap);
    if (generated) commit(generated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* ------------------------------- transacoes ------------------------------- */

  const addTransaction = useCallback(
    (t: NewTransaction): Transaction => {
      const tx: Transaction = {
        ...t,
        id: t.id ?? uid(),
        amount: round2(Math.abs(t.amount)),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      mutate((s) => ({ ...s, transactions: [tx, ...s.transactions] }));
      return tx;
    },
    [mutate],
  );

  const updateTransaction = useCallback(
    (id: string, patch: Partial<Transaction>) => {
      mutate((s) => ({
        ...s,
        transactions: s.transactions.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                amount: patch.amount !== undefined ? round2(Math.abs(patch.amount)) : t.amount,
                updatedAt: nowISO(),
              }
            : t,
        ),
      }));
    },
    [mutate],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      mutate((s) =>
        tombstone(
          { ...s, transactions: s.transactions.filter((t) => t.id !== id) },
          "transactions",
          id,
        ),
      );
    },
    [mutate],
  );

  const setPaid = useCallback(
    (id: string, paid: boolean) => updateTransaction(id, { paid }),
    [updateTransaction],
  );

  const bulkSetPaid = useCallback(
    (ids: string[], paid: boolean) => {
      const set = new Set(ids);
      mutate((s) => ({
        ...s,
        transactions: s.transactions.map((t) =>
          set.has(t.id) ? { ...t, paid, updatedAt: nowISO() } : t,
        ),
      }));
    },
    [mutate],
  );

  /* ------------------------------ parcelamentos ------------------------------ */

  const addInstallment = useCallback(
    (input: NewInstallment): Installment => {
      const count = Math.max(1, Math.floor(input.count));
      const total = input.amountIsPerInstallment
        ? round2(input.totalAmount * count)
        : round2(input.totalAmount);

      const installment: Installment = {
        id: uid(),
        description: input.description,
        totalAmount: total,
        count,
        firstDueDate: input.firstDueDate,
        accountId: input.accountId,
        categoryId: input.categoryId,
        personId: input.personId,
        kind: input.kind,
        notes: input.notes,
        createdAt: nowISO(),
      };

      const parts = input.amountIsPerInstallment
        ? Array.from({ length: count }, () => round2(input.totalAmount))
        : splitInstallments(total, count);

      const alreadyPaid = Math.min(count, Math.max(0, input.alreadyPaid ?? 0));

      const txs: Transaction[] = parts.map((amount, idx) => ({
        id: uid(),
        kind: input.kind,
        description: `${input.description} (${idx + 1}/${count})`,
        amount,
        date: addMonths(input.firstDueDate, idx),
        accountId: input.accountId,
        categoryId: input.categoryId,
        personId: input.personId,
        paid: idx < alreadyPaid,
        notes: input.notes,
        installmentId: installment.id,
        installmentNo: idx + 1,
        installmentTotal: count,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }));

      mutate((s) => ({
        ...s,
        installments: [installment, ...s.installments],
        transactions: [...txs, ...s.transactions],
      }));

      return installment;
    },
    [mutate],
  );

  const deleteInstallment = useCallback(
    (id: string, removeTransactions: boolean) => {
      mutate((s) => {
        const doomed = removeTransactions
          ? s.transactions.filter((t) => t.installmentId === id).map((t) => t.id)
          : [];
        const next: DataSnapshot = {
          ...s,
          installments: s.installments.filter((i) => i.id !== id),
          transactions: removeTransactions
            ? s.transactions.filter((t) => t.installmentId !== id)
            : s.transactions.map((t) =>
                t.installmentId === id ? { ...t, installmentId: undefined, updatedAt: nowISO() } : t,
              ),
          tombstones: [
            ...s.tombstones,
            { id, collection: "installments" as CollectionName, at: nowISO() },
            ...doomed.map((tid) => ({
              id: tid,
              collection: "transactions" as CollectionName,
              at: nowISO(),
            })),
          ],
        };
        return next;
      });
    },
    [mutate],
  );

  const payNextInstallment = useCallback(
    (installmentId: string) => {
      const next = dataRef.current.transactions
        .filter((t) => t.installmentId === installmentId && !t.paid)
        .sort((a, b) => (a.installmentNo ?? 0) - (b.installmentNo ?? 0))[0];
      if (next) setPaid(next.id, true);
    },
    [setPaid],
  );

  const settleInstallment = useCallback(
    (installmentId: string) => {
      const ids = dataRef.current.transactions
        .filter((t) => t.installmentId === installmentId && !t.paid)
        .map((t) => t.id);
      if (ids.length) bulkSetPaid(ids, true);
    },
    [bulkSetPaid],
  );

  /* ------------------------------ recorrencias ------------------------------ */

  const addRecurrence = useCallback(
    (input: NewRecurrence): Recurrence => {
      const rec: Recurrence = {
        id: uid(),
        description: input.description,
        amount: round2(Math.abs(input.amount)),
        kind: input.kind,
        frequency: input.frequency,
        startDate: input.startDate,
        endDate: input.endDate,
        accountId: input.accountId,
        categoryId: input.categoryId,
        personId: input.personId,
        active: true,
        createdAt: nowISO(),
      };

      const horizon = input.horizon ?? 12;
      const txs: Transaction[] = [];
      let date = input.startDate;
      for (let i = 0; i < horizon; i++) {
        if (rec.endDate && date > rec.endDate) break;
        txs.push({
          id: uid(),
          kind: rec.kind,
          description: rec.description,
          amount: rec.amount,
          date,
          accountId: rec.accountId,
          categoryId: rec.categoryId,
          personId: rec.personId,
          paid: false,
          recurrenceId: rec.id,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        });
        date = stepDate(date, rec.frequency);
      }
      rec.lastGenerated = monthKey(txs[txs.length - 1]?.date ?? input.startDate);

      mutate((s) => ({
        ...s,
        recurrences: [rec, ...s.recurrences],
        transactions: [...txs, ...s.transactions],
      }));
      return rec;
    },
    [mutate],
  );

  const updateRecurrence = useCallback(
    (id: string, patch: Partial<Recurrence>) => {
      mutate((s) => ({
        ...s,
        recurrences: s.recurrences.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
    },
    [mutate],
  );

  const deleteRecurrence = useCallback(
    (id: string) => {
      mutate((s) => {
        const doomed = s.transactions
          .filter((t) => t.recurrenceId === id && !t.paid && t.date >= todayISO())
          .map((t) => t.id);
        return {
          ...s,
          recurrences: s.recurrences.filter((r) => r.id !== id),
          transactions: s.transactions.filter((t) => !doomed.includes(t.id)),
          tombstones: [
            ...s.tombstones,
            { id, collection: "recurrences" as CollectionName, at: nowISO() },
            ...doomed.map((tid) => ({
              id: tid,
              collection: "transactions" as CollectionName,
              at: nowISO(),
            })),
          ],
        };
      });
    },
    [mutate],
  );

  /* -------------------------------- cadastros -------------------------------- */

  const addAccount = useCallback(
    (a: Omit<Account, "id" | "createdAt">): Account => {
      const account: Account = { ...a, id: uid(), createdAt: nowISO() };
      mutate((s) => ({ ...s, accounts: [...s.accounts, account] }));
      return account;
    },
    [mutate],
  );

  const updateAccount = useCallback(
    (id: string, patch: Partial<Account>) => {
      mutate((s) => ({
        ...s,
        accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }));
    },
    [mutate],
  );

  const deleteAccount = useCallback(
    (id: string) => {
      mutate((s) => {
        const used = s.transactions.some((t) => t.accountId === id || t.toAccountId === id);
        if (used) {
          return {
            ...s,
            accounts: s.accounts.map((a) => (a.id === id ? { ...a, archived: true } : a)),
          };
        }
        return tombstone({ ...s, accounts: s.accounts.filter((a) => a.id !== id) }, "accounts", id);
      });
    },
    [mutate],
  );

  const addCategory = useCallback(
    (c: Omit<Category, "id">): Category => {
      const category: Category = { ...c, id: uid() };
      mutate((s) => ({ ...s, categories: [...s.categories, category] }));
      return category;
    },
    [mutate],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Category>) => {
      mutate((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
    },
    [mutate],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      mutate((s) => {
        const used = s.transactions.some((t) => t.categoryId === id);
        if (used) {
          return {
            ...s,
            categories: s.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
          };
        }
        return tombstone(
          {
            ...s,
            categories: s.categories.filter((c) => c.id !== id),
            budgets: s.budgets.filter((b) => b.categoryId !== id),
          },
          "categories",
          id,
        );
      });
    },
    [mutate],
  );

  const addPerson = useCallback(
    (p: Omit<Person, "id">): Person => {
      const person: Person = { ...p, id: uid() };
      mutate((s) => ({ ...s, people: [...s.people, person] }));
      return person;
    },
    [mutate],
  );

  const updatePerson = useCallback(
    (id: string, patch: Partial<Person>) => {
      mutate((s) => ({
        ...s,
        people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    },
    [mutate],
  );

  const deletePerson = useCallback(
    (id: string) => {
      mutate((s) =>
        tombstone(
          {
            ...s,
            people: s.people.filter((p) => p.id !== id),
            transactions: s.transactions.map((t) =>
              t.personId === id ? { ...t, personId: undefined, updatedAt: nowISO() } : t,
            ),
          },
          "people",
          id,
        ),
      );
    },
    [mutate],
  );

  /* --------------------------- orcamentos e metas ---------------------------- */

  const setBudget = useCallback(
    (categoryId: string, amount: number, month?: string) => {
      mutate((s) => {
        const existing = s.budgets.find(
          (b) => b.categoryId === categoryId && (b.month ?? null) === (month ?? null),
        );
        if (existing) {
          return {
            ...s,
            budgets: s.budgets.map((b) =>
              b.id === existing.id ? { ...b, amount: round2(amount) } : b,
            ),
          };
        }
        const budget: Budget = {
          id: uid(),
          categoryId,
          amount: round2(amount),
          month,
          createdAt: nowISO(),
        };
        return { ...s, budgets: [...s.budgets, budget] };
      });
    },
    [mutate],
  );

  const deleteBudget = useCallback(
    (id: string) => {
      mutate((s) =>
        tombstone({ ...s, budgets: s.budgets.filter((b) => b.id !== id) }, "budgets", id),
      );
    },
    [mutate],
  );

  const addGoal = useCallback(
    (g: Omit<Goal, "id" | "createdAt" | "contributions">): Goal => {
      const goal: Goal = { ...g, id: uid(), contributions: [], createdAt: nowISO() };
      mutate((s) => ({ ...s, goals: [...s.goals, goal] }));
      return goal;
    },
    [mutate],
  );

  const updateGoal = useCallback(
    (id: string, patch: Partial<Goal>) => {
      mutate((s) => ({
        ...s,
        goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      }));
    },
    [mutate],
  );

  const deleteGoal = useCallback(
    (id: string) => {
      mutate((s) => tombstone({ ...s, goals: s.goals.filter((g) => g.id !== id) }, "goals", id));
    },
    [mutate],
  );

  const addContribution = useCallback(
    (goalId: string, amount: number, date: string, note?: string) => {
      const contribution: GoalContribution = { id: uid(), amount: round2(amount), date, note };
      mutate((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === goalId ? { ...g, contributions: [contribution, ...g.contributions] } : g,
        ),
      }));
    },
    [mutate],
  );

  const deleteContribution = useCallback(
    (goalId: string, contributionId: string) => {
      mutate((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === goalId
            ? { ...g, contributions: g.contributions.filter((c) => c.id !== contributionId) }
            : g,
        ),
      }));
    },
    [mutate],
  );

  /* ---------------------------------- geral ---------------------------------- */

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      mutate((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    },
    [mutate],
  );

  const replaceAll = useCallback(
    (snap: DataSnapshot) => {
      commit(normalize(snap));
    },
    [commit],
  );

  const resetAll = useCallback(() => {
    commit(emptySnapshot());
  }, [commit]);

  /* -------------------------------- sincronia -------------------------------- */

  const connectHousehold = useCallback(
    async (name: string) => {
      setSyncState("syncing");
      try {
        const h = await rpcCreate(name);
        setHousehold(h);
        await pushSnapshot(h.id, dataRef.current);
        setSyncState("idle");
        setSyncError(null);
      } catch (err) {
        setSyncState("error");
        setSyncError(err instanceof Error ? err.message : "Falha ao criar o lar.");
        throw err;
      }
    },
    [],
  );

  const joinHouseholdFn = useCallback(
    async (code: string) => {
      setSyncState("syncing");
      try {
        const h = await rpcJoin(code);
        setHousehold(h);
        const remote = await pullSnapshot(h.id);
        const merged = remote ? adoptRemote(remote) : dataRef.current;
        await pushSnapshot(h.id, merged);
        setSyncState("idle");
        setSyncError(null);
      } catch (err) {
        setSyncState("error");
        setSyncError(err instanceof Error ? err.message : "Falha ao entrar no lar.");
        throw err;
      }
    },
    [adoptRemote],
  );

  const refreshSync = useCallback(async () => {
    await bootstrapSync();
  }, [bootstrapSync]);

  const disconnectSync = useCallback(async () => {
    await sbSignOut();
    setHousehold(null);
    setSyncState(isSyncConfigured() ? "signed-out" : "off");
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      ready,
      syncState,
      syncError,
      household,
      syncAvailable: isSyncConfigured(),
      addTransaction,
      updateTransaction,
      deleteTransaction,
      setPaid,
      bulkSetPaid,
      addInstallment,
      deleteInstallment,
      payNextInstallment,
      settleInstallment,
      addRecurrence,
      updateRecurrence,
      deleteRecurrence,
      addAccount,
      updateAccount,
      deleteAccount,
      addCategory,
      updateCategory,
      deleteCategory,
      addPerson,
      updatePerson,
      deletePerson,
      setBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      addContribution,
      deleteContribution,
      updateSettings,
      replaceAll,
      resetAll,
      connectHousehold,
      joinHousehold: joinHouseholdFn,
      refreshSync,
      disconnectSync,
    }),
    [
      data, ready, syncState, syncError, household,
      addTransaction, updateTransaction, deleteTransaction, setPaid, bulkSetPaid,
      addInstallment, deleteInstallment, payNextInstallment, settleInstallment,
      addRecurrence, updateRecurrence, deleteRecurrence,
      addAccount, updateAccount, deleteAccount,
      addCategory, updateCategory, deleteCategory,
      addPerson, updatePerson, deletePerson,
      setBudget, deleteBudget,
      addGoal, updateGoal, deleteGoal, addContribution, deleteContribution,
      updateSettings, replaceAll, resetAll,
      connectHousehold, joinHouseholdFn, refreshSync, disconnectSync,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/**
 * Estende as contas fixas para que sempre existam ~12 meses de lancamentos
 * futuros previstos. Retorna null quando nao houve nada a gerar.
 */
function generateRecurrenceTransactions(snap: DataSnapshot): DataSnapshot | null {
  const HORIZON_MONTHS = 12;
  const limit = addMonths(todayISO(), HORIZON_MONTHS);
  const created: Transaction[] = [];
  const recurrences = snap.recurrences.map((rec) => {
    if (!rec.active) return rec;

    const existing = snap.transactions
      .filter((t) => t.recurrenceId === rec.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    let date = existing.length
      ? stepDate(existing[existing.length - 1].date, rec.frequency)
      : rec.startDate;

    let guard = 0;
    while (date <= limit && guard < 200) {
      if (rec.endDate && date > rec.endDate) break;
      created.push({
        id: uid(),
        kind: rec.kind,
        description: rec.description,
        amount: rec.amount,
        date,
        accountId: rec.accountId,
        categoryId: rec.categoryId,
        personId: rec.personId,
        paid: false,
        recurrenceId: rec.id,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
      date = stepDate(date, rec.frequency);
      guard++;
    }
    return created.length ? { ...rec, lastGenerated: monthKey(date) } : rec;
  });

  if (!created.length) return null;
  return { ...snap, recurrences, transactions: [...created, ...snap.transactions] };
}
