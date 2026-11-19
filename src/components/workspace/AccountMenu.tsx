"use client";

import type { UserDto } from "@shared/types";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toaster";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";

const ITEM_COUNT = 2;

export interface AccountMenuProps {
  user: UserDto;
  /** The workspace rail sits at the bottom, so its menu opens upward. */
  placement?: "top" | "bottom";
  className?: string;
}

export function AccountMenu({
  user,
  placement = "top",
  className,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [theme, setThemeState] = useState<Theme>("dark");
  const [pending, setPending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const openFocusRef = useRef<0 | 1>(0);
  const menuId = useId();

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  useEffect(() => {
    if (!open) return;

    const targetIndex = openFocusRef.current;
    setActiveIndex(targetIndex);
    const frame = window.requestAnimationFrame(() => {
      itemRefs.current[targetIndex]?.focus();
    });

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
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  function closeAndRestore(): void {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function focusItem(index: number): void {
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
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

    if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusItem(ITEM_COUNT - 1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem((activeIndex + 1) % ITEM_COUNT);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem((activeIndex - 1 + ITEM_COUNT) % ITEM_COUNT);
    }
  }

  function handleThemeToggle(): void {
    setThemeState(toggleTheme());
  }

  async function handleLogout(): Promise<void> {
    if (pending) return;
    setPending(true);
    setOpen(false);

    try {
      await logout();
      window.location.assign("/");
    } catch {
      setPending(false);
      triggerRef.current?.focus();
      toast("Çıkış yapılamadı. Tekrar dene.", { tone: "error" });
    }
  }

  const themeLabel =
    theme === "light" ? "Karanlık temaya geç" : "Aydınlık temaya geç";
  const themeIcon = theme === "light" ? "moon" : "sun";

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        ref={triggerRef}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Hesap menüsü: ${user.username}`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[color:var(--text)] transition-colors hover:bg-[color:var(--elevated)] disabled:pointer-events-none disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          openFocusRef.current = 0;
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openFocusRef.current = event.key === "ArrowUp" ? 1 : 0;
            setOpen(true);
          }
        }}
        title={user.username}
        type="button"
      >
        <Avatar name={user.username} size="md" />
      </button>

      {open ? (
        <div
          aria-label="Hesap menüsü"
          className={cn(
            "absolute z-40 w-64 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-xl",
            placement === "top"
              ? "bottom-full left-0 mb-2"
              : "right-0 top-full mt-2",
          )}
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          role="menu"
        >
          <div className="px-2.5 py-2" role="presentation">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text)]">
                {user.username}
              </p>
              {user.isGuest ? (
                <span className="shrink-0 rounded border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--muted)]">
                  Misafir
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {user.isGuest ? "Misafir hesap" : "Hesabın"}
            </p>
          </div>

          <div
            className="my-1 h-px bg-[color:var(--border)]"
            role="separator"
          />

          <button
            ref={(element) => {
              itemRefs.current[0] = element;
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[color:var(--text)] transition-colors hover:bg-[color:var(--elevated)]"
            onClick={handleThemeToggle}
            onFocus={() => setActiveIndex(0)}
            role="menuitem"
            tabIndex={activeIndex === 0 ? 0 : -1}
            type="button"
          >
            <Icon name={themeIcon} size={16} />
            <span className="min-w-0 flex-1 truncate">{themeLabel}</span>
          </button>

          <button
            ref={(element) => {
              itemRefs.current[1] = element;
            }}
            aria-busy={pending || undefined}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[color:var(--danger-text)] transition-colors hover:bg-[color:var(--danger-soft)] disabled:pointer-events-none disabled:opacity-60"
            disabled={pending}
            onClick={() => void handleLogout()}
            onFocus={() => setActiveIndex(1)}
            role="menuitem"
            tabIndex={activeIndex === 1 ? 0 : -1}
            type="button"
          >
            <Icon name="log-out" size={16} />
            <span className="min-w-0 flex-1 truncate">
              {pending ? "Çıkış yapılıyor…" : "Çıkış yap"}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
