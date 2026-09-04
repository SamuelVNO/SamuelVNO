"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CreditCard,
  Eye,
  EyeOff,
  LayoutDashboard,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Settings,
  Target,
  Wallet,
  ArrowLeftRight,
  CloudOff,
  RefreshCw,
  Check,
  TriangleAlert,
} from "lucide-react";
import { cx } from "@/lib/utils";
import { useUi } from "./UiProvider";
import { useStore } from "@/lib/store";
import { TransactionSheet } from "./TransactionSheet";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const PRIMARY: NavItem[] = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { href: "/parcelas", label: "Parcelas", icon: CreditCard },
  { href: "/contas", label: "Contas", icon: Wallet },
];

const SECONDARY: NavItem[] = [
  { href: "/orcamentos", label: "Orçamentos", icon: PiggyBank },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/fixas", label: "Contas fixas", icon: CalendarClock },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export const ALL_NAV = [...PRIMARY, ...SECONDARY];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hide, toggleHide } = useUi();
  const { data } = useStore();
  const [composerOpen, setComposerOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh bg-app">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-app bg-surface z-30">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-600 grid place-items-center text-white shrink-0">
            <PiggyBank size={19} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{data.settings.householdName}</p>
            <p className="text-[11px] text-muted">Controle financeiro</p>
          </div>
        </div>

        <nav className="px-3 flex-1 overflow-y-auto no-scrollbar">
          {PRIMARY.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <div className="h-px bg-[var(--border)] my-3 mx-2" />
          {SECONDARY.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="p-3 space-y-2">
          <button
            onClick={() => setComposerOpen(true)}
            className="w-full h-11 rounded-xl bg-brand-600 text-white font-medium text-sm inline-flex items-center justify-center gap-2 hover:bg-brand-700 transition-colors"
          >
            <Plus size={17} /> Novo lançamento
          </button>
          <SyncPill />
        </div>
      </aside>

      {/* Topo mobile */}
      <header className="lg:hidden sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-app safe-top">
        <div className="h-14 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 grid place-items-center text-white shrink-0">
              <PiggyBank size={17} />
            </div>
            <p className="font-semibold text-sm truncate">{data.settings.householdName}</p>
          </div>
          <div className="flex items-center gap-1">
            <SyncPill compact />
            <button
              onClick={toggleHide}
              aria-label={hide ? "Mostrar valores" : "Ocultar valores"}
              className="p-2 rounded-lg text-muted hover:bg-surface-2"
            >
              {hide ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Conteudo */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-5 pb-32 lg:pb-10">
          <div className="hidden lg:flex justify-end mb-2">
            <button
              onClick={toggleHide}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-body transition-colors"
            >
              {hide ? <EyeOff size={15} /> : <Eye size={15} />}
              {hide ? "Mostrar valores" : "Ocultar valores"}
            </button>
          </div>
          {children}
        </div>
      </main>

      {/* Barra inferior mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-app safe-bottom">
        <div className="grid grid-cols-5 h-16">
          <TabLink item={PRIMARY[0]} active={isActive("/")} />
          <TabLink item={PRIMARY[1]} active={isActive("/lancamentos")} />
          <div className="grid place-items-center">
            <button
              onClick={() => setComposerOpen(true)}
              aria-label="Novo lançamento"
              className="w-13 h-13 -mt-6 rounded-2xl bg-brand-600 text-white grid place-items-center shadow-lg shadow-brand-600/30 active:scale-95 transition-transform"
              style={{ width: 52, height: 52 }}
            >
              <Plus size={24} />
            </button>
          </div>
          <TabLink item={PRIMARY[2]} active={isActive("/parcelas")} />
          <TabLink
            item={{ href: "/mais", label: "Mais", icon: MoreHorizontal }}
            active={
              pathname.startsWith("/mais") ||
              SECONDARY.some((s) => pathname.startsWith(s.href)) ||
              pathname.startsWith("/contas")
            }
          />
        </div>
      </nav>

      <TransactionSheet open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cx(
        "flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-colors mb-0.5",
        active ? "bg-brand-600/10 text-brand-600" : "text-muted hover:bg-surface-2 hover:text-body",
      )}
    >
      <Icon size={18} />
      {item.label}
    </Link>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cx(
        "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
        active ? "text-brand-600" : "text-muted",
      )}
    >
      <Icon size={21} />
      {item.label}
    </Link>
  );
}

function SyncPill({ compact }: { compact?: boolean }) {
  const { syncState, household, syncAvailable } = useStore();

  const map = {
    off: { icon: CloudOff, label: "Só neste aparelho", tone: "text-muted" },
    "signed-out": { icon: CloudOff, label: "Sincronia desligada", tone: "text-muted" },
    idle: { icon: Check, label: "Sincronizado", tone: "text-pos" },
    syncing: { icon: RefreshCw, label: "Sincronizando…", tone: "text-muted" },
    error: { icon: TriangleAlert, label: "Erro na sincronia", tone: "text-warn" },
  } as const;

  const state = !syncAvailable ? "off" : !household ? "signed-out" : syncState;
  const { icon: Icon, label, tone } = map[state as keyof typeof map] ?? map.off;

  if (compact) {
    return (
      <Link href="/configuracoes" aria-label={label} className={cx("p-2 rounded-lg", tone)}>
        <Icon size={16} className={state === "syncing" ? "animate-spin" : undefined} />
      </Link>
    );
  }

  return (
    <Link
      href="/configuracoes"
      className={cx(
        "flex items-center gap-2 px-3 h-9 rounded-xl text-xs border border-app hover:bg-surface-2 transition-colors",
        tone,
      )}
    >
      <Icon size={14} className={state === "syncing" ? "animate-spin" : undefined} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
