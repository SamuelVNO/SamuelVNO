"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Search, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/components/UiProvider";
import { PageHeader } from "@/components/MonthSelector";
import { TransactionList } from "@/components/TransactionList";
import { Button, Card, Input, Modal, Select, Field, Segmented } from "@/components/ui";
import { monthSummary, transactionsOfMonth } from "@/lib/finance";
import { cx, formatMoney, todayISO } from "@/lib/utils";
import type { TxKind } from "@/lib/types";

type Status = "todos" | "pagos" | "pendentes" | "atrasados";
type KindFilter = "todos" | TxKind;

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-muted">Carregando…</div>}>
      <TransactionsInner />
    </Suspense>
  );
}

function TransactionsInner() {
  const { data } = useStore();
  const { month, hide } = useUi();
  const params = useSearchParams();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>(
    params.get("filtro") === "atrasados" ? "atrasados" : "todos",
  );
  const [kind, setKind] = useState<KindFilter>("todos");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [personId, setPersonId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [allMonths, setAllMonths] = useState(status === "atrasados");

  const today = todayISO();

  const base = useMemo(
    () => (allMonths ? data.transactions : transactionsOfMonth(data.transactions, month)),
    [data.transactions, month, allMonths],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return base
      .filter((t) => {
        if (kind !== "todos" && t.kind !== kind) return false;
        if (status === "pagos" && !t.paid) return false;
        if (status === "pendentes" && t.paid) return false;
        if (status === "atrasados" && (t.paid || t.date >= today)) return false;
        if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false;
        if (categoryId && t.categoryId !== categoryId) return false;
        if (personId && t.personId !== personId) return false;
        if (q && !t.description.toLowerCase().includes(q) && !(t.notes ?? "").toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [base, search, status, kind, accountId, categoryId, personId, today]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.kind === "income") income += t.amount;
      if (t.kind === "expense") expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [filtered]);

  const summary = monthSummary(data.transactions, month);
  const activeFilters = [accountId, categoryId, personId].filter(Boolean).length + (kind !== "todos" ? 1 : 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lançamentos"
        subtitle={
          allMonths
            ? `${filtered.length} lançamentos em todo o histórico`
            : `${filtered.length} lançamentos no mês`
        }
        withMonth={!allMonths}
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição…"
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              aria-label="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowFilters(true)}
          className={cx("shrink-0 relative", activeFilters > 0 && "border-brand-500 text-brand-600")}
        >
          <Filter size={16} />
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-brand-600 text-white text-[10px] grid place-items-center" style={{ width: 18, height: 18 }}>
              {activeFilters}
            </span>
          )}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {(["todos", "pendentes", "atrasados", "pagos"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cx(
              "px-3.5 h-8 rounded-full text-[13px] font-medium border whitespace-nowrap transition-colors",
              status === s
                ? "bg-brand-600 text-white border-brand-600"
                : "border-app text-muted hover:bg-surface-2",
            )}
          >
            {s === "todos" ? "Todos" : s === "pagos" ? "Pagos" : s === "pendentes" ? "Pendentes" : "Atrasados"}
          </button>
        ))}
        <button
          onClick={() => setAllMonths((v) => !v)}
          className={cx(
            "px-3.5 h-8 rounded-full text-[13px] font-medium border whitespace-nowrap transition-colors",
            allMonths ? "bg-brand-600 text-white border-brand-600" : "border-app text-muted hover:bg-surface-2",
          )}
        >
          Todo o período
        </button>
      </div>

      <Card className="p-3.5 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">Receitas</p>
          <p className="text-sm font-semibold text-pos tabular-nums">
            {formatMoney(totals.income, hide)}
          </p>
        </div>
        <div className="border-x border-app">
          <p className="text-[10px] uppercase tracking-wide text-muted">Despesas</p>
          <p className="text-sm font-semibold text-neg tabular-nums">
            {formatMoney(totals.expense, hide)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">Saldo</p>
          <p
            className={cx(
              "text-sm font-semibold tabular-nums",
              totals.balance >= 0 ? "text-pos" : "text-neg",
            )}
          >
            {formatMoney(totals.balance, hide)}
          </p>
        </div>
      </Card>

      <TransactionList
        transactions={filtered}
        emptyMessage={
          search || activeFilters
            ? "Nenhum lançamento encontrado com esses filtros."
            : `Nada lançado ainda${allMonths ? "" : " neste mês"}. Use o botão + para começar.`
        }
      />

      <Modal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filtros"
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setKind("todos");
                setAccountId("");
                setCategoryId("");
                setPersonId("");
              }}
            >
              Limpar
            </Button>
            <Button className="flex-1" onClick={() => setShowFilters(false)}>
              Aplicar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Tipo">
            <Segmented
              options={[
                { value: "todos" as KindFilter, label: "Todos" },
                { value: "expense" as KindFilter, label: "Despesas" },
                { value: "income" as KindFilter, label: "Receitas" },
                { value: "transfer" as KindFilter, label: "Transfer." },
              ]}
              value={kind}
              onChange={setKind}
            />
          </Field>
          <Field label="Conta">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Todas as contas</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas as categorias</option>
              {data.categories
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Pessoa">
            <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Todos</option>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-muted">
            Resumo do mês: {formatMoney(summary.income)} de receitas e {formatMoney(summary.expense)}{" "}
            de despesas.
          </p>
        </div>
      </Modal>
    </div>
  );
}
