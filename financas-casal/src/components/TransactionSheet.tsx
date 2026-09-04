"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Repeat, Layers, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "./UiProvider";
import type { RecurrenceFreq, Transaction, TxKind } from "@/lib/types";
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  MoneyInput,
  Segmented,
  Select,
  Textarea,
  Toggle,
} from "./ui";
import { FREQ_LABEL, formatMoney, round2, splitInstallments, todayISO } from "@/lib/utils";

type Mode = "single" | "installment" | "recurring";

export function TransactionSheet({
  open,
  onClose,
  editing,
  defaultKind = "expense",
  defaultAccountId,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  defaultKind?: TxKind;
  defaultAccountId?: string;
}) {
  const {
    data,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addInstallment,
    addRecurrence,
  } = useStore();
  const { toast } = useUi();

  const accounts = useMemo(() => data.accounts.filter((a) => !a.archived), [data.accounts]);
  const isEdit = Boolean(editing);

  const [kind, setKind] = useState<TxKind>(defaultKind);
  const [mode, setMode] = useState<Mode>("single");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [personId, setPersonId] = useState("");
  const [paid, setPaid] = useState(true);
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* parcelamento */
  const [count, setCount] = useState(2);
  const [alreadyPaid, setAlreadyPaid] = useState(0);
  const [perInstallment, setPerInstallment] = useState(false);

  /* recorrencia */
  const [frequency, setFrequency] = useState<RecurrenceFreq>("monthly");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setKind(editing.kind);
      setMode("single");
      setDescription(editing.description);
      setAmount(editing.amount);
      setDate(editing.date);
      setAccountId(editing.accountId);
      setToAccountId(editing.toAccountId ?? "");
      setCategoryId(editing.categoryId ?? "");
      setPersonId(editing.personId ?? "");
      setPaid(editing.paid);
      setNotes(editing.notes ?? "");
    } else {
      setKind(defaultKind);
      setMode("single");
      setDescription("");
      setAmount(0);
      setDate(todayISO());
      setAccountId(defaultAccountId ?? accounts[0]?.id ?? "");
      setToAccountId("");
      setCategoryId("");
      setPersonId("");
      setPaid(true);
      setNotes("");
      setCount(2);
      setAlreadyPaid(0);
      setPerInstallment(false);
      setFrequency("monthly");
      setEndDate("");
    }
  }, [open, editing, defaultKind, defaultAccountId, accounts]);

  const categories = useMemo(
    () =>
      data.categories
        .filter((c) => !c.archived && c.kind === (kind === "income" ? "income" : "expense"))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [data.categories, kind],
  );

  const preview = useMemo(() => {
    if (mode !== "installment" || amount <= 0 || count < 1) return null;
    const total = perInstallment ? round2(amount * count) : amount;
    const parts = perInstallment
      ? Array.from({ length: count }, () => amount)
      : splitInstallments(amount, count);
    return { total, first: parts[0], rest: parts[1] ?? parts[0] };
  }, [mode, amount, count, perInstallment]);

  const canSave =
    description.trim().length > 0 &&
    amount > 0 &&
    accountId.length > 0 &&
    (kind !== "transfer" || (toAccountId.length > 0 && toAccountId !== accountId));

  function handleSave() {
    if (!canSave) return;

    if (isEdit && editing) {
      updateTransaction(editing.id, {
        kind,
        description: description.trim(),
        amount,
        date,
        accountId,
        toAccountId: kind === "transfer" ? toAccountId : undefined,
        categoryId: kind === "transfer" ? undefined : categoryId || undefined,
        personId: personId || undefined,
        paid,
        notes: notes.trim() || undefined,
      });
      toast("Lançamento atualizado");
      onClose();
      return;
    }

    if (mode === "installment" && kind !== "transfer") {
      addInstallment({
        description: description.trim(),
        totalAmount: amount,
        count,
        firstDueDate: date,
        accountId,
        categoryId: categoryId || undefined,
        personId: personId || undefined,
        kind: kind === "income" ? "income" : "expense",
        notes: notes.trim() || undefined,
        alreadyPaid,
        amountIsPerInstallment: perInstallment,
      });
      toast(`Parcelamento criado em ${count}x`);
      onClose();
      return;
    }

    if (mode === "recurring" && kind !== "transfer") {
      addRecurrence({
        description: description.trim(),
        amount,
        kind: kind === "income" ? "income" : "expense",
        frequency,
        startDate: date,
        endDate: endDate || undefined,
        accountId,
        categoryId: categoryId || undefined,
        personId: personId || undefined,
      });
      toast("Conta fixa criada");
      onClose();
      return;
    }

    addTransaction({
      kind,
      description: description.trim(),
      amount,
      date,
      accountId,
      toAccountId: kind === "transfer" ? toAccountId : undefined,
      categoryId: kind === "transfer" ? undefined : categoryId || undefined,
      personId: personId || undefined,
      paid,
      notes: notes.trim() || undefined,
    });
    toast(kind === "income" ? "Receita registrada" : "Despesa registrada");
    onClose();
  }

  const kindOptions = [
    { value: "expense" as TxKind, label: "Despesa" },
    { value: "income" as TxKind, label: "Receita" },
    { value: "transfer" as TxKind, label: "Transferência" },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? "Editar lançamento" : "Novo lançamento"}
        footer={
          <div className="flex gap-2">
            {isEdit && (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Excluir">
                <Trash2 size={17} />
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!canSave} className="flex-1">
              Salvar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Segmented options={kindOptions} value={kind} onChange={setKind} />

          <Field label="Valor">
            <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
          </Field>

          <Field label="Descrição">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={kind === "income" ? "Ex.: Salário de setembro" : "Ex.: Mercado do mês"}
              maxLength={120}
            />
          </Field>

          {!isEdit && kind !== "transfer" && (
            <div className="grid grid-cols-3 gap-2">
              <ModeChip
                active={mode === "single"}
                onClick={() => setMode("single")}
                label="Única"
              />
              <ModeChip
                active={mode === "installment"}
                onClick={() => setMode("installment")}
                icon={<Layers size={14} />}
                label="Parcelado"
              />
              <ModeChip
                active={mode === "recurring"}
                onClick={() => setMode("recurring")}
                icon={<Repeat size={14} />}
                label="Fixa"
              />
            </div>
          )}

          {mode === "installment" && !isEdit && (
            <div className="rounded-xl border border-app bg-surface-2 p-3.5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nº de parcelas">
                  <Input
                    type="number"
                    min={2}
                    max={120}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                  />
                </Field>
                <Field label="Já pagas">
                  <Input
                    type="number"
                    min={0}
                    max={count}
                    value={alreadyPaid}
                    onChange={(e) =>
                      setAlreadyPaid(Math.min(count, Math.max(0, Number(e.target.value) || 0)))
                    }
                  />
                </Field>
              </div>
              <Toggle
                checked={perInstallment}
                onChange={setPerInstallment}
                label="O valor acima é de cada parcela"
              />
              {preview && (
                <p className="text-xs text-muted leading-relaxed">
                  Total {formatMoney(preview.total)} em {count}x de {formatMoney(preview.rest)}
                  {preview.first !== preview.rest && (
                    <> (a 1ª fica {formatMoney(preview.first)})</>
                  )}
                  . As parcelas caem no mesmo dia dos próximos meses.
                </p>
              )}
            </div>
          )}

          {mode === "recurring" && !isEdit && (
            <div className="rounded-xl border border-app bg-surface-2 p-3.5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Repete">
                  <Select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurrenceFreq)}
                  >
                    {(Object.keys(FREQ_LABEL) as RecurrenceFreq[]).map((f) => (
                      <option key={f} value={f}>
                        {FREQ_LABEL[f]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Até (opcional)">
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </Field>
              </div>
              <p className="text-xs text-muted">
                Os próximos 12 meses são lançados automaticamente e renovados conforme o tempo passa.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === "single" ? "Data" : "1ª data"}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={kind === "transfer" ? "De" : "Conta"}>
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {kind === "transfer" ? (
            <Field label="Para">
              <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Selecione…</option>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Quem">
                <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                  <option value="">Conjunto</option>
                  {data.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {mode === "single" && (
            <Toggle
              checked={paid}
              onChange={setPaid}
              label={kind === "income" ? "Já recebi" : "Já foi pago"}
            />
          )}

          <Field label="Observação (opcional)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre este lançamento"
              rows={2}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir lançamento"
        destructive
        confirmLabel="Excluir"
        message="Esta ação não pode ser desfeita."
        onConfirm={() => {
          if (editing) {
            deleteTransaction(editing.id);
            toast("Lançamento excluído");
            onClose();
          }
        }}
      />
    </>
  );
}

function ModeChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-9 rounded-xl text-[13px] font-medium border transition-colors inline-flex items-center justify-center gap-1.5 " +
        (active
          ? "border-brand-500 bg-brand-600/10 text-brand-600"
          : "border-app text-muted hover:bg-surface-2")
      }
    >
      {icon}
      {label}
    </button>
  );
}
