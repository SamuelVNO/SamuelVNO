"use client";

import { useMemo, useState } from "react";
import { PiggyBank, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/components/UiProvider";
import { PageHeader } from "@/components/MonthSelector";
import {
  Button,
  Card,
  ConfirmDialog,
  Dot,
  EmptyState,
  Field,
  Modal,
  MoneyInput,
  ProgressBar,
  Select,
  Toggle,
} from "@/components/ui";
import { budgetStatus } from "@/lib/finance";
import { cx, formatMoney, monthLabel } from "@/lib/utils";
import type { Budget } from "@/lib/types";

export default function BudgetsPage() {
  const { data, setBudget, deleteBudget } = useStore();
  const { month, hide, toast } = useUi();

  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState(0);
  const [onlyThisMonth, setOnlyThisMonth] = useState(false);
  const [toDelete, setToDelete] = useState<Budget | null>(null);

  const rows = useMemo(() => budgetStatus(data, month), [data, month]);

  const totals = useMemo(() => {
    const planned = rows.reduce((s, r) => s + r.budget.amount, 0);
    const spent = rows.reduce((s, r) => s + r.spent, 0);
    return { planned, spent, remaining: planned - spent };
  }, [rows]);

  const expenseCategories = data.categories
    .filter((c) => c.kind === "expense" && !c.archived)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const overCount = rows.filter((r) => r.over).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orçamentos"
        subtitle="Quanto vocês querem gastar em cada categoria"
        withMonth
        right={
          <Button
            className="shrink-0"
            onClick={() => {
              setCategoryId(expenseCategories[0]?.id ?? "");
              setAmount(0);
              setOnlyThisMonth(false);
              setOpen(true);
            }}
          >
            <Plus size={17} /> Novo orçamento
          </Button>
        }
      />

      {rows.length > 0 && (
        <Card className="p-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Planejado</p>
            <p className="text-sm font-semibold tabular-nums mt-0.5">
              {formatMoney(totals.planned, hide)}
            </p>
          </div>
          <div className="border-x border-app">
            <p className="text-[10px] uppercase tracking-wide text-muted">Gasto</p>
            <p className="text-sm font-semibold tabular-nums mt-0.5">
              {formatMoney(totals.spent, hide)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Disponível</p>
            <p
              className={cx(
                "text-sm font-semibold tabular-nums mt-0.5",
                totals.remaining < 0 ? "text-neg" : "text-pos",
              )}
            >
              {formatMoney(totals.remaining, hide)}
            </p>
          </div>
        </Card>
      )}

      {overCount > 0 && (
        <div className="card p-3.5 flex items-center gap-3 border-amber-500/40 bg-amber-500/5">
          <TriangleAlert size={18} className="text-warn shrink-0" />
          <p className="text-sm">
            {overCount === 1
              ? "1 categoria estourou o orçamento"
              : `${overCount} categorias estouraram o orçamento`}{" "}
            em {monthLabel(month).toLowerCase()}.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PiggyBank size={38} />}
            title="Nenhum orçamento definido"
            message="Defina um teto de gastos por categoria e acompanhe quanto ainda podem gastar no mês."
            action={
              <Button
                onClick={() => {
                  setCategoryId(expenseCategories[0]?.id ?? "");
                  setOpen(true);
                }}
              >
                <Plus size={17} /> Criar orçamento
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.budget.id} className="p-4">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <span className="font-medium flex items-center gap-2 min-w-0">
                  <Dot color={r.category?.color ?? "#94a3b8"} />
                  <span className="truncate">{r.category?.name ?? "Categoria removida"}</span>
                  {r.budget.month && (
                    <span className="text-[10px] text-muted shrink-0">só este mês</span>
                  )}
                </span>
                <button
                  onClick={() => setToDelete(r.budget)}
                  className="p-1.5 rounded-lg text-muted hover:bg-surface-2 shrink-0"
                  aria-label="Excluir orçamento"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <ProgressBar
                value={r.percent}
                height={10}
                color={r.over ? "var(--neg)" : r.percent > 0.8 ? "var(--warn)" : r.category?.color ?? "#6366f1"}
              />

              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="tabular-nums">
                  <span className="font-semibold">{formatMoney(r.spent, hide)}</span>
                  <span className="text-muted"> de {formatMoney(r.budget.amount, hide)}</span>
                </span>
                <span className={cx("tabular-nums font-medium", r.over ? "text-neg" : "text-pos")}>
                  {r.over
                    ? `${formatMoney(Math.abs(r.remaining), hide)} acima`
                    : `${formatMoney(r.remaining, hide)} disponível`}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Definir orçamento"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!categoryId || amount <= 0}
              onClick={() => {
                setBudget(categoryId, amount, onlyThisMonth ? month : undefined);
                toast("Orçamento salvo");
                setOpen(false);
              }}
            >
              Salvar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Categoria">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Limite mensal">
            <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
          </Field>
          <Toggle
            checked={onlyThisMonth}
            onChange={setOnlyThisMonth}
            label={`Valer apenas em ${monthLabel(month).toLowerCase()}`}
          />
          <p className="text-xs text-muted">
            Sem essa opção o limite vale para todos os meses, até vocês mudarem.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Excluir orçamento"
        destructive
        confirmLabel="Excluir"
        message="O limite dessa categoria deixa de ser acompanhado."
        onConfirm={() => {
          if (toDelete) {
            deleteBudget(toDelete.id);
            toast("Orçamento excluído");
          }
        }}
      />
    </div>
  );
}
