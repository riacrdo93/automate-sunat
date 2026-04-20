import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AutomationAccountSummary } from "@shared/dashboard-contract";
import { Button } from "../ui/button";

interface AccountSelectorProps {
  accounts: AutomationAccountSummary[];
  selectedAccountId: string | null;
  isDisabled?: boolean;
  onSelect: (accountId: string) => void;
  onCreate: (input: {
    label: string;
    sellerUsername: string;
    sellerPassword: string;
    sunatRuc: string;
    sunatUsername: string;
    sunatPassword: string;
  }) => void;
  onDelete: (accountId: string) => void;
}

function mask(value: string): string {
  if (!value) {
    return "";
  }
  if (value.length <= 2) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, 1)}${"*".repeat(Math.min(10, value.length - 2))}${value.slice(-1)}`;
}

export function AccountSelector({
  accounts,
  selectedAccountId,
  isDisabled = false,
  onSelect,
  onCreate,
  onDelete,
}: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const selected = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId],
  );

  if (!accounts.length) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Cuenta</span>
        <Button size="sm" variant="outline" disabled={isDisabled} onClick={() => setIsOpen(true)}>
          Agregar cuenta
        </Button>
        {isOpen ? (
          <AccountModal
            title="Agregar cuenta"
            onClose={() => setIsOpen(false)}
            onSubmit={(input) => {
              onCreate(input);
              setIsOpen(false);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Cuenta</span>
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm disabled:opacity-50"
        disabled={isDisabled}
        value={selected?.id ?? ""}
        onChange={(event) => onSelect(event.target.value)}
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.label} · {account.sellerUsername} · {account.sunatRuc}
          </option>
        ))}
      </select>
      <Button size="sm" variant="outline" disabled={isDisabled} onClick={() => setIsOpen(true)}>
        Gestionar
      </Button>
      {isOpen ? (
        <ManageAccountsModal
          accounts={accounts}
          onClose={() => setIsOpen(false)}
          onCreate={() => setIsCreating(true)}
          onDelete={(accountId) => onDelete(accountId)}
        />
      ) : null}
      {isCreating ? (
        <AccountModal
          title="Agregar cuenta"
          onClose={() => setIsCreating(false)}
          onSubmit={(input) => {
            onCreate(input);
            setIsCreating(false);
          }}
        />
      ) : null}
      {selected ? (
        <span className="hidden text-xs text-muted-foreground lg:inline">
          SUNAT: {selected.sunatUsername} ({mask(selected.sunatRuc)})
        </span>
      ) : null}
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!portalEl) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative mx-auto flex min-h-full max-w-xl items-center justify-center px-4 py-8">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full rounded-2xl border bg-card shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Esc para cerrar</div>
            </div>
            <Button size="sm" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </div>,
    portalEl,
  );
}

function ManageAccountsModal({
  accounts,
  onClose,
  onCreate,
  onDelete,
}: {
  accounts: AutomationAccountSummary[];
  onClose: () => void;
  onCreate: () => void;
  onDelete: (accountId: string) => void;
}) {
  return (
    <ModalShell title="Cuentas" onClose={onClose}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Las contraseñas se guardan localmente en tu DB `data/automation.db`.
        </div>
        <Button size="sm" onClick={onCreate}>
          Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {accounts.map((account) => (
          <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{account.label}</div>
              <div className="truncate text-xs text-muted-foreground">
                Seller: {account.sellerUsername} · SUNAT: {account.sunatUsername} · RUC: {account.sunatRuc}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => {
                if (!window.confirm(`¿Eliminar la cuenta "${account.label}"?`)) {
                  return;
                }
                onDelete(account.id);
              }}
            >
              Eliminar
            </Button>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function Field({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        type={type}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function AccountModal({
  title,
  onClose,
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (input: {
    label: string;
    sellerUsername: string;
    sellerPassword: string;
    sunatRuc: string;
    sunatUsername: string;
    sunatPassword: string;
  }) => void;
}) {
  const [label, setLabel] = useState("Principal");
  const [sellerUsername, setSellerUsername] = useState("");
  const [sellerPassword, setSellerPassword] = useState("");
  const [sunatRuc, setSunatRuc] = useState("");
  const [sunatUsername, setSunatUsername] = useState("");
  const [sunatPassword, setSunatPassword] = useState("");

  const canSubmit =
    label.trim() &&
    sellerUsername.trim() &&
    sellerPassword.trim() &&
    sunatRuc.trim() &&
    sunatUsername.trim() &&
    sunatPassword.trim();

  return (
    <ModalShell title={title} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            return;
          }
          onSubmit({
            label: label.trim(),
            sellerUsername: sellerUsername.trim(),
            sellerPassword,
            sunatRuc: sunatRuc.trim(),
            sunatUsername: sunatUsername.trim(),
            sunatPassword,
          });
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Etiqueta" value={label} onChange={setLabel} />
          <Field label="Seller usuario" value={sellerUsername} onChange={setSellerUsername} />
          <Field label="Seller password" type="password" value={sellerPassword} onChange={setSellerPassword} />
          <Field label="SUNAT RUC" value={sunatRuc} onChange={setSunatRuc} />
          <Field label="SUNAT usuario" value={sunatUsername} onChange={setSunatUsername} />
          <Field label="SUNAT password" type="password" value={sunatPassword} onChange={setSunatPassword} />
        </div>
        <div className="mt-1 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            Guardar
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

