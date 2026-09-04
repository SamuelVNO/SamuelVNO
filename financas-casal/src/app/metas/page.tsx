"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/components/UiProvider";
import { PageHeader } from "@/components/MonthSelector";
import {
  Button,
  Card,
  ColorPicker,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  MoneyInput,
  ProgressBar,
} from "@/components/ui";
import { goalProgress } from "@/lib/finance";
import type { Goal } from "@/lib/types";
import { cx, formatDate, formatMoney, todayISO } from "@/lib/utils";

export default function GoalsPage() {
  const { data, addGoal, updateGoal, deleteGoal, addContribution, deleteContribution } = useStore();
  const { hide, toast } = useUi();

  const [sheet, setSheet] = useState<{ open: boolean; goal: Goal | null }>({
    open: false,
    goal: null,
  });
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [toDelete, setToDelete] = useState<Goal | null>(null);
  const [detail, setDetail] = useState<Goal | null>(null);

  const goals = useMemo(
    () => data.goals.filter((g) => !g.archived).map(goalProgress),
    [data.goals],
  );

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.goal.targetAmount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Metas"
        subtitle="Os sonhos de vocês com prazo e valor"
        right={
          <Button className="shrink-0" onClick={() => setSheet({ open: true, goal: null })}>
            <Plus size={17} /> Nova meta
          </Button>
        }
      />

      {goals.length > 0 && (
        <Card className="p-4">
          <div className="flex items-end justify-between gap-3 mb-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Guardado no total</p>
              <p className="text-2xl font-bold tabular-nums">{formatMoney(totalSaved, hide)}</p>
            </div>
            <p className="text-xs text-muted tabular-nums">
              de {formatMoney(totalTarget, hide)}
            </p>
          </div>
          <ProgressBar value={totalTarget > 0 ? totalSaved / totalTarget : 0} height={10} />
        </Card>
      )}

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target size={38} />}
            title="Nenhuma meta criada"
            message="Viagem, reserva de emergência, entrada do apartamento. Defina o valor e acompanhe o progresso."
            action={
              <Button onClick={() => setSheet({ open: true, goal: null })}>
                <Plus size={17} /> Criar primeira meta
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {goals.map((g) => (
            <Card key={g.goal.id} className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${g.goal.color} 16%, transparent)`,
                    color: g.goal.color,
                  }}
                >
                  <Target size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{g.goal.name}</p>
                  {g.goal.targetDate && (
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                      <CalendarDays size={12} />
                      {formatDate(g.goal.targetDate)}
                      {g.monthsLeft !== undefined && g.monthsLeft > 0 && ` · ${g.monthsLeft} meses`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSheet({ open: true, goal: g.goal })}
                  className="p-1.5 rounded-lg text-muted hover:bg-surface-2 shrink-0 text-xs"
                >
                  Editar
                </button>
              </div>

              <div className="mt-3.5">
                <div className="flex items-end justify-between gap-2 mb-1.5">
                  <span className="text-lg font-bold tabular-nums">
                    {formatMoney(g.saved, hide)}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    de {formatMoney(g.goal.targetAmount, hide)}
                  </span>
                </div>
                <ProgressBar value={g.percent} color={g.goal.color} height={10} />
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className={cx("font-medium", g.done ? "text-pos" : "text-muted")}>
                    {g.done ? "Meta alcançada!" : `${(g.percent * 100).toFixed(0)}% concluído`}
                  </span>
                  {!g.done && g.suggestedMonthly !== undefined && g.suggestedMonthly > 0 && (
                    <span className="text-muted tabular-nums flex items-center gap-1">
                      <TrendingUp size={12} />
                      {formatMoney(g.suggestedMonthly, hide)}/mês
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-3.5">
                <Button size="sm" className="flex-1" onClick={() => setContributing(g.goal)}>
                  <Plus size={14} /> Guardar
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDetail(g.goal)}>
                  Histórico
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-neg"
                  onClick={() => setToDelete(g.goal)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GoalSheet
        state={sheet}
        onClose={() => setSheet({ open: false, goal: null })}
        onSave={(payload, id) => {
          if (id) {
            updateGoal(id, payload);
            toast("Meta atualizada");
          } else {
            addGoal(payload);
            toast("Meta criada");
          }
        }}
      />

      <ContributionSheet
        goal={contributing}
        onClose={() => setContributing(null)}
        onSave={(amount, date, note) => {
          if (contributing) {
            addContribution(contributing.id, amount, date, note);
            toast("Valor guardado!");
          }
        }}
      />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Histórico · ${detail.name}` : ""}
      >
        {detail && detail.contributions.length ? (
          <div className="divide-y divide-[var(--border)]">
            {detail.contributions
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tabular-nums">
                      {formatMoney(c.amount, hide)}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(c.date)}
                      {c.note && ` · ${c.note}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      deleteContribution(detail.id, c.id);
                      toast("Aporte removido");
                    }}
                    className="p-1.5 rounded-lg text-muted hover:bg-surface-2"
                    aria-label="Remover aporte"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-8">Nenhum aporte registrado ainda.</p>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Excluir meta"
        destructive
        confirmLabel="Excluir"
        message={<>A meta <b>{toDelete?.name}</b> e todos os aportes registrados serão apagados.</>}
        onConfirm={() => {
          if (toDelete) {
            deleteGoal(toDelete.id);
            toast("Meta excluída");
          }
        }}
      />
    </div>
  );
}

function GoalSheet({
  state,
  onClose,
  onSave,
}: {
  state: { open: boolean; goal: Goal | null };
  onClose: () => void;
  onSave: (payload: Omit<Goal, "id" | "createdAt" | "contributions">, id?: string) => void;
}) {
  const { open, goal } = state;
  const [name, setName] = useState("");
  const [target, setTarget] = useState(0);
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState("#6366f1");

  useEffect(() => {
    setName(goal?.name ?? "");
    setTarget(goal?.targetAmount ?? 0);
    setTargetDate(goal?.targetDate ?? "");
    setColor(goal?.color ?? "#6366f1");
  }, [goal, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? "Editar meta" : "Nova meta"}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!name.trim() || target <= 0}
            onClick={() => {
              onSave(
                {
                  name: name.trim(),
                  targetAmount: target,
                  targetDate: targetDate || undefined,
                  color,
                },
                goal?.id,
              );
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nome da meta">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Viagem para a praia"
            autoFocus
          />
        </Field>
        <Field label="Quanto querem juntar">
          <MoneyInput value={target} onValueChange={setTarget} />
        </Field>
        <Field label="Data alvo (opcional)" hint="Usamos para sugerir quanto guardar por mês.">
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
        <Field label="Cor">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </div>
    </Modal>
  );
}

function ContributionSheet({
  goal,
  onClose,
  onSave,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSave: (amount: number, date: string, note?: string) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  useEffect(() => {
    setAmount(0);
    setDate(todayISO());
    setNote("");
  }, [goal]);

  return (
    <Modal
      open={Boolean(goal)}
      onClose={onClose}
      title={goal ? `Guardar em ${goal.name}` : ""}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={amount <= 0}
            onClick={() => {
              onSave(amount, date, note.trim() || undefined);
              onClose();
            }}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Valor">
          <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
        </Field>
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Observação (opcional)">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: 13º salário"
          />
        </Field>
      </div>
    </Modal>
  );
}
