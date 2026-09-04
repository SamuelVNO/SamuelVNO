"use client";

import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "./ui";
import { cx, formatMoney } from "@/lib/utils";

/**
 * Cartão único que conta a história do mês: saldo disponível, uma barra
 * comparando entradas e saídas, e o resultado — em vez de 4 números soltos.
 */
export function MoneyOverview({
  available,
  income,
  expense,
  incomePending,
  expensePending,
  cardDebt,
  rate,
  hide,
}: {
  available: number;
  income: number;
  expense: number;
  incomePending: number;
  expensePending: number;
  cardDebt: number;
  rate: number;
  hide?: boolean;
}) {
  const balance = income - expense;
  const total = income + expense;
  const incomeShare = total > 0 ? income / total : 0.5;

  return (
    <Card className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        Saldo disponível agora
      </p>
      <p
        className={cx(
          "text-3xl sm:text-4xl font-bold tabular-nums tracking-tight mt-1",
          available < 0 && "text-neg",
        )}
      >
        {formatMoney(available, hide)}
      </p>
      <p className="text-xs text-muted mt-1">
        {cardDebt > 0
          ? `Somando as contas · fatura do cartão em aberto: ${formatMoney(cardDebt, hide)}`
          : "Somando todas as contas"}
      </p>

      <div className="h-px bg-[var(--border)] my-4" />

      <div className="flex items-center justify-between gap-3 text-sm mb-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-pos">
          <TrendingUp size={15} /> {formatMoney(income, hide)}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-neg">
          {formatMoney(expense, hide)} <TrendingDown size={15} />
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex bg-surface-2">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${incomeShare * 100}%` }}
        />
        <div
          className="h-full bg-red-500 transition-[width] duration-500"
          style={{ width: `${(1 - incomeShare) * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted">
        <span>Entrou{incomePending > 0 && ` · ${formatMoney(incomePending, hide)} a receber`}</span>
        <span>Saiu{expensePending > 0 && ` · ${formatMoney(expensePending, hide)} a pagar`}</span>
      </div>

      <div className="mt-4 pt-4 border-t border-app flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Resultado do mês</p>
          {income > 0 && (
            <p className="text-xs text-muted mt-0.5">
              {(rate * 100).toFixed(0)}% da receita {balance >= 0 ? "sobrou" : "faltou"}
            </p>
          )}
        </div>
        <span
          className={cx(
            "text-xl font-bold tabular-nums shrink-0",
            balance >= 0 ? "text-pos" : "text-neg",
          )}
        >
          {balance >= 0 ? "+" : ""}
          {formatMoney(balance, hide)}
        </span>
      </div>
    </Card>
  );
}
