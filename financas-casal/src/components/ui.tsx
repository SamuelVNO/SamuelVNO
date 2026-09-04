"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { cx, formatMoney, parseMoney } from "@/lib/utils";

/* --------------------------------- Botao ---------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm",
  secondary: "bg-surface-2 text-body border border-app hover:brightness-95",
  ghost: "text-muted hover:bg-surface-2",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center font-medium transition-colors select-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    />
  );
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("card", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight truncate">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------- Campos --------------------------------- */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} {...props} className={cx("field", className)} />;
  },
);

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} {...props} className={cx("field", className)}>
      {children}
    </select>
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} {...props} className={cx("field resize-y min-h-20", className)} />;
});

/** Campo de dinheiro com máscara pt-BR. */
export function MoneyInput({
  value,
  onValueChange,
  autoFocus,
  placeholder = "0,00",
  className,
  id,
}: {
  value: number;
  onValueChange: (n: number) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [text, setText] = useState(() => (value ? formatBR(value) : ""));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value ? formatBR(value) : "");
  }, [value]);

  return (
    <div className={cx("relative", className)}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">
        R$
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoFocus={autoFocus}
        className="field pl-9 text-right font-semibold tabular-nums"
        placeholder={placeholder}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(value ? formatBR(value) : "");
        }}
        onChange={(e) => {
          setText(e.target.value);
          onValueChange(parseMoney(e.target.value));
        }}
      />
    </div>
  );
}

function formatBR(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* -------------------------------- Modal/Sheet ------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center animate-fade">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative bg-surface w-full flex flex-col animate-sheet",
          "rounded-t-2xl sm:rounded-2xl border border-app shadow-2xl",
          "max-h-[92vh] sm:max-h-[85vh]",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-app shrink-0">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-muted hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto grow">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-app shrink-0 safe-bottom">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  destructive,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-sm text-muted leading-relaxed">{message}</div>
    </Modal>
  );
}

/* -------------------------------- Progresso -------------------------------- */

export function ProgressBar({
  value,
  color = "#6366f1",
  height = 8,
  track,
}: {
  value: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: track ?? "color-mix(in srgb, currentColor 12%, transparent)" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/* --------------------------------- Diversos -------------------------------- */

export function Badge({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap",
        className,
      )}
      style={
        color
          ? {
              background: `color-mix(in srgb, ${color} 16%, transparent)`,
              color,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: color }}
    />
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="text-muted mb-3 opacity-60">{icon}</div>}
      <p className="font-medium">{title}</p>
      {message && <p className="text-sm text-muted mt-1 max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Money({
  value,
  hide,
  signed,
  className,
  colored = true,
}: {
  value: number;
  hide?: boolean;
  signed?: boolean;
  className?: string;
  colored?: boolean;
}) {
  const tone = !colored ? "" : value > 0 ? "text-pos" : value < 0 ? "text-neg" : "";
  const prefix = signed && value > 0 ? "+" : "";
  return (
    <span className={cx("tabular-nums", tone, className)}>
      {prefix}
      {formatMoney(value, hide)}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative w-10 h-6 rounded-full transition-colors shrink-0",
          checked ? "bg-brand-600" : "bg-surface-2 border border-app",
        )}
      >
        <span
          className={cx(
            "absolute top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-white shadow transition-all",
            checked ? "left-[1.125rem]" : "left-0.5",
          )}
          style={{ width: 18, height: 18 }}
        />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string; color?: string }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex p-1 rounded-xl bg-surface-2 border border-app gap-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              "flex-1 h-9 rounded-lg text-sm font-medium transition-all",
              active ? "bg-surface shadow-sm" : "text-muted hover:text-body",
            )}
            style={active && o.color ? { color: o.color } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#ef4444", "#f97316",
    "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
    "#0ea5e9", "#3b82f6", "#a855f7", "#64748b",
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Cor ${c}`}
          onClick={() => onChange(c)}
          className={cx(
            "w-7 h-7 rounded-full transition-transform",
            value === c ? "ring-2 ring-offset-2 scale-110" : "hover:scale-110",
          )}
          style={{
            background: c,
            // @ts-expect-error custom property
            "--tw-ring-color": c,
            "--tw-ring-offset-color": "var(--surface)",
          }}
        />
      ))}
    </div>
  );
}
