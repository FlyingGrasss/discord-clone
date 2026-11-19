"use client";

import { CHANNEL_NAME_MAX_LENGTH } from "@shared/constants";
import type { ChannelDto } from "@shared/types";
import { CHANNEL_NAME_PATTERN, normalizeChannelName } from "@shared/validation";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toaster";
import { ApiError, apiFetch } from "@/lib/api";

const LAST_CHANNEL_ERROR =
  "Son kanal silinemez. Sunucuda en az bir kanal kalmalı.";

export interface ChannelSettingsDialogProps {
  serverId: string;
  channel: ChannelDto;
  channels: ChannelDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChannelSettingsDialog({
  serverId,
  channel,
  channels,
  open,
  onOpenChange,
}: ChannelSettingsDialogProps) {
  const router = useRouter();
  const formId = useId();
  const nameId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const [name, setName] = useState(channel.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [renamePending, setRenamePending] = useState(false);
  const [deleteStep, setDeleteStep] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const channelCount = channels.length;
  const pending = renamePending || deletePending;

  useEffect(() => {
    if (!open) return;
    setName(channel.name);
    setNameError(undefined);
    setFormError(null);
    setDeleteStep(false);
    setDeleteError(null);
  }, [open, channel.id, channel.name]);

  useEffect(() => {
    if (deleteStep) {
      cancelDeleteRef.current?.focus();
      return;
    }
    if (open) {
      nameInputRef.current?.focus();
    }
  }, [deleteStep, open]);

  async function handleRename(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (pending) return;

    setNameError(undefined);
    setFormError(null);

    const normalized = normalizeChannelName(name);
    if (normalized.length < 1) {
      setNameError("Kanal adı gerekli.");
      return;
    }
    if (normalized.length > CHANNEL_NAME_MAX_LENGTH) {
      setNameError(`Kanal adı en fazla ${CHANNEL_NAME_MAX_LENGTH} karakter olabilir.`);
      return;
    }
    if (!CHANNEL_NAME_PATTERN.test(normalized)) {
      setNameError(
        "Kanal adı yalnızca harf, rakam, tire ve alt çizgi içerebilir.",
      );
      return;
    }
    if (normalized === channel.name) {
      onOpenChange(false);
      return;
    }

    setRenamePending(true);
    try {
      await apiFetch<{ channel: ChannelDto }>(
        `/api/channels/${encodeURIComponent(channel.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: normalized }),
        },
      );
      setRenamePending(false);
      onOpenChange(false);
      toast("Kanal adı güncellendi.", { tone: "success" });
      router.refresh();
    } catch (error) {
      setRenamePending(false);
      if (error instanceof ApiError) {
        if (error.code === "CHANNEL_EXISTS") {
          setNameError("Kanal adı zaten kullanılıyor.");
        } else if (error.field === "name") {
          setNameError(error.message);
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Bir şeyler ters gitti. Tekrar dene.");
      }
    }
  }

  function startDelete(): void {
    setDeleteError(channelCount <= 1 ? LAST_CHANNEL_ERROR : null);
    setDeleteStep(true);
  }

  async function handleDelete(): Promise<void> {
    if (deletePending) return;

    if (channelCount <= 1) {
      setDeleteError(LAST_CHANNEL_ERROR);
      return;
    }

    setDeletePending(true);
    setDeleteError(null);

    try {
      await apiFetch<void>(`/api/channels/${encodeURIComponent(channel.id)}`, {
        method: "DELETE",
      });

      const remaining = [...channels]
        .filter((item) => item.id !== channel.id)
        .sort((left, right) => left.position - right.position);
      const nextChannel = remaining[0];

      onOpenChange(false);
      setDeletePending(false);
      toast("Kanal silindi.", { tone: "success" });
      router.push(
        nextChannel
          ? `/sunucu/${encodeURIComponent(serverId)}/${encodeURIComponent(nextChannel.id)}`
          : `/sunucu/${encodeURIComponent(serverId)}`,
      );
      router.refresh();
    } catch (error) {
      setDeletePending(false);
      if (error instanceof ApiError) {
        if (error.code === "LAST_CHANNEL") {
          setDeleteError(LAST_CHANNEL_ERROR);
        } else {
          setDeleteError(error.message);
        }
      } else {
        setDeleteError("Bir şeyler ters gitti. Tekrar dene.");
      }
    }
  }

  return (
    <Modal
      description={`#${channel.name} kanalını düzenle.`}
      dismissible={!pending}
      footer={
        deleteStep ? (
          <>
            <Button
              ref={cancelDeleteRef}
              disabled={deletePending}
              onClick={() => setDeleteStep(false)}
              type="button"
              variant="secondary"
            >
              Vazgeç
            </Button>
            <Button
              loading={deletePending}
              onClick={() => void handleDelete()}
              type="button"
              variant="danger"
            >
              Kanalı sil
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Vazgeç
            </Button>
            <Button form={formId} loading={renamePending} type="submit">
              Kaydet
            </Button>
          </>
        )
      }
      onOpenChange={onOpenChange}
      open={open}
      showClose={false}
      size="sm"
      title="Kanal ayarları"
    >
      {deleteStep ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[color:var(--text)]">
            <span className="font-semibold">#{channel.name}</span> kanalı ve
            içindeki tüm mesajlar kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </p>
          {deleteError ? (
            <p
              className="rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm leading-5 text-[color:var(--danger-text)]"
              role="alert"
            >
              {deleteError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          <form className="space-y-3" id={formId} noValidate onSubmit={handleRename}>
            <Input
              autoCapitalize="none"
              autoComplete="off"
              error={nameError}
              hint={`Küçük harfe çevrilir, boşluklar tire olur. En fazla ${CHANNEL_NAME_MAX_LENGTH} karakter.`}
              id={nameId}
              label="Kanal adı"
              maxLength={CHANNEL_NAME_MAX_LENGTH}
              name="name"
              onChange={(event) => setName(event.target.value)}
              ref={nameInputRef}
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
          </form>

          <div className="border-t border-[color:var(--border)] pt-5">
            <h3 className="text-sm font-semibold text-[color:var(--text)]">
              Kanalı sil
            </h3>
            <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
              Kanal ve mesajları kalıcı olarak silinir. Bu işlem geri alınamaz.
            </p>
            <Button
              className="mt-3"
              onClick={startDelete}
              type="button"
              variant="danger"
            >
              Kanalı sil
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
