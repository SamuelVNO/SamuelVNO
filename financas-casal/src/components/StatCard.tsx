"use client";

import React from "react";
import { cx, formatMoney } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  hide,
  className,
}: {
  label: string;
  value: number;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "brand";
  hide?: boolean;
  className?: string;
}) {
  const toneClass = {
    neutral: "",
    positive: "text-pos",
    negative: "text-neg",
    brand: "text-brand-600",
  }[tone];

  return (
    <div className={cx("card p-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-muted">{icon}</span>}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted truncate">
          {label}
        </p>
      </div>
      <p className={cx("text-xl sm:text-2xl font-bold tabular-nums tracking-tight", toneClass)}>
        {formatMoney(value, hide)}
      </p>
      {hint && <div className="text-xs text-muted mt-1.5">{hint}</div>}
    </div>
  );
}
