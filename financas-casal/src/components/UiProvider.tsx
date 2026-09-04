"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useStore } from "@/lib/store";
import { currentMonthKey } from "@/lib/utils";

interface UiValue {
  month: string;
  setMonth: (m: string) => void;
  hide: boolean;
  toggleHide: () => void;
  toast: (message: string, tone?: "ok" | "error") => void;
}

const UiContext = createContext<UiValue | null>(null);

export function useUi(): UiValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi precisa estar dentro de <UiProvider>.");
  return ctx;
}

interface ToastItem {
  id: number;
  message: string;
  tone: "ok" | "error";
}

export function UiProvider({ children }: { children: React.ReactNode }) {
  const { data, updateSettings, ready } = useStore();
  const [month, setMonth] = useState(currentMonthKey);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  /* tema */
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const apply = (dark: boolean) => root.classList.toggle("dark", dark);
    const pref = data.settings.theme;

    if (pref === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const listener = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
    apply(pref === "dark");
  }, [data.settings.theme, ready]);

  const toast = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const toggleHide = useCallback(
    () => updateSettings({ hideValues: !data.settings.hideValues }),
    [data.settings.hideValues, updateSettings],
  );

  const value = useMemo<UiValue>(
    () => ({ month, setMonth, hide: data.settings.hideValues, toggleHide, toast }),
    [month, data.settings.hideValues, toggleHide, toast],
  );

  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none px-4 w-full max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "animate-sheet w-full text-center px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border " +
              (t.tone === "error"
                ? "bg-red-600 text-white border-red-500"
                : "bg-surface text-body border-app")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </UiContext.Provider>
  );
}
