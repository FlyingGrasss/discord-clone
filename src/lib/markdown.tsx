import type { ReactNode } from "react";

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

function safeHttpUrl(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) return null;

  try {
    const parsed = new URL(value);
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;
    return value;
  } catch {
    return null;
  }
}

function countOccurrences(value: string, character: string): number {
  return value.split(character).length - 1;
}

/** Keeps sentence punctuation outside the link while preserving balanced parentheses. */
function splitTrailingPunctuation(value: string): { url: string; trailing: string } {
  let end = value.length;
  while (end > 0 && /[.,;:!?]/u.test(value[end - 1]!)) end -= 1;

  const pairs: Record<string, string> = { ")": "(", "]": "[" };
  let candidate = value.slice(0, end);

  while (candidate.length > 0) {
    const last = candidate[candidate.length - 1]!;
    const opener = pairs[last];
    if (!opener) break;
    if (countOccurrences(candidate, last) <= countOccurrences(candidate, opener)) break;
    candidate = candidate.slice(0, -1);
  }

  return { url: candidate, trailing: value.slice(candidate.length) };
}

const LINK_CLASSES =
  "text-[color:var(--accent-text)] underline underline-offset-2 hover:text-[color:var(--accent)]";
const CODE_CLASSES =
  "rounded bg-[color:var(--elevated)] px-1 py-0.5 font-mono text-[0.9em] text-[color:var(--text)]";

/**
 * Renders a deliberately small Markdown subset as React nodes: bold, italic,
 * inline code, explicit http(s) links, and bare http(s) URLs. No raw HTML is
 * ever injected and non-http protocols are rejected.
 */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let key = 0;
  let index = 0;

  const pushKey = (): string => {
    const value = `${keyPrefix}-${key}`;
    key += 1;
    return value;
  };

  const flush = (): void => {
    if (buffer.length === 0) return;
    nodes.push(buffer);
    buffer = "";
  };

  while (index < text.length) {
    const character = text[index]!;

    if (character === "`") {
      const end = text.indexOf("`", index + 1);
      if (end > index + 1 && !text.slice(index + 1, end).includes("\n")) {
        flush();
        nodes.push(
          <code className={CODE_CLASSES} key={pushKey()}>
            {text.slice(index + 1, end)}
          </code>,
        );
        index = end + 1;
        continue;
      }
    }

    if (character === "*" && text[index + 1] === "*") {
      const end = text.indexOf("**", index + 2);
      if (end > index + 2) {
        flush();
        nodes.push(
          <strong className="font-semibold text-[color:var(--text)]" key={pushKey()}>
            {parseInline(text.slice(index + 2, end), `${keyPrefix}-b${key}`)}
          </strong>,
        );
        index = end + 2;
        continue;
      }
    }

    if (character === "*") {
      const end = text.indexOf("*", index + 1);
      const inner = end > index + 1 ? text.slice(index + 1, end) : "";
      if (end > index + 1 && !inner.includes("\n")) {
        flush();
        nodes.push(
          <em className="italic" key={pushKey()}>
            {parseInline(inner, `${keyPrefix}-i${key}`)}
          </em>,
        );
        index = end + 1;
        continue;
      }
    }

    if (character === "[") {
      const match = /^\[([^\]\n]+)\]\(([^)\s]+)\)/u.exec(text.slice(index));
      if (match) {
        const label = match[1]!;
        const href = safeHttpUrl(match[2]!);
        if (href) {
          flush();
          nodes.push(
            <a
              className={LINK_CLASSES}
              href={href}
              key={pushKey()}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              {label}
            </a>,
          );
          index += match[0].length;
          continue;
        }
      }
    }

    if (
      (character === "h" || character === "H") &&
      /^https?:\/\//iu.test(text.slice(index))
    ) {
      const match = /^https?:\/\/[^\s<>"'`]+/iu.exec(text.slice(index));
      if (match) {
        const { url, trailing } = splitTrailingPunctuation(match[0]);
        if (safeHttpUrl(url)) {
          flush();
          nodes.push(
            <a
              className={LINK_CLASSES}
              href={url}
              key={pushKey()}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              {url}
            </a>,
          );
          if (trailing.length > 0) buffer += trailing;
          index += match[0].length;
          continue;
        }
      }
    }

    buffer += character;
    index += 1;
  }

  flush();
  return nodes;
}

export interface MarkdownProps {
  text: string;
  className?: string;
}

export function Markdown({ text, className }: MarkdownProps) {
  return (
    <div
      className={
        className ? `whitespace-pre-wrap break-words ${className}` : "whitespace-pre-wrap break-words"
      }
    >
      {parseInline(text, "md")}
    </div>
  );
}
