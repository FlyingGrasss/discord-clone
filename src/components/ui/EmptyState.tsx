import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon = "message-circle",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[color:var(--elevated)] text-[color:var(--muted)]">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="text-base font-semibold text-[color:var(--text)]">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-6 text-[color:var(--muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
