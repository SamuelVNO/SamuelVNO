"use client";

import type {
  CollectionName,
  DataSnapshot,
  Tombstone,
} from "./types";
import { emptySnapshot, DEFAULT_SETTINGS, SCHEMA_VERSION } from "./seed";
import { nowISO } from "./utils";

export const STORAGE_KEY = "financas-casal:v1";

/* ------------------------------ armazenamento ------------------------------ */

export function loadLocal(): DataSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocal(snap: DataSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch (err) {
    console.error("Não foi possível salvar localmente:", err);
  }
}

/** Garante que um snapshot vindo de fora tenha todos os campos esperados. */
export function normalize(input: unknown): DataSnapshot {
  const base = emptySnapshot();
  const raw = (input ?? {}) as Partial<DataSnapshot>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  return {
    version: SCHEMA_VERSION,
    people: arr(raw.people).length ? arr(raw.people) : base.people,
    accounts: arr(raw.accounts),
    categories: arr(raw.categories).length ? arr(raw.categories) : base.categories,
    transactions: arr(raw.transactions),
    installments: arr(raw.installments),
    recurrences: arr(raw.recurrences),
    budgets: arr(raw.budgets),
    goals: arr(raw.goals),
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    tombstones: arr(raw.tombstones),
    updatedAt: raw.updatedAt ?? nowISO(),
  };
}

/* ---------------------------------- merge ---------------------------------- */

const COLLECTIONS: CollectionName[] = [
  "people",
  "accounts",
  "categories",
  "transactions",
  "installments",
  "recurrences",
  "budgets",
  "goals",
];

type WithId = { id: string; updatedAt?: string; createdAt?: string };

const stamp = (e: WithId) => e.updatedAt ?? e.createdAt ?? "";

/**
 * Une dois snapshots item a item. Vence sempre o registro com carimbo mais
 * recente; exclusoes viram tombstones para nao "ressuscitarem" na sincronia.
 */
export function mergeSnapshots(a: DataSnapshot, b: DataSnapshot): DataSnapshot {
  const tombstones = dedupeTombstones([...a.tombstones, ...b.tombstones]);
  const deletedAt = new Map(tombstones.map((t) => [`${t.collection}:${t.id}`, t.at]));

  const out = { ...(a.updatedAt >= b.updatedAt ? a : b) } as DataSnapshot;

  for (const key of COLLECTIONS) {
    const merged = new Map<string, WithId>();
    for (const item of [...(a[key] as WithId[]), ...(b[key] as WithId[])]) {
      if (!item?.id) continue;
      const prev = merged.get(item.id);
      if (!prev || stamp(item) > stamp(prev)) merged.set(item.id, item);
    }
    const list = [...merged.values()].filter((item) => {
      const at = deletedAt.get(`${key}:${item.id}`);
      return !at || stamp(item) > at;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[key] = list;
  }

  out.settings = a.updatedAt >= b.updatedAt ? a.settings : b.settings;
  out.tombstones = tombstones;
  out.updatedAt = a.updatedAt >= b.updatedAt ? a.updatedAt : b.updatedAt;
  out.version = SCHEMA_VERSION;
  return out;
}

/** Mantem apenas o tombstone mais recente por item e descarta os muito antigos. */
function dedupeTombstones(list: Tombstone[]): Tombstone[] {
  const cutoff = new Date(Date.now() - 180 * 86_400_000).toISOString();
  const map = new Map<string, Tombstone>();
  for (const t of list) {
    if (!t?.id || t.at < cutoff) continue;
    const key = `${t.collection}:${t.id}`;
    const prev = map.get(key);
    if (!prev || t.at > prev.at) map.set(key, t);
  }
  return [...map.values()];
}

/* ------------------------------ backup / json ------------------------------ */

export function exportJSON(snap: DataSnapshot): string {
  return JSON.stringify({ ...snap, exportedAt: nowISO() }, null, 2);
}

export function downloadBackup(snap: DataSnapshot): void {
  const blob = new Blob([exportJSON(snap)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `financas-casal-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function readBackupFile(file: File): Promise<DataSnapshot> {
  const text = await file.text();
  return normalize(JSON.parse(text));
}
