"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/components/UiProvider";
import { PageHeader } from "@/components/MonthSelector";
import { TransactionSheet } from "@/components/TransactionSheet";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dot,
  EmptyState,
  ProgressBar,
  SectionTitle,
} from "@/components/ui";
import { allInstallmentProgress, futureInstallmentLoad } from "@/lib/finance";
import type { InstallmentProgress } from "@/lib/finance";
import {
  cx,
  currentMonthKey,
  formatDate,
  formatMoney,
  monthLabel,
  relativeDueLabel,
  todayISO,
} from "@/lib/utils";

export default function InstallmentsPage() {
  const { data, payNextInstallment, settleInstallment, deleteInstallment, setPaid } = useStore();
  const { hide, toast } = useUi();

  const [composer, setComposer] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<InstallmentProgress | null>(null);
  const [showDone, setShowDone] = useState(false);

  const all = useMemo(() => allInstallmentProgress(data), [data]);
  const active = all.filter((p) => !p.done);
  const done = all.filter((p) => p.done);
  const list = showDone ? done : active;

  const totals = useMemo(() => {
    const remaining = active.reduce((s, p) => s + p.remainingAmount, 0);
    const parcels = active.reduce((s, p) => s + p.remainingCount, 0);
    const thisMonth = data.transactions
      .filter(
        (t) =>
          t.installmentId &&
          !t.paid &&
          t.date.slice(0, 7) === currentMonthKey(),
      )
      .reduce((s, t) => s + t.amount, 0);
    return { remaining, parcels, thisMonth };
  }, [active, data.transactions]);

  const load = useMemo(
    () => futureInstallmentLoad(data.transactions, currentMonthKey(), 6),
    [data.transactions],
  );
  const maxLoad = Math.max(...load.map((l) => l.total), 1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parcelas"
        subtitle="Tudo que vocês compraram parcelado e quanto ainda falta"
        right={
          <Button onClick={() => setComposer(true)} className="shrink-0">
            <Plus size={17} /> Nova compra
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Falta pagar
          </p>
          <p className="text-lg sm:text-xl font-bold tabular-nums mt-1 text-neg">
            {formatMoney(totals.remaining, hide)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Parcelas</p>
          <p className="text-lg sm:text-xl font-bold tabular-nums mt-1">{totals.parcels}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Neste mês</p>
          <p className="text-lg sm:text-xl font-bold tabular-nums mt-1">
            {formatMoney(totals.thisMonth, hide)}
          </p>
        </Card>
      </div>

      {active.length > 0 && (
        <Card className="p-4">
          <SectionTitle
            title="Comprometido nos próximos meses"
            subtitle="Só o que ainda não foi pago"
          />
          <div className="flex items-end gap-2 h-28">
            {load.map((l) => (
              <div key={l.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <span className="text-[10px] text-muted tabular-nums truncate w-full text-center">
                  {l.total > 0 ? formatMoney(l.total, hide).replace("R$ ", "") : "—"}
                </span>
                <div
                  className="w-full rounded-t-md bg-brand-600/80 transition-all"
                  style={{ height: `${Math.max(2, (l.total / maxLoad) * 70)}px` }}
                />
                <span className="text-[10px] text-muted capitalize truncate w-full text-center">
                  {monthLabel(l.month, true)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {done.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowDone(false)}
            className={cx(
              "px-3.5 h-8 rounded-full text-[13px] font-medium border transition-colors",
              !showDone ? "bg-brand-600 text-white border-brand-600" : "border-app text-muted",
            )}
          >
            Em andamento ({active.length})
          </button>
          <button
            onClick={() => setShowDone(true)}
            className={cx(
              "px-3.5 h-8 rounded-full text-[13px] font-medium border transition-colors",
              showDone ? "bg-brand-600 text-white border-brand-600" : "border-app text-muted",
            )}
          >
            Quitadas ({done.length})
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers size={38} />}
            title={showDone ? "Nenhuma compra quitada ainda" : "Nenhuma compra parcelada"}
            message={
              showDone
                ? "Quando vocês terminarem de pagar um parcelamento ele aparece aqui."
                : "Cadastre uma compra em várias vezes e acompanhe quantas parcelas ainda faltam."
            }
            action={
              !showDone && (
                <Button onClick={() => setComposer(true)}>
                  <Plus size={17} /> Nova compra parcelada
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <InstallmentCard
              key={p.installment.id}
              progress={p}
              hide={hide}
              expanded={expanded === p.installment.id}
              onToggle={() =>
                setExpanded(expanded === p.installment.id ? null : p.installment.id)
              }
              onPayNext={() => {
                payNextInstallment(p.installment.id);
                toast("Parcela marcada como paga");
              }}
              onSettle={() => {
                settleInstallment(p.installment.id);
                toast("Parcelamento quitado");
              }}
              onDelete={() => setToDelete(p)}
              onTogglePaid={(id, paid) => setPaid(id, paid)}
              accountName={
                data.accounts.find((a) => a.id === p.installment.accountId)?.name ?? "—"
              }
              category={data.categories.find((c) => c.id === p.installment.categoryId)}
              personName={data.people.find((pp) => pp.id === p.installment.personId)?.name}
            />
          ))}
        </div>
      )}

      <TransactionSheet open={composer} onClose={() => setComposer(false)} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Excluir parcelamento"
        destructive
        confirmLabel="Excluir tudo"
        message={
          <>
            Isso remove <b>{toDelete?.installment.description}</b> e todas as{" "}
            {toDelete?.transactions.length} parcelas ligadas a ele, inclusive as já pagas.
          </>
        }
        onConfirm={() => {
          if (toDelete) {
            deleteInstallment(toDelete.installment.id, true);
            toast("Parcelamento excluído");
          }
        }}
      />
    </div>
  );
}

function InstallmentCard({
  progress,
  hide,
  expanded,
  onToggle,
  onPayNext,
  onSettle,
  onDelete,
  onTogglePaid,
  accountName,
  category,
  personName,
}: {
  progress: InstallmentProgress;
  hide: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPayNext: () => void;
  onSettle: () => void;
  onDelete: () => void;
  onTogglePaid: (id: string, paid: boolean) => void;
  accountName: string;
  category?: { name: string; color: string };
  personName?: string;
}) {
  const { installment: inst, paidCount, remainingCount, remainingAmount, percent, nextDue, done } =
    progress;
  const perParcel = progress.transactions[0]?.amount ?? inst.totalAmount / inst.count;
  const overdue = nextDue && nextDue.date < todayISO();

  return (
    <Card className={cx("overflow-hidden", done && "opacity-70")}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{inst.description}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted mt-1 flex-wrap">
              {category && (
                <span className="inline-flex items-center gap-1">
                  <Dot color={category.color} size={6} />
                  {category.name}
                </span>
              )}
              <span>· {accountName}</span>
              {personName && <span>· {personName}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold tabular-nums">{formatMoney(inst.totalAmount, hide)}</p>
            <p className="text-[11px] text-muted tabular-nums">
              {inst.count}x de {formatMoney(perParcel, hide)}
            </p>
          </div>
        </div>

        <div className="mt-3.5">
          <div className="flex items-center justify-between mb-1.5">
            {done ? (
              <Badge color="#10b981">
                <CheckCheck size={11} /> Quitado
              </Badge>
            ) : (
              <span className="text-sm font-semibold text-brand-600">
                Faltam {remainingCount} de {inst.count}
              </span>
            )}
            <span className="text-xs text-muted tabular-nums">
              {paidCount} paga{paidCount === 1 ? "" : "s"} · {formatMoney(remainingAmount, hide)}{" "}
              restante
            </span>
          </div>
          <ProgressBar value={percent} color={done ? "#10b981" : "#6366f1"} height={9} />
        </div>

        {nextDue && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <CalendarClock size={14} className={overdue ? "text-neg" : "text-muted"} />
            <span className={overdue ? "text-neg font-medium" : "text-muted"}>
              Próxima parcela {formatDate(nextDue.date)} · {relativeDueLabel(nextDue.date)}
            </span>
          </div>
        )}

        <div className="flex gap-2 mt-3.5 flex-wrap">
          {!done && (
            <>
              <Button size="sm" onClick={onPayNext}>
                <Check size={14} /> Pagar parcela {paidCount + 1}
              </Button>
              <Button size="sm" variant="secondary" onClick={onSettle}>
                <CheckCheck size={14} /> Quitar tudo
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={onToggle}>
            <ChevronDown
              size={14}
              className={cx("transition-transform", expanded && "rotate-180")}
            />
            {expanded ? "Ocultar" : "Ver parcelas"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="ml-auto text-neg">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-app bg-surface-2/50 divide-y divide-[var(--border)]">
          {progress.transactions.map((t) => (
            <button
              key={t.id}
              onClick={() => onTogglePaid(t.id, !t.paid)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
            >
              <span
                className={cx(
                  "w-6 h-6 rounded-md grid place-items-center shrink-0 border text-[10px] font-bold",
                  t.paid
                    ? "bg-emerald-500/15 border-transparent text-emerald-600"
                    : "border-dashed border-app text-muted",
                )}
              >
                {t.paid ? <Check size={13} /> : t.installmentNo}
              </span>
              <span className="text-sm flex-1 min-w-0">
                <span className={cx("font-medium", !t.paid && "text-muted")}>
                  Parcela {t.installmentNo}/{t.installmentTotal}
                </span>
                <span className="text-xs text-muted ml-2">{formatDate(t.date)}</span>
              </span>
              <span
                className={cx(
                  "text-sm tabular-nums font-medium shrink-0",
                  t.paid ? "text-muted line-through" : "",
                )}
              >
                {formatMoney(t.amount, hide)}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
