"use client";

import { CHANNEL_NAME_MAX_LENGTH } from "@shared/constants";
import type { ChannelDto } from "@shared/types";
import { CHANNEL_NAME_PATTERN, normalizeChannelName } from "@shared/validation";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toaster";
import { ApiError, apiFetch } from "@/lib/api";

export interface CreateChannelModalProps {
  serverId: string;
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerClassName?: string;
  iconOnly?: boolean;
}

export function CreateChannelModal({
  serverId,
  triggerLabel = "Kanal oluştur",
  triggerVariant = "primary",
  triggerSize = "md",
  triggerClassName,
  iconOnly = false,
}: CreateChannelModalProps) {
  const router = useRouter();
  const formId = useId();
  const nameId = useId();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setNameError(undefined);
    setFormError(null);
  }, [open]);

  const normalizedName = normalizeChannelName(name);
  const preview = normalizedName || "kanal-adi";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    setNameError(undefined);
    setFormError(null);

    if (normalizedName.length < 1) {
      setNameError("Kanal adı gerekli.");
      return;
    }
    if (normalizedName.length > CHANNEL_NAME_MAX_LENGTH) {
      setNameError(`Kanal adı en fazla ${CHANNEL_NAME_MAX_LENGTH} karakter olabilir.`);
      return;
    }
    if (!CHANNEL_NAME_PATTERN.test(normalizedName)) {
      setNameError(
        "Kanal adı yalnızca harf, rakam, tire ve alt çizgi içerebilir.",
      );
      return;
    }

    setPending(true);
    try {
      const body = await apiFetch<{ channel: ChannelDto }>(
        `/api/servers/${encodeURIComponent(serverId)}/channels`,
        {
          method: "POST",
          body: JSON.stringify({ name: normalizedName }),
        },
      );

      setOpen(false);
      setPending(false);
      toast("Kanal oluşturuldu.", { tone: "success" });
      router.push(
        `/sunucu/${encodeURIComponent(serverId)}/${encodeURIComponent(body.channel.id)}`,
      );
      router.refresh();
    } catch (error) {
      setPending(false);
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

  return (
    <>
      <Button
        aria-label={iconOnly ? triggerLabel : undefined}
        className={triggerClassName}
        onClick={() => setOpen(true)}
        size={triggerSize}
        title={iconOnly ? triggerLabel : undefined}
        type="button"
        variant={triggerVariant}
      >
        <Icon name="plus" size={16} />
        {iconOnly ? null : triggerLabel}
      </Button>

      <Modal
        description="Kanallar, sunucundaki sohbet konularını ayırır."
        dismissible={!pending}
        footer={
          <>
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              Vazgeç
            </Button>
            <Button form={formId} loading={pending} type="submit">
              Kanal oluştur
            </Button>
          </>
        }
        onOpenChange={setOpen}
        open={open}
        showClose={false}
        size="sm"
        title="Kanal oluştur"
      >
        <form className="space-y-4" id={formId} noValidate onSubmit={handleSubmit}>
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
            required
            spellCheck={false}
            value={name}
          />

          <p
            aria-live="polite"
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--elevated)] px-3 py-2 text-sm text-[color:var(--muted)]"
          >
            <span className="font-medium text-[color:var(--text)]">#{preview}</span>
          </p>

          {formError ? (
            <p
              className="rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm leading-5 text-[color:var(--danger-text)]"
              role="alert"
            >
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
