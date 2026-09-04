"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Layers,
  PiggyBank,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/components/UiProvider";
import { PageHeader } from "@/components/MonthSelector";
import { StatCard } from "@/components/StatCard";
import { Card, ProgressBar, SectionTitle, Money } from "@/components/ui";
import { DonutChart, IncomeExpenseChart } from "@/components/charts";
import { TransactionRow } from "@/components/TransactionList";
import {
  allInstallmentProgress,
  availableBalance,
  budgetStatus,
  categoryBreakdown,
  creditCardDebt,
  goalProgress,
  monthSummary,
  monthlySeries,
  savingsRate,
  transactionsOfMonth,
  upcomingBills,
} from "@/lib/finance";
import { formatMoney, monthLabel } from "@/lib/utils";

export default function DashboardPage() {
  const { data, ready } = useStore();
  const { month, hide } = useUi();

  const summary = useMemo(() => monthSummary(data.transactions, month), [data.transactions, month]);
  const available = useMemo(
    () => availableBalance(data.accounts, data.transactions),
    [data.accounts, data.transactions],
  );
  const cardDebt = useMemo(
    () => creditCardDebt(data.accounts, data.transactions),
    [data.accounts, data.transactions],
  );
  const monthTxs = useMemo(
    () => transactionsOfMonth(data.transactions, month),
    [data.transactions, month],
  );
  const byCategory = useMemo(
    () => categoryBreakdown(monthTxs, data.categories, "expense").slice(0, 6),
    [monthTxs, data.categories],
  );
  const series = useMemo(
    () => monthlySeries(data.transactions, month, 6),
    [data.transactions, month],
  );
  const bills = useMemo(() => upcomingBills(data.transactions, 30, 5), [data.transactions]);
  const installments = useMemo(
    () => allInstallmentProgress(data).filter((i) => !i.done).slice(0, 3),
    [data],
  );
  const budgets = useMemo(() => budgetStatus(data, month).slice(0, 3), [data, month]);
  const goals = useMemo(
    () => data.goals.filter((g) => !g.archived).map(goalProgress).slice(0, 2),
    [data.goals],
  );

  const rate = savingsRate(summary);
  const overdueCount = data.transactions.filter(
    (t) => !t.paid && t.kind !== "transfer" && t.date < new Date().toISOString().slice(0, 10),
  ).length;

  if (!ready) {
    return <div className="py-20 text-center text-sm text-muted">Carregando…</div>;
  }

  const hasNothing = data.transactions.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Início"
        subtitle={`Visão geral de ${monthLabel(month).toLowerCase()}`}
        withMonth
      />

      {hasNothing && <WelcomeCard />}

      {overdueCount > 0 && (
        <Link
          href="/lancamentos?filtro=atrasados"
          className="card p-3.5 flex items-center gap-3 border-red-500/40 bg-red-500/5 hover:bg-red-500/10 transition-colors"
        >
          <AlertTriangle size={18} className="text-neg shrink-0" />
          <p className="text-sm flex-1">
            <span className="font-semibold text-neg">{overdueCount}</span>{" "}
            {overdueCount === 1 ? "conta vencida" : "contas vencidas"} esperando pagamento.
          </p>
          <ArrowRight size={16} className="text-muted shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Saldo disponível"
          value={available}
          tone={available >= 0 ? "neutral" : "negative"}
          icon={<Wallet size={14} />}
          hide={hide}
          hint={cardDebt > 0 ? `Cartões: ${formatMoney(cardDebt, hide)}` : "Somando todas as contas"}
        />
        <StatCard
          label="Receitas do mês"
          value={summary.income}
          tone="positive"
          icon={<TrendingUp size={14} />}
          hide={hide}
          hint={
            summary.incomePending > 0
              ? `${formatMoney(summary.incomePending, hide)} a receber`
              : "Tudo recebido"
          }
        />
        <StatCard
          label="Despesas do mês"
          value={summary.expense}
          tone="negative"
          icon={<TrendingDown size={14} />}
          hide={hide}
          hint={
            summary.expensePending > 0
              ? `${formatMoney(summary.expensePending, hide)} a pagar`
              : "Tudo pago"
          }
        />
        <StatCard
          label="Resultado"
          value={summary.balance}
          tone={summary.balance >= 0 ? "positive" : "negative"}
          icon={<PiggyBank size={14} />}
          hide={hide}
          hint={
            summary.income > 0
              ? `${(rate * 100).toFixed(0)}% da receita ${summary.balance >= 0 ? "sobrou" : "no vermelho"}`
              : "Sem receitas no mês"
          }
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionTitle
            title="Para onde foi o dinheiro"
            subtitle={monthLabel(month)}
            action={
              <Link href="/relatorios" className="text-xs text-brand-600 font-medium">
                Ver tudo
              </Link>
            }
          />
          <DonutChart
            data={byCategory.map((c) => ({ name: c.name, value: c.total, color: c.color }))}
            centerLabel="Total"
            centerValue={formatMoney(summary.expense, hide)}
          />
          <div className="mt-3 space-y-1.5">
            {byCategory.slice(0, 4).map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: c.color }}
                />
                <span className="truncate flex-1">{c.name}</span>
                <span className="text-muted tabular-nums">{(c.share * 100).toFixed(0)}%</span>
                <span className="tabular-nums font-medium w-24 text-right">
                  {formatMoney(c.total, hide)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle title="Receitas x despesas" subtitle="Últimos 6 meses" />
          <IncomeExpenseChart
            data={series.map((s) => ({
              month: monthLabel(s.month, true),
              Receitas: s.income,
              Despesas: s.expense,
            }))}
          />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <SectionTitle
            title="Próximos vencimentos"
            subtitle="Nos próximos 30 dias"
            action={
              <Link href="/lancamentos" className="text-xs text-brand-600 font-medium">
                Ver todos
              </Link>
            }
          />
          {bills.length ? (
            <div className="-mx-3.5 divide-y divide-[var(--border)]">
              {bills.map((t) => (
                <TransactionRow key={t.id} tx={t} showDate />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-8">
              Nada vencendo por enquanto. Tudo em dia!
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle
              title="Parcelas em andamento"
              action={
                <Link href="/parcelas" className="text-xs text-brand-600 font-medium">
                  Ver todas
                </Link>
              }
            />
            {installments.length ? (
              <div className="space-y-3.5">
                {installments.map((p) => (
                  <div key={p.installment.id}>
                    <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                      <span className="truncate font-medium flex items-center gap-1.5">
                        <Layers size={13} className="text-brand-600 shrink-0" />
                        {p.installment.description}
                      </span>
                      <span className="text-xs text-muted shrink-0 tabular-nums">
                        faltam {p.remainingCount} de {p.installment.count}
                      </span>
                    </div>
                    <ProgressBar value={p.percent} color="#6366f1" />
                    <p className="text-[11px] text-muted mt-1 tabular-nums">
                      {formatMoney(p.remainingAmount, hide)} restantes
                      {p.nextDue && ` · próxima em ${p.nextDue.date.split("-").reverse().join("/")}`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-6">
                Nenhuma compra parcelada em aberto.
              </p>
            )}
          </Card>

          {budgets.length > 0 && (
            <Card className="p-4">
              <SectionTitle
                title="Orçamentos"
                action={
                  <Link href="/orcamentos" className="text-xs text-brand-600 font-medium">
                    Ver todos
                  </Link>
                }
              />
              <div className="space-y-3.5">
                {budgets.map((b) => (
                  <div key={b.budget.id}>
                    <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                      <span className="truncate">{b.category?.name ?? "Categoria"}</span>
                      <span className="text-xs tabular-nums shrink-0">
                        <Money value={b.spent} colored={false} hide={hide} /> /{" "}
                        <span className="text-muted">{formatMoney(b.budget.amount, hide)}</span>
                      </span>
                    </div>
                    <ProgressBar
                      value={b.percent}
                      color={b.over ? "var(--neg)" : b.percent > 0.8 ? "var(--warn)" : b.category?.color ?? "#6366f1"}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {goals.length > 0 && (
            <Card className="p-4">
              <SectionTitle
                title="Metas"
                action={
                  <Link href="/metas" className="text-xs text-brand-600 font-medium">
                    Ver todas
                  </Link>
                }
              />
              <div className="space-y-3.5">
                {goals.map((g) => (
                  <div key={g.goal.id}>
                    <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                      <span className="truncate flex items-center gap-1.5">
                        <Target size={13} style={{ color: g.goal.color }} className="shrink-0" />
                        {g.goal.name}
                      </span>
                      <span className="text-xs text-muted tabular-nums shrink-0">
                        {(g.percent * 100).toFixed(0)}%
                      </span>
                    </div>
                    <ProgressBar value={g.percent} color={g.goal.color} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeCard() {
  return (
    <Card className="p-5 bg-brand-600/5 border-brand-500/30">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white grid place-items-center shrink-0">
          <PiggyBank size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">Bem-vindos ao controle de vocês</p>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Comece cadastrando suas contas e o primeiro lançamento no botão <b>+</b>. Compras
            parceladas viram automaticamente uma lista com quantas parcelas ainda faltam.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Link
              href="/contas"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 border border-brand-500/40 rounded-lg px-3 h-8"
            >
              <Wallet size={14} /> Cadastrar contas
            </Link>
            <Link
              href="/parcelas"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 border border-brand-500/40 rounded-lg px-3 h-8"
            >
              <CreditCard size={14} /> Lançar parcelamento
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
