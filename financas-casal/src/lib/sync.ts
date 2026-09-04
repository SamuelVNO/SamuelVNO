"use client";

import type { FirebaseApp } from "firebase/app";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { DataSnapshot } from "./types";
import { normalize } from "./storage";
import { uid } from "./utils";

/* ------------------------------- configuração ------------------------------ */

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const isSyncConfigured = (): boolean =>
  Boolean(CONFIG.apiKey && CONFIG.projectId && CONFIG.appId);

/**
 * O SDK do Firebase pesa cerca de 100 kB e a sincronia é opcional, então ele só
 * é baixado quando as chaves existem e alguma operação de nuvem acontece.
 */
type Sdk = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  authMod: typeof import("firebase/auth");
  fsMod: typeof import("firebase/firestore");
};

let sdkPromise: Promise<Sdk> | null = null;

async function loadSdk(): Promise<Sdk> {
  const [appMod, authMod, fsMod] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/firestore"),
  ]);
  const app = appMod.getApps()[0] ?? appMod.initializeApp(CONFIG);
  const db = fsMod.initializeFirestore(app, { ignoreUndefinedProperties: true });
  return { app, auth: authMod.getAuth(app), db, authMod, fsMod };
}

async function sdk(): Promise<Sdk | null> {
  if (!isSyncConfigured() || typeof window === "undefined") return null;
  if (!sdkPromise) sdkPromise = loadSdk();
  return sdkPromise;
}

async function requireSdk(): Promise<Sdk> {
  const fb = await sdk();
  if (!fb) throw new Error("Sincronização não configurada.");
  return fb;
}

/* ---------------------------------- tipos ---------------------------------- */

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  updated_at: string;
}

const HOUSEHOLDS = "households";
const INVITES = "invites";

interface HouseholdDoc {
  name?: string;
  inviteCode?: string;
  members?: string[];
  /** Snapshot serializado como JSON. */
  data?: string;
  updatedAt?: string;
}

function toHousehold(id: string, raw: HouseholdDoc): Household {
  return {
    id,
    name: raw.name ?? "Nossas Finanças",
    invite_code: raw.inviteCode ?? "",
    updated_at: raw.updatedAt ?? "",
  };
}

/* ----------------------------------- auth ---------------------------------- */

