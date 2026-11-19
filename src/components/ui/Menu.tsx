"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

export interface MenuItem {
  id?: string;
  label: string;
  onSelect: () => void;
  icon?: IconName;
  tone?: "default" | "danger";
  disabled?: boolean;
}

export interface MenuProps {
  /** Accessible name for the trigger, e.g. "Sunucu seçenekleri". */
  label: string;
  items: MenuItem[];
  align?: "start" | "end";
  trigger?: ReactNode;
  triggerClassName?: string;
  className?: string;
  disabled?: boolean;
}

export function Menu({
  label,
  items,
  align = "end",
  trigger,
  triggerClassName,
  className,
  disabled = false,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const itemsRef = useRef(items);
  const openFocusRef = useRef<"first" | "last">("first");
  const menuId = useId();

  itemsRef.current = items;

  const hasEnabledItems = items.some((item) => !item.disabled);

  useEffect(() => {
    if (!open) return;

    const enabled = itemsRef.current
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled)
      .map(({ index }) => index);
    if (enabled.length === 0) return;

    const targetIndex =
      openFocusRef.current === "last" ? enabled[enabled.length - 1]! : enabled[0]!;
    setActiveIndex(targetIndex);

    const frame = window.requestAnimationFrame(() => {
      itemRefs.current[targetIndex]?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent): void {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleFocusIn(event: FocusEvent): void {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  function closeAndRestore(): void {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectItem(item: MenuItem): void {
    if (item.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    item.onSelect();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestore();
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();

    const enabled = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled)
      .map(({ index }) => index);
    if (enabled.length === 0) return;

    const currentPosition = enabled.indexOf(activeIndex);
    let nextPosition: number;

    if (event.key === "Home") {
      nextPosition = 0;
    } else if (event.key === "End") {
      nextPosition = enabled.length - 1;
    } else if (event.key === "ArrowDown") {
      nextPosition = currentPosition < 0 ? 0 : (currentPosition + 1) % enabled.length;
    } else {
      nextPosition =
        currentPosition <= 0 ? enabled.length - 1 : currentPosition - 1;
    }

    const nextIndex = enabled[nextPosition]!;
    setActiveIndex(nextIndex);
    itemRefs.current[nextIndex]?.focus();
  }

  return (
    <div className={cn("relative inline-flex", className)} ref={containerRef}>
      <button
        ref={triggerRef}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--muted)] transition-colors hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)] disabled:pointer-events-none disabled:opacity-50",
          triggerClassName,
        )}
        disabled={disabled || !hasEnabledItems}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openFocusRef.current = event.key === "ArrowUp" ? "last" : "first";
            setOpen(true);
          }
        }}
        type="button"
      >
        {trigger ?? <Icon name="more-horizontal" size={18} />}
      </button>

      {open ? (
        <div
          aria-label={label}
          className={cn(
            "absolute top-full z-40 mt-2 min-w-48 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-xl",
            align === "end" ? "right-0" : "left-0",
          )}
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          role="menu"
        >
          {items.map((item, index) => (
            <button
              key={item.id ?? `${index}-${item.label}`}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
                item.tone === "danger"
                  ? "text-[color:var(--danger-text)] hover:bg-[color:var(--danger-soft)]"
                  : "text-[color:var(--text)] hover:bg-[color:var(--elevated)]",
              )}
              disabled={item.disabled}
              onClick={() => selectItem(item)}
              onFocus={() => setActiveIndex(index)}
              role="menuitem"
              tabIndex={activeIndex === index ? 0 : -1}
              type="button"
            >
              {item.icon ? <Icon name={item.icon} size={16} /> : null}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
