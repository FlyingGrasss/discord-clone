"use client";

import {
  DEFAULT_SERVER_ICON_COLOR,
  DEFAULT_SERVER_ICON_EMOJI,
  SERVER_NAME_MAX_LENGTH,
  SERVER_NAME_MIN_LENGTH,
} from "@shared/constants";
import type { WorkspaceDto } from "@shared/types";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

const SERVER_EMOJI_OPTIONS = [
  { emoji: "💬", label: "Sohbet" },
  { emoji: "🚀", label: "Roket" },
  { emoji: "🎮", label: "Oyun" },
  { emoji: "🎨", label: "Sanat" },
  { emoji: "🎵", label: "Müzik" },
  { emoji: "📚", label: "Kitaplık" },
  { emoji: "🌙", label: "Gece" },
  { emoji: "🔥", label: "Ateş" },
  { emoji: "⭐", label: "Yıldız" },
  { emoji: "🛡️", label: "Kalkan" },
  { emoji: "☕", label: "Kahve" },
  { emoji: "🐙", label: "Ahtapot" },
] as const;

const SERVER_COLOR_OPTIONS = [
  { value: "#5865f2", label: "İndigo" },
  { value: "#3b82f6", label: "Mavi" },
  { value: "#06b6d4", label: "Turkuaz" },
  { value: "#22c55e", label: "Yeşil" },
  { value: "#eab308", label: "Sarı" },
  { value: "#f97316", label: "Turuncu" },
  { value: "#ec4899", label: "Pembe" },
  { value: "#8b5cf6", label: "Mor" },
] as const;

export interface CreateServerModalProps {
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerClassName?: string;
  iconOnly?: boolean;
}

export function CreateServerModal({
  triggerLabel = "Sunucu oluştur",
  triggerVariant = "primary",
  triggerSize = "md",
  triggerClassName,
  iconOnly = false,
}: CreateServerModalProps) {
  const router = useRouter();
  const formId = useId();
  const nameId = useId();
  const emojiLabelId = useId();
  const colorLabelId = useId();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [iconEmoji, setIconEmoji] = useState<string>(DEFAULT_SERVER_ICON_EMOJI);
  const [iconColor, setIconColor] = useState<string>(DEFAULT_SERVER_ICON_COLOR);
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setIconEmoji(DEFAULT_SERVER_ICON_EMOJI);
    setIconColor(DEFAULT_SERVER_ICON_COLOR);
    setNameError(undefined);
    setFormError(null);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
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

    setPending(true);
    try {
      const body = await apiFetch<{ workspace: WorkspaceDto }>("/api/servers", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          iconEmoji,
          iconColor,
        }),
      });

      const workspace = body.workspace;
      const firstChannel = [...workspace.channels].sort(
        (left, right) => left.position - right.position,
      )[0];
      const target = firstChannel
        ? `/sunucu/${encodeURIComponent(workspace.id)}/${encodeURIComponent(firstChannel.id)}`
        : `/sunucu/${encodeURIComponent(workspace.id)}`;

      setOpen(false);
      setPending(false);
      router.push(target);
      router.refresh();
    } catch (error) {
      setPending(false);
      if (error instanceof ApiError) {
        if (error.code === "GUEST_NOT_ALLOWED") {
          setFormError("Misafir hesaplar sunucu oluşturamaz.");
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
        description="Topluluğun için bir alan aç."
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
            <Button
              form={formId}
              loading={pending}
              type="submit"
              variant="primary"
            >
              Sunucu oluştur
            </Button>
          </>
        }
        onOpenChange={setOpen}
        open={open}
        showClose={false}
        size="md"
        title="Sunucu oluştur"
      >
        <form className="space-y-5" id={formId} noValidate onSubmit={handleSubmit}>
          <Input
            autoCapitalize="none"
            autoComplete="off"
            error={nameError}
            hint={`${SERVER_NAME_MIN_LENGTH}–${SERVER_NAME_MAX_LENGTH} karakter.`}
            id={nameId}
            label="Sunucu adı"
            maxLength={SERVER_NAME_MAX_LENGTH}
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            spellCheck={false}
            value={name}
          />

          <fieldset>
            <legend
              className="mb-2 text-sm font-medium text-[color:var(--text)]"
              id={emojiLabelId}
            >
              Sunucu simgesi
            </legend>
            <div
              aria-labelledby={emojiLabelId}
              className="grid grid-cols-6 gap-2"
              role="radiogroup"
            >
              {SERVER_EMOJI_OPTIONS.map((option) => {
                const selected = iconEmoji === option.emoji;
                return (
                  <button
                    key={option.emoji}
                    aria-checked={selected}
                    aria-label={option.label}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-lg border text-xl transition-colors",
                      selected
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--elevated)]",
                    )}
                    onClick={() => setIconEmoji(option.emoji)}
                    role="radio"
                    type="button"
                  >
                    <span aria-hidden="true">{option.emoji}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend
              className="mb-2 text-sm font-medium text-[color:var(--text)]"
              id={colorLabelId}
            >
              Simge rengi
            </legend>
            <div
              aria-labelledby={colorLabelId}
              className="flex flex-wrap gap-2"
              role="radiogroup"
            >
              {SERVER_COLOR_OPTIONS.map((option) => {
                const selected = iconColor === option.value;
                return (
                  <button
                    key={option.value}
                    aria-checked={selected}
                    aria-label={option.label}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border transition-shadow",
                      selected
                        ? "border-[color:var(--text)] ring-2 ring-[color:var(--text)] ring-offset-2 ring-offset-[color:var(--surface)]"
                        : "border-black/10 hover:ring-2 hover:ring-[color:var(--border-strong)] hover:ring-offset-2 hover:ring-offset-[color:var(--surface)]",
                    )}
                    onClick={() => setIconColor(option.value)}
                    role="radio"
                    style={{ backgroundColor: option.value }}
                    type="button"
                  >
                    {selected ? (
                      <Icon
                        className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]"
                        name="check"
                        size={16}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

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
