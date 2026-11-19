"use client";

import { Button } from "./Button";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  tone?: "danger" | "default";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  pending = false,
  tone = "danger",
}: ConfirmDialogProps) {
  return (
    <Modal
      description={description}
      dismissible={!pending}
      footer={
        <>
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            variant="secondary"
          >
            {cancelLabel}
          </Button>
          <Button
            loading={pending}
            onClick={onConfirm}
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {pending ? "İşleniyor" : confirmLabel}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      showClose={false}
      size="sm"
      title={title}
    />
  );
}
