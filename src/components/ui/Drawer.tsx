"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useOverlay } from "./overlay";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  side?: "left" | "right";
  dismissible?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  dismissible = true,
  footer,
  children,
  className,
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const surfaceRef = useOverlay(open, () => onOpenChange(false), { dismissible });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-black/60",
        side === "right" ? "justify-end" : "justify-start",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) {
          onOpenChange(false);
        }
      }}
    >
      <div
        ref={surfaceRef}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "flex h-full w-full max-w-sm flex-col border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl focus:outline-none",
          side === "right" ? "border-l" : "border-r",
          className,
        )}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2
              className="text-base font-semibold text-[color:var(--text)]"
              id={titleId}
            >
              {title}
            </h2>
            {description ? (
              <p
                className="mt-1 text-sm leading-6 text-[color:var(--muted)]"
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Kapat"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)] disabled:pointer-events-none disabled:opacity-50"
            disabled={!dismissible}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-[color:var(--border)] px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
