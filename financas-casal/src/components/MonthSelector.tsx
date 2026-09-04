"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useUi } from "./UiProvider";
import { addMonthsToKey, currentMonthKey, monthLabel } from "@/lib/utils";

export function MonthSelector({ className }: { className?: string }) {
  const { month, setMonth } = useUi();
  const isCurrent = month === currentMonthKey();

  return (
    <div className={"flex items-center gap-1 " + (className ?? "")}>
      <button
        onClick={() => setMonth(addMonthsToKey(month, -1))}
        aria-label="Mês anterior"
        className="p-2 rounded-lg text-muted hover:bg-surface-2 transition-colors"
      >
        <ChevronLeft size={19} />
      </button>
      <button
        onClick={() => setMonth(currentMonthKey())}
        className="px-3 h-9 rounded-lg font-semibold text-sm inline-flex items-center gap-2 hover:bg-surface-2 transition-colors min-w-[9.5rem] justify-center"
        title="Voltar para o mês atual"
      >
        {!isCurrent && <CalendarDays size={15} className="text-brand-600" />}
        {monthLabel(month)}
      </button>
      <button
        onClick={() => setMonth(addMonthsToKey(month, 1))}
        aria-label="Próximo mês"
        className="p-2 rounded-lg text-muted hover:bg-surface-2 transition-colors"
      >
        <ChevronRight size={19} />
      </button>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
  withMonth,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  withMonth?: boolean;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {withMonth && (
        <div className="mt-3 -ml-2">
          <MonthSelector />
        </div>
      )}
    </div>
  );
}
