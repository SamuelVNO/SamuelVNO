"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ALL_NAV } from "@/components/AppShell";
import { PageHeader } from "@/components/MonthSelector";
import { Card } from "@/components/ui";
import { useStore } from "@/lib/store";
import { availableBalance } from "@/lib/finance";
import { useUi } from "@/components/UiProvider";
import { formatMoney } from "@/lib/utils";

export default function MorePage() {
  const { data } = useStore();
  const { hide } = useUi();
  const items = ALL_NAV.filter((i) => i.href !== "/" && i.href !== "/lancamentos" && i.href !== "/contas");

  return (
    <div className="space-y-5">
      <PageHeader title="Mais" subtitle={data.settings.householdName} />

      <Card className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Saldo disponível
        </p>
        <p className="text-2xl font-bold tabular-nums mt-1">
          {formatMoney(availableBalance(data.accounts, data.transactions), hide)}
        </p>
      </Card>

      <Card className="divide-y divide-[var(--border)] overflow-hidden">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-surface-2 grid place-items-center text-brand-600 shrink-0">
                <Icon size={18} />
              </span>
              <span className="flex-1 font-medium text-sm">{item.label}</span>
              <ChevronRight size={17} className="text-muted" />
            </Link>
          );
        })}
      </Card>

      <p className="text-center text-xs text-muted pt-2">
        Finanças do Casal · feito para vocês dois
      </p>
    </div>
  );
}
