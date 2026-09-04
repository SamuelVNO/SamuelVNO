"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  Pencil,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/components/UiProvider";
import { PageHeader } from "@/components/MonthSelector";
import {
  Button,
  Card,
  ColorPicker,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  MoneyInput,
  ProgressBar,
  SectionTitle,
  Select,
} from "@/components/ui";
import { TransactionRow } from "@/components/TransactionList";
import { accountBalance, availableBalance, cardInvoice, creditCardDebt } from "@/lib/finance";
import type { Account, AccountType } from "@/lib/types";
import { ACCOUNT_TYPE_LABEL, cx, formatDate, formatMoney } from "@/lib/utils";

const ICONS: Record<AccountType, React.ElementType> = {
  checking: Landmark,
  savings: PiggyBank,
  cash: Banknote,
  credit_card: CreditCard,
  investment: TrendingUp,
};

export default function AccountsPage() {
  const { data, addAccount, updateAccount, deleteAccount } = useStore();
  const { hide, month, toast } = useUi();

  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [openCard, setOpenCard] = useState<Account | null>(null);

  const accounts = data.accounts.filter((a) => !a.archived);
  const wallets = accounts.filter((a) => a.type !== "credit_card");
  const cards = accounts.filter((a) => a.type === "credit_card");

  const total = useMemo(
    () => availableBalance(data.accounts, data.transactions),
    [data.accounts, data.transactions],
  );
  const debt = useMemo(
    () => creditCardDebt(data.accounts, data.transactions),
    [data.accounts, data.transactions],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contas e cartões"
        subtitle="Onde o dinheiro de vocês está"
        right={
          <Button onClick={() => setCreating(true)} className="shrink-0">
            <Plus size={17} /> Nova conta
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Total disponível
          </p>
          <p className={cx("text-xl font-bold tabular-nums mt-1", total < 0 && "text-neg")}>
            {formatMoney(total, hide)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Faturas em aberto
          </p>
          <p className={cx("text-xl font-bold tabular-nums mt-1", debt > 0 && "text-neg")}>
            {formatMoney(debt, hide)}
          </p>
        </Card>
      </div>

      {accounts.length === 0 && (
        <Card>
          <EmptyState
            icon={<Wallet size={38} />}
            title="Nenhuma conta cadastrada"
            message="Cadastre a conta do banco, o dinheiro em espécie e os cartões de crédito de vocês."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus size={17} /> Cadastrar conta
              </Button>
            }
          />
        </Card>
      )}

      {wallets.length > 0 && (
        <section>
          <SectionTitle title="Contas" />
          <div className="grid sm:grid-cols-2 gap-3">
            {wallets.map((a) => {
              const balance = accountBalance(a, data.transactions);
              const Icon = ICONS[a.type];
              return (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                      style={{ background: `color-mix(in srgb, ${a.color} 16%, transparent)`, color: a.color }}
                    >
                      <Icon size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{a.name}</p>
                      <p className="text-xs text-muted">{ACCOUNT_TYPE_LABEL[a.type]}</p>
                    </div>
                    <button
                      onClick={() => setEditing(a)}
                      className="p-1.5 rounded-lg text-muted hover:bg-surface-2"
                      aria-label="Editar conta"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                  <p
                    className={cx(
                      "text-xl font-bold tabular-nums mt-3",
                      balance < 0 ? "text-neg" : "",
                    )}
                  >
                    {formatMoney(balance, hide)}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {cards.length > 0 && (
        <section>
          <SectionTitle title="Cartões de crédito" subtitle="Fatura do mês selecionado" />
          <div className="grid sm:grid-cols-2 gap-3">
            {cards.map((a) => {
              const invoice = cardInvoice(a, data.transactions, month);
              const used = Math.abs(accountBalance(a, data.transactions, true));
              const limit = a.creditLimit ?? 0;
              return (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                      style={{ background: `color-mix(in srgb, ${a.color} 16%, transparent)`, color: a.color }}
                    >
                      <CreditCard size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{a.name}</p>
                      <p className="text-xs text-muted">
                        {a.closingDay ? `Fecha dia ${a.closingDay}` : "Cartão de crédito"}
                        {a.dueDay ? ` · vence dia ${a.dueDay}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditing(a)}
                      className="p-1.5 rounded-lg text-muted hover:bg-surface-2"
                      aria-label="Editar cartão"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted">
                        Fatura em aberto
                      </p>
                      <p className="text-xl font-bold tabular-nums">
                        {formatMoney(invoice.open, hide)}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setOpenCard(a)}>
                      Ver fatura
                    </Button>
                  </div>

                  {limit > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-muted mb-1">
                        <span>Limite usado</span>
                        <span className="tabular-nums">
                          {formatMoney(used, hide)} de {formatMoney(limit, hide)}
                        </span>
                      </div>
                      <ProgressBar
                        value={used / limit}
                        color={used / limit > 0.85 ? "var(--neg)" : a.color}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <AccountSheet
        open={creating || Boolean(editing)}
        account={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={(payload, id) => {
          if (id) {
            updateAccount(id, payload);
            toast("Conta atualizada");
          } else {
            addAccount(payload);
            toast("Conta criada");
          }
        }}
        onDelete={(a) => setToDelete(a)}
      />

      <Modal
        open={Boolean(openCard)}
        onClose={() => setOpenCard(null)}
        title={openCard ? `Fatura · ${openCard.name}` : ""}
        wide
      >
        {openCard && <InvoiceDetail card={openCard} month={month} hide={hide} />}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Excluir conta"
        destructive
        confirmLabel="Excluir"
        message={
          <>
            Se houver lançamentos ligados a <b>{toDelete?.name}</b>, a conta será apenas arquivada
            para preservar o histórico.
          </>
        }
        onConfirm={() => {
          if (toDelete) {
            deleteAccount(toDelete.id);
            setEditing(null);
            toast("Conta removida");
          }
        }}
      />
    </div>
  );
}

function InvoiceDetail({ card, month, hide }: { card: Account; month: string; hide: boolean }) {
  const { data } = useStore();
  const invoice = cardInvoice(card, data.transactions, month);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted">Total</p>
          <p className="font-bold tabular-nums text-sm mt-0.5">
            {formatMoney(invoice.total, hide)}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted">Pago</p>
          <p className="font-bold tabular-nums text-sm mt-0.5 text-pos">
            {formatMoney(invoice.paid, hide)}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted">Em aberto</p>
          <p className="font-bold tabular-nums text-sm mt-0.5 text-neg">
            {formatMoney(invoice.open, hide)}
          </p>
        </div>
      </div>

      {invoice.dueDate && (
        <p className="text-xs text-muted text-center">
          Vencimento em {formatDate(invoice.dueDate)}
          {invoice.closingDate && ` · fechamento em ${formatDate(invoice.closingDate)}`}
        </p>
      )}

      {invoice.transactions.length ? (
        <div className="card divide-y divide-[var(--border)] overflow-hidden">
          {invoice.transactions.map((t) => (
            <TransactionRow key={t.id} tx={t} showDate showAccount={false} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted text-center py-8">Nenhuma compra neste mês.</p>
      )}
    </div>
  );
}

function AccountSheet({
  open,
  account,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onSave: (payload: Omit<Account, "id" | "createdAt">, id?: string) => void;
  onDelete: (a: Account) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [initialBalance, setInitialBalance] = useState(0);
  const [color, setColor] = useState("#6366f1");
  const [creditLimit, setCreditLimit] = useState(0);
  const [closingDay, setClosingDay] = useState(1);
  const [dueDay, setDueDay] = useState(10);

  const key = account?.id ?? "new";
  useEffect(() => {
    if (account) {
      setName(account.name);
      setType(account.type);
      setInitialBalance(account.initialBalance);
      setColor(account.color);
      setCreditLimit(account.creditLimit ?? 0);
      setClosingDay(account.closingDay ?? 1);
      setDueDay(account.dueDay ?? 10);
    } else {
      setName("");
      setType("checking");
      setInitialBalance(0);
      setColor("#6366f1");
      setCreditLimit(0);
      setClosingDay(1);
      setDueDay(10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  const isCard = type === "credit_card";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? "Editar conta" : "Nova conta"}
      footer={
        <div className="flex gap-2">
          {account && (
            <Button variant="ghost" className="text-neg" onClick={() => onDelete(account)}>
              <Trash2 size={16} />
            </Button>
          )}
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!name.trim()}
            onClick={() => {
              onSave(
                {
                  name: name.trim(),
                  type,
                  initialBalance: isCard ? 0 : initialBalance,
                  color,
                  creditLimit: isCard ? creditLimit : undefined,
                  closingDay: isCard ? closingDay : undefined,
                  dueDay: isCard ? dueDay : undefined,
                },
                account?.id,
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
            placeholder="Ex.: Nubank, Itaú, Carteira"
            autoFocus
          />
        </Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {(Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        {!isCard ? (
          <Field label="Saldo inicial" hint="Quanto já existe nessa conta hoje.">
            <MoneyInput value={initialBalance} onValueChange={setInitialBalance} />
          </Field>
        ) : (
          <>
            <Field label="Limite do cartão">
              <MoneyInput value={creditLimit} onValueChange={setCreditLimit} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dia do fechamento">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={closingDay}
                  onChange={(e) => setClosingDay(Number(e.target.value) || 1)}
                />
              </Field>
              <Field label="Dia do vencimento">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(Number(e.target.value) || 1)}
                />
              </Field>
            </div>
          </>
        )}

        <Field label="Cor">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </div>
    </Modal>
  );
}