/** Resolve assim que o Firebase termina de restaurar a sessão salva. */
export async function getSession(): Promise<User | null> {
  const fb = await sdk();
  if (!fb) return null;
  if (fb.auth.currentUser) return fb.auth.currentUser;
  return new Promise((resolve) => {
    const unsub = fb.authMod.onAuthStateChanged(fb.auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  const fb = await requireSdk();
  try {
    await fb.authMod.signInWithEmailAndPassword(fb.auth, email.trim(), password);
  } catch (err) {
    throw new Error(translateAuthError(err));
  }
}

export async function signUp(email: string, password: string): Promise<void> {
  const fb = await requireSdk();
  try {
    await fb.authMod.createUserWithEmailAndPassword(fb.auth, email.trim(), password);
  } catch (err) {
    throw new Error(translateAuthError(err));
  }
}

export async function signOut(): Promise<void> {
  const fb = await sdk();
  if (fb) await fb.authMod.signOut(fb.auth);
}

function translateAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/email-already-in-use":
      return "Este e-mail já tem conta. Faça login.";
    case "auth/weak-password":
      return "A senha precisa ter ao menos 6 caracteres.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Tente de novo em alguns minutos.";
    case "auth/network-request-failed":
      return "Sem conexão com a internet.";
    case "auth/operation-not-allowed":
      return "Ative o login por e-mail e senha no painel do Firebase.";
    default:
      return (err as { message?: string })?.message ?? "Falha ao entrar.";
  }
}

/* --------------------------------- household -------------------------------- */

function newInviteCode(): string {
  return uid().replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** O lar de que a pessoa logada faz parte, se houver. */
export async function myHousehold(): Promise<Household | null> {
  const fb = await sdk();
  const user = await getSession();
  if (!fb || !user) return null;

  const { collection, getDocs, limit, query, where } = fb.fsMod;
  const found = await getDocs(
    query(
      collection(fb.db, HOUSEHOLDS),
      where("members", "array-contains", user.uid),
      limit(1),
    ),
  );
  const first = found.docs[0];
  return first ? toHousehold(first.id, first.data() as HouseholdDoc) : null;
}

export async function createHousehold(name: string): Promise<Household> {
  const fb = await requireSdk();
  const user = await getSession();
  if (!user) throw new Error("É preciso estar autenticado.");

  const { doc, setDoc, serverTimestamp } = fb.fsMod;
  const id = uid();
  const inviteCode = newInviteCode();
  const updatedAt = new Date().toISOString();
  const householdName = name || "Nossas Finanças";

  await setDoc(doc(fb.db, HOUSEHOLDS, id), {
    name: householdName,
    inviteCode,
    ownerId: user.uid,
    members: [user.uid],
    data: "",
    updatedAt,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(fb.db, INVITES, inviteCode), { householdId: id });

  return { id, name: householdName, invite_code: inviteCode, updated_at: updatedAt };
}

export async function joinHousehold(code: string): Promise<Household> {
  const fb = await requireSdk();
  const user = await getSession();
  if (!user) throw new Error("É preciso estar autenticado.");

  const { arrayUnion, doc, getDoc, updateDoc } = fb.fsMod;
  const clean = code.trim().toUpperCase();
  const invite = await getDoc(doc(fb.db, INVITES, clean));
  const householdId = (invite.data() as { householdId?: string } | undefined)?.householdId;
  if (!invite.exists() || !householdId) throw new Error("Código de convite inválido.");

  const ref = doc(fb.db, HOUSEHOLDS, householdId);
  await updateDoc(ref, { members: arrayUnion(user.uid) });

  const fresh = await getDoc(ref);
  if (!fresh.exists()) throw new Error("Esse lar não existe mais.");
  return toHousehold(fresh.id, fresh.data() as HouseholdDoc);
}

/* --------------------------------- snapshot --------------------------------- */

function parseDoc(raw: HouseholdDoc | undefined): DataSnapshot | null {
  if (!raw?.data) return null;
  try {
    const parsed = JSON.parse(raw.data);
    if (!parsed || typeof parsed !== "object") return null;
    return normalize(parsed);
  } catch {
    return null;
  }
}

export async function pullSnapshot(householdId: string): Promise<DataSnapshot | null> {
  const fb = await sdk();
  if (!fb) return null;
  const { doc, getDoc } = fb.fsMod;
  const found = await getDoc(doc(fb.db, HOUSEHOLDS, householdId));
  return parseDoc(found.data() as HouseholdDoc | undefined);
}

export async function pushSnapshot(householdId: string, snap: DataSnapshot): Promise<void> {
  const fb = await sdk();
  if (!fb) return;
  const { doc, updateDoc } = fb.fsMod;
  await updateDoc(doc(fb.db, HOUSEHOLDS, householdId), {
    data: JSON.stringify(snap),
    updatedAt: new Date().toISOString(),
  });
}

/** Escuta alterações feitas no outro aparelho. */
export function subscribeHousehold(
  householdId: string,
  onChange: (snap: DataSnapshot) => void,
): () => void {
  let stop: (() => void) | null = null;
  let cancelled = false;

  void (async () => {
    const fb = await sdk();
    if (!fb || cancelled) return;
    const { doc, onSnapshot } = fb.fsMod;
    stop = onSnapshot(
      doc(fb.db, HOUSEHOLDS, householdId),
      (docSnap) => {
        // Ignora o eco da própria gravação ainda em trânsito.
        if (docSnap.metadata.hasPendingWrites) return;
        const parsed = parseDoc(docSnap.data() as HouseholdDoc | undefined);
        if (parsed) onChange(parsed);
      },
      () => {
        /* perda de conexão: o app segue com os dados locais */
      },
    );
    if (cancelled) stop();
  })();

  return () => {
    cancelled = true;
    stop?.();
  };
}
