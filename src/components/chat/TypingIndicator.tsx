export interface TypingIndicatorProps {
  label: string | null;
}

export function TypingIndicator({ label }: TypingIndicatorProps) {
  return (
    <p
      aria-live="polite"
      className="h-5 truncate px-1 text-xs text-[color:var(--muted)]"
      role="status"
    >
      {label ?? "\u00A0"}
    </p>
  );
}
