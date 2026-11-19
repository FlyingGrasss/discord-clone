"use client";

import { REACTION_EMOJIS, type ReactionEmoji } from "@shared/protocol";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export interface ReactionPickerProps {
  disabled?: boolean;
  onPick: (emoji: ReactionEmoji) => void;
}

function isInside(container: HTMLElement | null, target: EventTarget | null): boolean {
  return target instanceof Node && container?.contains(target) === true;
}

/** Small non-modal emoji popover; Escape, an outside pointer press, or focus loss closes it. */
export function ReactionPicker({ disabled = false, onPick }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      itemRefs.current[0]?.focus();
    });

    function handlePointerDown(event: PointerEvent): void {
      if (!isInside(containerRef.current, event.target)) setOpen(false);
    }

    function handleFocusIn(event: FocusEvent): void {
      if (!isInside(containerRef.current, event.target)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function choose(emoji: ReactionEmoji): void {
    setOpen(false);
    triggerRef.current?.focus();
    onPick(emoji);
  }

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Tepki ekle"
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-[color:var(--muted)] transition-colors hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)] disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Icon name="plus" size={13} />
        Tepki
      </button>

      {open ? (
        <div
          aria-label="Tepki seç"
          className="absolute bottom-full right-0 z-40 mb-1 grid grid-cols-4 gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 shadow-xl"
          role="dialog"
        >
          {REACTION_EMOJIS.map((emoji, index) => (
            <button
              key={emoji}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              aria-label={`${emoji} tepkisi ekle`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-base leading-none transition-colors hover:bg-[color:var(--elevated)]"
              onClick={() => choose(emoji)}
              type="button"
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
