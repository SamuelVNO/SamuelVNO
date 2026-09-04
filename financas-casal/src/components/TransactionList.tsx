"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Check,
  Layers,
  Repeat,
} from "lucide-react";
import type { Transaction } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useUi } from "./UiProvider";
import { TransactionSheet } from "./TransactionSheet";
import { Dot } from "./ui";
import { cx, formatDate, formatMoney, relativeDueLabel, todayISO } from "@/lib/utils";

export function TransactionList({
  transactions,
  emptyMessage = "Nenhum lançamento por aqui.",
  groupByDate = true,
  showAccount = true,
}: {
  transactions: Transaction[];
  emptyMessage?: string;
  groupByDate?: boolean;
  showAccount?: boolean;
}) {
  const [editing, setEditing] = useState<Transaction | null>(null);

  const groups = useMemo(() => {
    if (!groupByDate) return [["", transactions] as const];
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions, groupByDate]);

  if (!transactions.length) {
    return <p className="text-sm text-muted text-center py-10">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map(([date, list]) => (
          <div key={date || "all"}>
            {groupByDate && (
              <div className="flex items-center justify-between px-1 mb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {dayLabel(date)}
                </p>
                <p className="text-[11px] text-muted tabular-nums">
                  {formatMoney(
                    list.reduce(
                      (s, t) =>
                        s + (t.kind === "income" ? t.amount : t.kind === "expense" ? -t.amount : 0),
                      0,
                    ),
                  )}
                </p>
              </div>
            )}
            <div className="card divide-y divide-[var(--border)] overflow-hidden">
              {list.map((t) => (
                <TransactionRow
                  key={t.id}
                  tx={t}
                  onEdit={() => setEditing(t)}
                  showAccount={showAccount}
                  showDate={!groupByDate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <TransactionSheet
        open={Boolean(editing)}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

export function TransactionRow({
  tx,
  onEdit,
  showAccount = true,
  showDate = false,
}: {
  tx: Transaction;
  onEdit?: () => void;
  showAccount?: boolean;
  showDate?: boolean;
}) {
  const { data, setPaid } = useStore();
  const { hide } = useUi();

  const category = data.categories.find((c) => c.id === tx.categoryId);
  const account = data.accounts.find((a) => a.id === tx.accountId);
  const person = data.people.find((p) => p.id === tx.personId);
  const overdue = !tx.paid && tx.date < todayISO() && tx.kind !== "transfer";

  const color =
    tx.kind === "transfer" ? "#64748b" : tx.kind === "income" ? "var(--pos)" : category?.color ?? "#94a3b8";

  const Icon =
    tx.kind === "transfer" ? ArrowLeftRight : tx.kind === "income" ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-2 transition-colors">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setPaid(tx.id, !tx.paid);
        }}
        aria-label={tx.paid ? "Marcar como pendente" : "Marcar como pago"}
        className={cx(
          "w-9 h-9 rounded-xl grid place-items-center shrink-0 transition-all border",
          tx.paid ? "border-transparent" : "border-dashed",
        )}
        style={{
          background: tx.paid ? `color-mix(in srgb, ${color} 16%, transparent)` : "transparent",
          borderColor: tx.paid ? "transparent" : "var(--border)",
          color,
        }}
      >
        {tx.paid ? <Icon size={17} /> : <Check size={15} className="opacity-40" />}
      </button>

      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <p className={cx("text-sm font-medium truncate", !tx.paid && "text-muted")}>
          {tx.description}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted flex-wrap">
          {tx.installmentId && (
            <span className="inline-flex items-center gap-0.5 text-brand-600 font-medium">
              <Layers size={11} />
              {tx.installmentNo}/{tx.installmentTotal}
            </span>
          )}
          {tx.recurrenceId && <Repeat size={11} className="text-brand-600" />}
          {showDate && <span>{formatDate(tx.date)}</span>}
          {category && (
            <span className="inline-flex items-center gap-1">
              <Dot color={category.color} size={6} />
              {category.name}
            </span>
          )}
          {showAccount && account && <span className="truncate">· {account.name}</span>}
          {person && <span>· {person.name}</span>}
        </div>
      </button>

      <div className="text-right shrink-0">
        <p
          className={cx(
            "text-sm font-semibold tabular-nums",
            tx.kind === "income" && "text-pos",
            tx.kind === "expense" && !tx.paid && "text-muted",
          )}
        >
          {tx.kind === "income" ? "+" : tx.kind === "expense" ? "−" : ""}
          {formatMoney(tx.amount, hide)}
        </p>
        {!tx.paid && (
          <p className={cx("text-[10px] mt-0.5", overdue ? "text-neg font-medium" : "text-muted")}>
            {tx.kind === "transfer" ? "pendente" : relativeDueLabel(tx.date)}
          </p>
        )}
      </div>
    </div>
  );
}

function dayLabel(isoDate: string): string {
  const today = todayISO();
  if (isoDate === today) return "Hoje";
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (isoDate === yesterday) return "Ontem";
  const parsed = new Date(`${isoDate}T12:00:00`);
  return parsed.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  });
}
