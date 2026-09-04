"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Pause, Play, Plus, Repeat, Trash2 } from "lucide-react";
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
} from "@/components/ui";
import type { Recurrence } from "@/lib/types";
import { FREQ_LABEL, cx, formatDate, formatMoney, todayISO } from "@/lib/utils";

export default function RecurringPage() {
  const { data, updateRecurrence, deleteRecurrence } = useStore();
  const { hide, toast } = useUi();

  const [composer, setComposer] = useState(false);
  const [toDelete, setToDelete] = useState<Recurrence | null>(null);

  const rows = useMemo(() => {
    const today = todayISO();
    return data.recurrences.map((r) => {
      const next = data.transactions
        .filter((t) => t.recurrenceId === r.id && !t.paid && t.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      return { rec: r, next };
    });
  }, [data.recurrences, data.transactions]);

  const monthlyTotal = useMemo(
    () =>
      data.recurrences
        .filter((r) => r.active && r.frequency === "monthly")
        .reduce((s, r) => s + (r.kind === "expense" ? r.amount : -r.amount), 0),
    [data.recurrences],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contas fixas"
        subtitle="Aluguel, assinaturas, salário: tudo que se repete todo mês"
        right={
          <Button className="shrink-0" onClick={() => setComposer(true)}>
            <Plus size={17} /> Nova conta fixa
          </Button>
        }
      />

      {rows.length > 0 && (
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Compromisso mensal fixo
          </p>
          <p className={cx("text-2xl font-bold tabular-nums mt-1", monthlyTotal > 0 && "text-neg")}>
            {formatMoney(monthlyTotal, hide)}
          </p>
          <p className="text-xs text-muted mt-1">
            Soma das despesas fixas mensais menos as receitas fixas mensais.
          </p>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat size={38} />}
            title="Nenhuma conta fixa"
            message="Cadastre o que se repete todo mês e o app lança automaticamente os próximos 12 meses."
            action={
              <Button onClick={() => setComposer(true)}>
                <Plus size={17} /> Criar conta fixa
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(({ rec, next }) => {
            const category = data.categories.find((c) => c.id === rec.categoryId);
            const account = data.accounts.find((a) => a.id === rec.accountId);
            return (
              <Card key={rec.id} className={cx("p-4", !rec.active && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${category?.color ?? "#6366f1"} 16%, transparent)`,
                      color: category?.color ?? "#6366f1",
                    }}
                  >
                    <Repeat size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{rec.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5 flex-wrap">
                      <Badge color={rec.kind === "income" ? "#10b981" : "#f43f5e"}>
                        {FREQ_LABEL[rec.frequency]}
                      </Badge>
                      {category && (
                        <span className="inline-flex items-center gap-1">
                          <Dot color={category.color} size={6} />
                          {category.name}
                        </span>
                      )}
                      {account && <span>· {account.name}</span>}
                    </div>
                  </div>
                  <p
                    className={cx(
                      "font-bold tabular-nums shrink-0",
                      rec.kind === "income" ? "text-pos" : "",
                    )}
                  >
                    {rec.kind === "income" ? "+" : "−"}
                    {formatMoney(rec.amount, hide)}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {next && rec.active && (
                    <span className="text-xs text-muted inline-flex items-center gap-1.5">
                      <CalendarClock size={13} /> Próximo em {formatDate(next.date)}
                    </span>
                  )}
                  {!rec.active && (
                    <span className="text-xs text-muted">Pausada</span>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        updateRecurrence(rec.id, { active: !rec.active });
                        toast(rec.active ? "Conta fixa pausada" : "Conta fixa retomada");
                      }}
                    >
                      {rec.active ? <Pause size={14} /> : <Play size={14} />}
                      {rec.active ? "Pausar" : "Retomar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-neg"
                      onClick={() => setToDelete(rec)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <TransactionSheet open={composer} onClose={() => setComposer(false)} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Excluir conta fixa"
        destructive
        confirmLabel="Excluir"
        message={
          <>
            <b>{toDelete?.description}</b> deixa de ser lançada. Os lançamentos futuros ainda não
            pagos serão removidos; o histórico já pago permanece.
          </>
        }
        onConfirm={() => {
          if (toDelete) {
            deleteRecurrence(toDelete.id);
            toast("Conta fixa excluída");
          }
        }}
      />
    </div>
  );
}
