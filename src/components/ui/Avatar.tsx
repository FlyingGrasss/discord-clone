import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl",
  xl: "h-20 w-20 text-3xl",
};

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function readableTextColor(hex: string): "#0f1115" | "#ffffff" {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/u.test(clean)) return "#ffffff";

  const r = channelToLinear(Number.parseInt(clean.slice(0, 2), 16));
  const g = channelToLinear(Number.parseInt(clean.slice(2, 4), 16));
  const b = channelToLinear(Number.parseInt(clean.slice(4, 6), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.42 ? "#0f1115" : "#ffffff";
}

export interface AvatarProps {
  name: string;
  emoji?: string | null;
  color?: string | null;
  size?: AvatarSize;
  className?: string;
  /** Omit for decorative avatars that sit next to a visible name. */
  label?: string;
}

export function Avatar({
  name,
  emoji,
  color,
  size = "md",
  className,
  label,
}: AvatarProps) {
  const hasColor = Boolean(color && /^#[0-9a-fA-F]{6}$/u.test(color));

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-lg border border-[color:var(--border)] font-semibold",
        !hasColor && "bg-[color:var(--elevated)] text-[color:var(--text)]",
        sizeClasses[size],
        className,
      )}
      role={label ? "img" : undefined}
      style={
        hasColor
          ? { backgroundColor: color!, color: readableTextColor(color!) }
          : undefined
      }
      title={label ? undefined : name}
    >
      {emoji ? <span aria-hidden="true">{emoji}</span> : initials(name)}
    </span>
  );
}
