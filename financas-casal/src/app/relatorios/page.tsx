"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useUi } from "@/components/UiProvider";
import { PageHeader } from "@/components/MonthSelector";
import { Card, SectionTitle, Segmented } from "@/components/ui";
import { BalanceAreaChart, DonutChart, HorizontalBars, IncomeExpenseChart } from "@/components/charts";
import {
  categoryBreakdown,
  monthSummary,
  monthlySeries,
  personBreakdown,
  savingsRate,
  transactionsOfMonth,
} from "@/lib/finance";
import { addMonthsToKey, cx, formatMoney, monthLabel } from "@/lib/utils";

type Range = "1" | "3" | "6" | "12";

export default function ReportsPage() {
  const { data } = useStore();
  const { month, hide } = useUi();
  const [range, setRange] = useState<Range>("6");
  const [kind, setKind] = useState<"expense" | "income">("expense");

  const months = Number(range);

  const periodTxs = useMemo(() => {
    const from = addMonthsToKey(month, -(months - 1));
    return data.transactions.filter((t) => {
      const key = t.date.slice(0, 7);
      return key >= from && key <= month;
    });
  }, [data.transactions, month, months]);

  const breakdown = useMemo(
    () => categoryBreakdown(periodTxs, data.categories, kind),
    [periodTxs, data.categories, kind],
  );

  const series = useMemo(
    () => monthlySeries(data.transactions, month, months),
    [data.transactions, month, months],
  );

  const people = useMemo(() => personBreakdown(data, month), [data, month]);
  const summary = monthSummary(data.transactions, month);
  const monthTxs = transactionsOfMonth(data.transactions, month);

  const periodTotals = useMemo(() => {
    const income = series.reduce((s, m) => s + m.income, 0);
    const expense = series.reduce((s, m) => s + m.expense, 0);
    return {
      income,
      expense,
      balance: income - expense,
      avgExpense: expense / months,
      avgIncome: income / months,
    };
  }, [series, months]);

  const biggest = useMemo(
    () =>
      periodTxs
        .filter((t) => t.kind === "expense")
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [periodTxs],
  );

  const total = breakdown.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Relatórios" subtitle="Entenda para onde o dinheiro está indo" withMonth />

      <Segmented
        options={[
          { value: "1" as Range, label: "1 mês" },
          { value: "3" as Range, label: "3 meses" },
          { value: "6" as Range, label: "6 meses" },
          { value: "12" as Range, label: "12 meses" },
        ]}
        value={range}
        onChange={setRange}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Receitas no período" value={periodTotals.income} tone="pos" hide={hide} />
        <MiniStat label="Despesas no período" value={periodTotals.expense} tone="neg" hide={hide} />
        <MiniStat
          label="Resultado"
          value={periodTotals.balance}
          tone={periodTotals.balance >= 0 ? "pos" : "neg"}
          hide={hide}
        />
        <MiniStat
          label="Média de gasto/mês"
          value={periodTotals.avgExpense}
          hide={hide}
        />
      </div>

      <Card className="p-4">
        <SectionTitle
          title="Receitas x despesas"
          subtitle={`Últimos ${months} ${months === 1 ? "mês" : "meses"}`}
        />
        <IncomeExpenseChart
          data={series.map((s) => ({
            month: monthLabel(s.month, true),
            Receitas: s.income,
            Despesas: s.expense,
          }))}
          height={250}
        />
      </Card>

      <Card className="p-4">
        <SectionTitle title="Sobra mensal" subtitle="Quanto sobrou em cada mês" />
        <BalanceAreaChart
          data={series.map((s) => ({ month: monthLabel(s.month, true), Saldo: s.balance }))}
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionTitle title="Por categoria" subtitle={`Últimos ${months} meses`} />
          <Segmented
            className="mb-4"
            options={[
              { value: "expense" as const, label: "Despesas" },
              { value: "income" as const, label: "Receitas" },
            ]}
            value={kind}
            onChange={setKind}
          />
          <DonutChart
            data={breakdown.slice(0, 8).map((c) => ({
              name: c.name,
              value: c.total,
              color: c.color,
            }))}
            centerLabel="Total"
            centerValue={formatMoney(total, hide)}
          />
        </Card>

        <Card className="p-4">
          <SectionTitle title="Ranking de categorias" subtitle="Do maior para o menor" />
          <HorizontalBars
            data={breakdown.slice(0, 10).map((c) => ({
              name: c.name,
              value: c.total,
              color: c.color,
            }))}
            total={total}
            hide={hide}
          />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionTitle title="Gastos por pessoa" subtitle={monthLabel(month)} />
          {people.length ? (
            <HorizontalBars
              data={people.map((p) => ({ name: p.name, value: p.total, color: p.color }))}
              total={people.reduce((s, p) => s + p.total, 0)}
              hide={hide}
            />
          ) : (
            <p className="text-sm text-muted text-center py-8">
              Nenhum gasto atribuído neste mês.
            </p>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle title="Maiores despesas" subtitle={`Últimos ${months} meses`} />
          {biggest.length ? (
            <div className="divide-y divide-[var(--border)]">
              {biggest.map((t) => {
                const cat = data.categories.find((c) => c.id === t.categoryId);
                return (
                  <div key={t.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: cat?.color ?? "#94a3b8" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{t.description}</p>
                      <p className="text-[11px] text-muted">
                        {t.date.split("-").reverse().join("/")}
                        {cat && ` · ${cat.name}`}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0">
                      {formatMoney(t.amount, hide)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-8">Nenhuma despesa no período.</p>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle title="Resumo do mês" subtitle={monthLabel(month)} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Detail label="Lançamentos" value={String(monthTxs.length)} />
          <Detail
            label="Taxa de poupança"
            value={`${(savingsRate(summary) * 100).toFixed(0)}%`}
          />
          <Detail label="A pagar" value={formatMoney(summary.expensePending, hide)} />
          <Detail
            label="Vencidas"
            value={formatMoney(summary.overdue, hide)}
            tone={summary.overdue > 0 ? "neg" : undefined}
          />
        </div>
      </Card>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  hide,
}: {
  label: string;
  value: number;
  tone?: "pos" | "neg";
  hide?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted truncate">
        {label}
      </p>
      <p
        className={cx(
          "text-lg font-bold tabular-nums mt-1",
          tone === "pos" && "text-pos",
          tone === "neg" && "text-neg",
        )}
      >
        {formatMoney(value, hide)}
      </p>
    </Card>
  );
}

function Detail({ label, value, tone }: { label: string; value: string; tone?: "neg" }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={cx("font-semibold tabular-nums mt-0.5", tone === "neg" && "text-neg")}>
        {value}
      </p>
    </div>
  );
}
