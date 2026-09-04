"use client";

import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import type { DataSnapshot } from "./types";
import { normalize } from "./storage";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSyncConfigured = (): boolean => Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!isSyncConfigured()) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  data: unknown;
  updated_at: string;
}

/* ----------------------------------- auth ---------------------------------- */

export async function getSession(): Promise<Session | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string) {
  const sb = supabase();
  if (!sb) throw new Error("Sincronização não configurada.");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signUp(email: string, password: string) {
  const sb = supabase();
  if (!sb) throw new Error("Sincronização não configurada.");
  const { error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signOut() {
  await supabase()?.auth.signOut();
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered")) return "Este e-mail já tem conta. Faça login.";
  if (m.includes("password should be")) return "A senha precisa ter ao menos 6 caracteres.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  return message;
}

/* --------------------------------- household -------------------------------- */

export async function myHousehold(): Promise<Household | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("households")
    .select("id,name,invite_code,data,updated_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Household) ?? null;
}

export async function createHousehold(name: string): Promise<Household> {
  const sb = supabase();
  if (!sb) throw new Error("Sincronização não configurada.");
  const { data, error } = await sb.rpc("create_household", { p_name: name });
  if (error) throw new Error(error.message);
  return data as Household;
}

export async function joinHousehold(code: string): Promise<Household> {
  const sb = supabase();
  if (!sb) throw new Error("Sincronização não configurada.");
  const { data, error } = await sb.rpc("join_household", { p_code: code });
  if (error) throw new Error(error.message);
  return data as Household;
}

export async function pullSnapshot(householdId: string): Promise<DataSnapshot | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("households")
    .select("data")
    .eq("id", householdId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const doc = (data as { data?: unknown } | null)?.data;
  if (!doc || typeof doc !== "object" || !Object.keys(doc).length) return null;
  return normalize(doc);
}

export async function pushSnapshot(householdId: string, snap: DataSnapshot): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb
    .from("households")
    .update({ data: snap, updated_at: new Date().toISOString() })
    .eq("id", householdId);
  if (error) throw new Error(error.message);
}

/** Escuta alterações feitas no outro aparelho. */
export function subscribeHousehold(
  householdId: string,
  onChange: (snap: DataSnapshot) => void,
): () => void {
  const sb = supabase();
  if (!sb) return () => {};

  const channel = sb
    .channel(`household:${householdId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "households", filter: `id=eq.${householdId}` },
      (payload) => {
        const doc = (payload.new as { data?: unknown })?.data;
        if (doc && typeof doc === "object" && Object.keys(doc).length) {
          onChange(normalize(doc));
        }
      },
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}
