"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toaster";

export interface InviteDialogProps {
  inviteCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteDialog({
  inviteCode,
  open,
  onOpenChange,
}: InviteDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setUrl(
      `${window.location.origin}/davet/${encodeURIComponent(inviteCode)}`,
    );
  }, [open, inviteCode]);

  function selectUrl(): void {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }

  async function handleCopy(): Promise<void> {
    if (!url) return;

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard-unavailable");
      }
      await navigator.clipboard.writeText(url);
      toast("Davet bağlantısı kopyalandı.", { tone: "success" });
    } catch {
      selectUrl();
      toast("Bağlantı seçildi. Kopyalamak için Ctrl+C kullan.", { tone: "info" });
    }
  }

  return (
    <Modal
      description="Bu bağlantıyı paylaşarak arkadaşlarını sunucuya çağır."
      footer={
        <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
          Kapat
        </Button>
      }
      onOpenChange={onOpenChange}
      open={open}
      showClose={false}
      size="md"
      title="Sunucuya davet et"
    >
      <div className="space-y-3">
        <Input
          id={inputId}
          label="Davet bağlantısı"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          ref={inputRef}
          spellCheck={false}
          value={url}
        />
        <Button
          className="w-full"
          disabled={!url}
          onClick={() => void handleCopy()}
          type="button"
          variant="secondary"
        >
          Kopyala
        </Button>
        <p className="text-xs leading-5 text-[color:var(--muted)]">
          Davet bağlantısı, sunucuya katılmak isteyen herkes tarafından kullanılabilir.
        </p>
      </div>
    </Modal>
  );
}
