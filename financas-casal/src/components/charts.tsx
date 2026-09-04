"use client";

import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatMoney } from "@/lib/utils";

const axisStyle = { fontSize: 11, fill: "var(--muted)" } as const;

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: { fill?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 tabular-nums">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color ?? p.payload?.fill ?? "#6366f1" }}
          />
          <span className="text-muted">{p.name}</span>
          <span className="font-semibold ml-auto">{formatMoney(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

export function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  if (!data.length) {
    return (
      <div style={{ height }} className="grid place-items-center text-sm text-muted">
        Sem dados neste período.
      </div>
    );
  }
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<TooltipBox />} />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            {centerLabel && (
              <p className="text-[10px] uppercase tracking-wide text-muted">{centerLabel}</p>
            )}
            {centerValue && <p className="text-lg font-bold tabular-nums">{centerValue}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function IncomeExpenseChart({
  data,
  height = 230,
}: {
  data: Array<{ month: string; Receitas: number; Despesas: number }>;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={4}>
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisStyle} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisStyle}
            tickFormatter={(v) => formatCompact(Number(v)).replace("R$ ", "")}
            width={52}
          />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(127,127,127,0.08)" }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 6, color: "var(--muted)" }}
          />
          <Bar dataKey="Receitas" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={26} />
          <Bar dataKey="Despesas" fill="#f43f5e" radius={[5, 5, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceAreaChart({
  data,
  height = 200,
}: {
  data: Array<{ month: string; Saldo: number }>;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisStyle} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisStyle}
            tickFormatter={(v) => formatCompact(Number(v)).replace("R$ ", "")}
            width={52}
          />
          <Tooltip content={<TooltipBox />} />
          <Area
            type="monotone"
            dataKey="Saldo"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#saldoFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizontalBars({
  data,
  total,
  hide,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  total: number;
  hide?: boolean;
}) {
  if (!data.length) {
    return <p className="text-sm text-muted text-center py-8">Sem dados neste período.</p>;
  }
  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = total > 0 ? (d.value / total) * 100 : 0;
        return (
          <div key={d.name}>
            <div className="flex items-center justify-between text-sm mb-1 gap-3">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: d.color }}
                />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="tabular-nums shrink-0 font-medium">
                {formatMoney(d.value, hide)}
                <span className="text-muted font-normal ml-1.5 text-xs">{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: d.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
