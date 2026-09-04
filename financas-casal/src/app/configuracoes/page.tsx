"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cloud,
  CloudOff,
  Copy,
  Download,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Sun,
  Tag,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  Monitor,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/components/UiProvider";
import { PageHeader } from "@/components/MonthSelector";
import {
  Button,
  Card,
  ColorPicker,
  ConfirmDialog,
  Dot,
  Field,
  Input,
  Modal,
  SectionTitle,
  Segmented,
  Select,
} from "@/components/ui";
import { downloadBackup, readBackupFile } from "@/lib/storage";
import { signIn, signUp } from "@/lib/supabase";
import type { Category, Person } from "@/lib/types";
import { cx } from "@/lib/utils";

export default function SettingsPage() {
  const {
    data,
    updateSettings,
    addPerson,
    updatePerson,
    deletePerson,
    addCategory,
    updateCategory,
    deleteCategory,
    replaceAll,
    resetAll,
    syncAvailable,
    syncState,
    syncError,
    household,
    connectHousehold,
    joinHousehold,
    refreshSync,
    disconnectSync,
  } = useStore();
  const { toast } = useUi();

  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [personSheet, setPersonSheet] = useState<{ open: boolean; person: Person | null }>({
    open: false,
    person: null,
  });
  const [categorySheet, setCategorySheet] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null,
  });
  const [catFilter, setCatFilter] = useState<"expense" | "income">("expense");

  const categories = data.categories
    .filter((c) => c.kind === catFilter && !c.archived)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  async function handleImport(file: File) {
    try {
      const snap = await readBackupFile(file);
      replaceAll(snap);
      toast("Backup restaurado com sucesso");
    } catch {
      toast("Não foi possível ler esse arquivo", "error");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Ajuste o app do jeito de vocês" />

      {/* -------------------------------- Geral -------------------------------- */}
      <section>
        <SectionTitle title="Geral" />
        <Card className="p-4 space-y-4">
          <Field label="Nome do lar">
            <Input
              value={data.settings.householdName}
              onChange={(e) => updateSettings({ householdName: e.target.value })}
              placeholder="Nossas Finanças"
            />
          </Field>
          <Field label="Tema">
            <Segmented
              options={[
                { value: "system" as const, label: "Automático" },
                { value: "light" as const, label: "Claro" },
                { value: "dark" as const, label: "Escuro" },
              ]}
              value={data.settings.theme}
              onChange={(v) => updateSettings({ theme: v })}
            />
            <div className="flex gap-4 mt-2 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <Monitor size={12} /> segue o celular
              </span>
              <span className="inline-flex items-center gap-1">
                <Sun size={12} /> claro
              </span>
              <span className="inline-flex items-center gap-1">
                <Moon size={12} /> escuro
              </span>
            </div>
          </Field>
        </Card>
      </section>

      {/* ------------------------------ Sincronia ------------------------------ */}
      <section>
        <SectionTitle
          title="Sincronizar entre celular e computador"
          subtitle="Para você e sua esposa verem os mesmos dados"
        />
        <SyncPanel
          available={syncAvailable}
          state={syncState}
          error={syncError}
          household={household}
          onCreate={connectHousehold}
          onJoin={joinHousehold}
          onRefresh={refreshSync}
          onDisconnect={disconnectSync}
        />
      </section>

      {/* -------------------------------- Pessoas ------------------------------- */}
      <section>
        <SectionTitle
          title="Pessoas"
          subtitle="Para saber quem gastou o quê"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPersonSheet({ open: true, person: null })}
            >
              <Plus size={15} /> Adicionar
            </Button>
          }
        />
        <Card className="divide-y divide-[var(--border)] overflow-hidden">
          {data.people.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white shrink-0"
                style={{ background: p.color }}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <button
                onClick={() => setPersonSheet({ open: true, person: p })}
                className="flex-1 text-left text-sm font-medium"
              >
                {p.name}
              </button>
              {data.people.length > 1 && (
                <button
                  onClick={() => {
                    deletePerson(p.id);
                    toast("Pessoa removida");
                  }}
                  className="p-1.5 rounded-lg text-muted hover:bg-surface-2"
                  aria-label={`Remover ${p.name}`}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {data.people.length === 0 && (
            <p className="text-sm text-muted text-center py-6">Nenhuma pessoa cadastrada.</p>
          )}
        </Card>
      </section>

      {/* ------------------------------ Categorias ------------------------------ */}
      <section>
        <SectionTitle
          title="Categorias"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCategorySheet({ open: true, category: null })}
            >
              <Plus size={15} /> Adicionar
            </Button>
          }
        />
        <Segmented
          className="mb-3"
          options={[
            { value: "expense" as const, label: "Despesas" },
            { value: "income" as const, label: "Receitas" },
          ]}
          value={catFilter}
          onChange={setCatFilter}
        />
        <Card className="divide-y divide-[var(--border)] overflow-hidden">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <Dot color={c.color} size={10} />
              <button
                onClick={() => setCategorySheet({ open: true, category: c })}
                className="flex-1 text-left text-sm"
              >
                {c.name}
              </button>
              <button
                onClick={() => {
                  deleteCategory(c.id);
                  toast("Categoria removida");
                }}
                className="p-1.5 rounded-lg text-muted hover:bg-surface-2"
                aria-label={`Remover ${c.name}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted text-center py-6">Nenhuma categoria aqui.</p>
          )}
        </Card>
        <p className="text-xs text-muted mt-2">
          Categorias já usadas em lançamentos são arquivadas em vez de apagadas, para não perder o
          histórico.
        </p>
      </section>

      {/* -------------------------------- Backup -------------------------------- */}
      <section>
        <SectionTitle title="Backup dos dados" subtitle="Guarde uma cópia ou mude de aparelho" />
        <Card className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                downloadBackup(data);
                toast("Backup baixado");
              }}
            >
              <Download size={16} /> Exportar backup
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={16} /> Restaurar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.target.value = "";
              }}
            />
          </div>
          <p className="text-xs text-muted">
            O arquivo contém todos os lançamentos, parcelas, contas, metas e orçamentos de vocês.
          </p>
        </Card>
      </section>

      {/* ------------------------------ Zona de risco --------------------------- */}
      <section>
        <SectionTitle title="Zona de risco" />
        <Card className="p-4 border-red-500/30">
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="text-neg shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Apagar tudo</p>
              <p className="text-xs text-muted mt-0.5">
                Remove todos os lançamentos, contas e configurações deste aparelho.
              </p>
            </div>
          </div>
          <Button variant="danger" className="mt-3 w-full sm:w-auto" onClick={() => setConfirmReset(true)}>
            <Trash2 size={16} /> Apagar todos os dados
          </Button>
        </Card>
      </section>

      <p className="text-center text-xs text-muted py-4">
        {data.transactions.length} lançamentos · {data.accounts.length} contas ·{" "}
        {data.installments.length} parcelamentos
      </p>

      <PersonSheet
        state={personSheet}
        onClose={() => setPersonSheet({ open: false, person: null })}
        onSave={(payload, id) => {
          if (id) updatePerson(id, payload);
          else addPerson(payload);
          toast("Pessoa salva");
        }}
      />

      <CategorySheet
        state={categorySheet}
        defaultKind={catFilter}
        onClose={() => setCategorySheet({ open: false, category: null })}
        onSave={(payload, id) => {
          if (id) updateCategory(id, payload);
          else addCategory(payload);
          toast("Categoria salva");
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Apagar todos os dados"
        destructive
        confirmLabel="Apagar tudo"
        message="Essa ação não pode ser desfeita. Recomendamos exportar um backup antes."
        onConfirm={() => {
          resetAll();
          toast("Dados apagados");
        }}
      />
    </div>
  );
}

/* ------------------------------ painel de sync ------------------------------ */

function SyncPanel({
  available,
  state,
  error,
  household,
  onCreate,
  onJoin,
  onRefresh,
  onDisconnect,
}: {
  available: boolean;
  state: string;
  error: string | null;
  household: { id: string; name: string; invite_code: string } | null;
  onCreate: (name: string) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const { toast } = useUi();
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"auth" | "household">("auth");

  if (!available) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <CloudOff size={18} className="text-muted shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Funcionando só neste aparelho</p>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Tudo está salvo localmente e continua funcionando sem internet. Para ver os mesmos
              dados no celular e no computador, configure as chaves do Supabase nas variáveis de
              ambiente e recarregue o app. O passo a passo está no arquivo README do projeto.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (household) {
    return (
      <Card className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Cloud size={18} className="text-pos shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Sincronizado na nuvem</p>
            <p className="text-xs text-muted mt-0.5">
              {state === "syncing" ? "Enviando alterações…" : "Tudo em dia entre os aparelhos."}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-2 border border-app p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted mb-1">
            Código para convidar sua esposa
          </p>
          <div className="flex items-center gap-2">
            <code className="text-lg font-bold tracking-[0.2em]">{household.invite_code}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(household.invite_code);
                toast("Código copiado");
              }}
            >
              <Copy size={14} />
            </Button>
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            Ela cria a conta dela no app e usa esse código para entrar no mesmo lar.
          </p>
        </div>

        {error && <p className="text-xs text-neg">{error}</p>}

        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void onRefresh()}>
            <RefreshCw size={14} className={state === "syncing" ? "animate-spin" : undefined} />
            Sincronizar agora
          </Button>
          <Button size="sm" variant="ghost" className="text-neg" onClick={() => void onDisconnect()}>
            <LogOut size={14} /> Sair
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Cloud size={18} className="text-brand-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Ative a sincronia</p>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Crie uma conta para acessar os mesmos dados no celular e no computador, e convide sua
              esposa para o mesmo lar.
            </p>
          </div>
        </div>
        {error && <p className="text-xs text-neg mt-2">{error}</p>}
        <Button
          className="mt-3 w-full sm:w-auto"
          onClick={() => {
            setStep(state === "signed-out" ? "auth" : "household");
            setAuthOpen(true);
          }}
        >
          <Cloud size={16} /> Configurar sincronia
        </Button>
      </Card>

      <Modal open={authOpen} onClose={() => setAuthOpen(false)} title="Sincronizar dados">
        {step === "auth" ? (
          <div className="space-y-4">
            <Segmented
              options={[
                { value: "login" as const, label: "Entrar" },
                { value: "signup" as const, label: "Criar conta" },
              ]}
              value={mode}
              onChange={setMode}
            />
            <Field label="E-mail">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </Field>
            <Field label="Senha" hint="Mínimo de 6 caracteres.">
              <Input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Button
              className="w-full"
              disabled={busy || !email || password.length < 6}
              onClick={async () => {
                setBusy(true);
                try {
                  if (mode === "login") await signIn(email, password);
                  else await signUp(email, password);
                  setStep("household");
                  toast(mode === "login" ? "Bem-vindo de volta!" : "Conta criada!");
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Falha ao entrar", "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium mb-2">É o primeiro de vocês aqui?</p>
              <Button
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onCreate("Nossas Finanças");
                    toast("Sincronia ativada!");
                    setAuthOpen(false);
                  } catch {
                    toast("Não foi possível criar o lar", "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Users size={16} /> Criar nosso lar
              </Button>
              <p className="text-xs text-muted mt-1.5">
                Seus dados atuais deste aparelho são enviados para a nuvem.
              </p>
            </div>

            <div className="h-px bg-[var(--border)]" />

            <div>
              <p className="text-sm font-medium mb-2">Já tem um código de convite?</p>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC12345"
                  className="tracking-[0.2em] font-semibold uppercase"
                  maxLength={8}
                />
                <Button
                  disabled={busy || code.length < 4}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onJoin(code);
                      toast("Vocês estão sincronizados!");
                      setAuthOpen(false);
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Código inválido", "error");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Entrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* --------------------------------- sheets ---------------------------------- */

function PersonSheet({
  state,
  onClose,
  onSave,
}: {
  state: { open: boolean; person: Person | null };
  onClose: () => void;
  onSave: (payload: Omit<Person, "id">, id?: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");

  useEffect(() => {
    if (!state.open) return;
    setName(state.person?.name ?? "");
    setColor(state.person?.color ?? "#6366f1");
  }, [state.open, state.person]);

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.person ? "Editar pessoa" : "Nova pessoa"}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!name.trim()}
            onClick={() => {
              onSave({ name: name.trim(), color }, state.person?.id);
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Samuel" autoFocus />
        </Field>
        <Field label="Cor">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </div>
    </Modal>
  );
}

function CategorySheet({
  state,
  defaultKind,
  onClose,
  onSave,
}: {
  state: { open: boolean; category: Category | null };
  defaultKind: "expense" | "income";
  onClose: () => void;
  onSave: (payload: Omit<Category, "id">, id?: string) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"expense" | "income">(defaultKind);
  const [color, setColor] = useState("#6366f1");

  useEffect(() => {
    if (!state.open) return;
    setName(state.category?.name ?? "");
    setKind(state.category?.kind ?? defaultKind);
    setColor(state.category?.color ?? "#6366f1");
  }, [state.open, state.category, defaultKind]);

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.category ? "Editar categoria" : "Nova categoria"}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!name.trim()}
            onClick={() => {
              onSave(
                { name: name.trim(), kind, color, icon: "tag" },
                state.category?.id,
              );
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nome">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Farmácia"
            autoFocus
          />
        </Field>
        <Field label="Tipo">
          <Segmented
            options={[
              { value: "expense" as const, label: "Despesa" },
              { value: "income" as const, label: "Receita" },
            ]}
            value={kind}
            onChange={setKind}
          />
        </Field>
        <Field label="Cor">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </div>
    </Modal>
  );
}
