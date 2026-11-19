"use client";

import {
  SERVER_NAME_MAX_LENGTH,
  SERVER_NAME_MIN_LENGTH,
} from "@shared/constants";
import type { WorkspaceDto } from "@shared/types";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toaster";
import { ApiError, apiFetch } from "@/lib/api";

export interface ServerSettingsDialogProps {
  server: WorkspaceDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServerSettingsDialog({
  server,
  open,
  onOpenChange,
}: ServerSettingsDialogProps) {
  const router = useRouter();
  const renameFormId = useId();
  const renameId = useId();
  const deleteId = useId();

  const [name, setName] = useState(server.name);
  const [deleteName, setDeleteName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [renamePending, setRenamePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const pending = renamePending || deletePending || leavePending;

  useEffect(() => {
    if (!open) return;
    setName(server.name);
    setDeleteName("");
    setNameError(undefined);
    setDeleteError(null);
    setFormError(null);
    setLeaveError(null);
  }, [open, server.name]);

  async function handleRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    setNameError(undefined);
    setFormError(null);

    const trimmedName = name.normalize("NFC").trim();
    if (
      trimmedName.length < SERVER_NAME_MIN_LENGTH ||
      trimmedName.length > SERVER_NAME_MAX_LENGTH
    ) {
      setNameError(
        `Sunucu adı ${SERVER_NAME_MIN_LENGTH}–${SERVER_NAME_MAX_LENGTH} karakter olmalı.`,
      );
      return;
    }

    if (trimmedName === server.name) {
      onOpenChange(false);
      return;
    }

    setRenamePending(true);
    try {
      await apiFetch<{ workspace: WorkspaceDto }>(
        `/api/servers/${encodeURIComponent(server.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: trimmedName }),
        },
      );
      setRenamePending(false);
      onOpenChange(false);
      toast("Sunucu adı güncellendi.", { tone: "success" });
      router.refresh();
    } catch (error) {
      setRenamePending(false);
      if (error instanceof ApiError) {
        if (error.field === "name") {
          setNameError(error.message);
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Bir şeyler ters gitti. Tekrar dene.");
      }
    }
  }

  async function handleDelete(): Promise<void> {
    if (deletePending) return;

    setDeleteError(null);

    if (deleteName.trim() !== server.name) {
      setDeleteError("Sunucu adı eşleşmiyor.");
      return;
    }

    setDeletePending(true);
    try {
      await apiFetch<void>(`/api/servers/${encodeURIComponent(server.id)}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmName: deleteName.trim() }),
      });

      onOpenChange(false);
      setDeletePending(false);
      toast("Sunucu silindi.", { tone: "success" });
      router.push("/sunucular");
      router.refresh();
    } catch (error) {
      setDeletePending(false);
      if (error instanceof ApiError) {
        if (error.code === "NAME_MISMATCH") {
          setDeleteError("Sunucu adı eşleşmiyor.");
        } else {
          setDeleteError(error.message);
        }
      } else {
        setDeleteError("Bir şeyler ters gitti. Tekrar dene.");
      }
    }
  }

  async function handleLeave(): Promise<void> {
    if (leavePending) return;

    setLeaveError(null);
    setLeavePending(true);
    try {
      await apiFetch<void>(
        `/api/servers/${encodeURIComponent(server.id)}/leave`,
        { method: "POST" },
      );
      setLeavePending(false);
      onOpenChange(false);
      toast("Sunucudan ayrıldın.", { tone: "success" });
      router.push("/sunucular");
      router.refresh();
    } catch (error) {
      setLeavePending(false);
      if (error instanceof ApiError) {
        setLeaveError(error.message);
      } else {
        setLeaveError("Bir şeyler ters gitti. Tekrar dene.");
      }
    }
  }

  if (!server.isOwner) {
    return (
      <Modal
        description={`“${server.name}” sunucusundan ayrılmak üzeresin. Kanallara erişimini kaybedeceksin.`}
        dismissible={!leavePending}
        footer={
          <>
            <Button
              disabled={leavePending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Vazgeç
            </Button>
            <Button
              loading={leavePending}
              onClick={() => void handleLeave()}
              type="button"
              variant="danger"
            >
              Sunucudan ayrıl
            </Button>
          </>
        }
        onOpenChange={onOpenChange}
        open={open}
        showClose={false}
        size="sm"
        title="Sunucudan ayrıl"
      >
        {leaveError ? (
          <p
            className="rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm leading-5 text-[color:var(--danger-text)]"
            role="alert"
          >
            {leaveError}
          </p>
        ) : (
          <p className="text-sm leading-6 text-[color:var(--muted)]">
            Yeniden katılmak için geçerli bir davet bağlantısına ihtiyacın olacak.
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      description="Sunucu adını yönet veya sunucuyu kalıcı olarak sil."
      dismissible={!pending}
      footer={
        <Button
          disabled={pending}
          onClick={() => onOpenChange(false)}
          type="button"
          variant="secondary"
        >
          Kapat
        </Button>
      }
      onOpenChange={onOpenChange}
      open={open}
      showClose={false}
      size="md"
      title="Sunucu ayarları"
    >
      <div className="space-y-6">
        <form className="space-y-3" id={renameFormId} noValidate onSubmit={handleRename}>
          <Input
            autoCapitalize="none"
            autoComplete="off"
            error={nameError}
            hint="Sunucu adı değiştirmek istemiyorsan olduğu gibi bırakabilirsin."
            id={renameId}
            label="Sunucu adı"
            maxLength={SERVER_NAME_MAX_LENGTH}
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            spellCheck={false}
            value={name}
          />
          {formError ? (
            <p
              className="rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm leading-5 text-[color:var(--danger-text)]"
              role="alert"
            >
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button form={renameFormId} loading={renamePending} type="submit">
              Kaydet
            </Button>
          </div>
        </form>

        <div className="border-t border-[color:var(--border)] pt-5">
          <h3 className="text-sm font-semibold text-[color:var(--text)]">
            Sunucuyu sil
          </h3>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
            Bu işlem sunucuyu, kanallarını ve tüm mesajları kalıcı olarak siler.
            Geri alınamaz.
          </p>
          <div className="mt-3">
            <Input
              autoComplete="off"
              error={deleteError ?? undefined}
              id={deleteId}
              label={`Onaylamak için “${server.name}” yaz`}
              name="confirmName"
              onChange={(event) => setDeleteName(event.target.value)}
              spellCheck={false}
              value={deleteName}
            />
          </div>
          <Button
            className="mt-3"
            loading={deletePending}
            onClick={() => void handleDelete()}
            type="button"
            variant="danger"
          >
            Sunucuyu kalıcı olarak sil
          </Button>
        </div>
      </div>
    </Modal>
  );
}
