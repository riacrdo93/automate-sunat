import { useMemo } from "react";
import { cn } from "../lib/utils";

type JsonTokenKind = "ws" | "punct" | "string" | "number" | "keyword" | "other";

interface JsonToken {
  kind: JsonTokenKind;
  text: string;
}

function tokenizeJson(input: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;

  function push(kind: JsonTokenKind, text: string) {
    if (text.length > 0) {
      tokens.push({ kind, text });
    }
  }

  while (i < input.length) {
    const ch = input[i];

    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
      let j = i + 1;
      while (j < input.length && " \n\r\t".includes(input[j] ?? "")) {
        j += 1;
      }
      push("ws", input.slice(i, j));
      i = j;
      continue;
    }

    if ("{}[],:".includes(ch)) {
      push("punct", ch);
      i += 1;
      continue;
    }

    if (ch === '"') {
      const start = i;
      i += 1;
      while (i < input.length) {
        if (input[i] === "\\") {
          i += 1;
          if (i >= input.length) {
            break;
          }
          if (input[i] === "u") {
            i += Math.min(4, input.length - i);
          }
          i += 1;
          continue;
        }
        if (input[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      push("string", input.slice(start, i));
      continue;
    }

    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      const start = i;
      i += 1;
      while (i < input.length && /[0-9.eE+-]/.test(input[i] ?? "")) {
        i += 1;
      }
      push("number", input.slice(start, i));
      continue;
    }

    if (input.startsWith("true", i)) {
      push("keyword", "true");
      i += 4;
      continue;
    }
    if (input.startsWith("false", i)) {
      push("keyword", "false");
      i += 5;
      continue;
    }
    if (input.startsWith("null", i)) {
      push("keyword", "null");
      i += 4;
      continue;
    }

    push("other", ch);
    i += 1;
  }

  return tokens;
}

function prettifyJsonIfPossible(source: string): string {
  try {
    return JSON.stringify(JSON.parse(source), null, 2);
  } catch {
    return source;
  }
}

const themeClasses: Record<"light" | "dark", Record<JsonTokenKind, string>> = {
  light: {
    ws: "text-slate-500/70",
    punct: "text-slate-600",
    string: "text-emerald-800",
    number: "text-amber-800",
    keyword: "text-violet-800",
    other: "text-slate-800",
  },
  dark: {
    ws: "text-slate-500/60",
    punct: "text-slate-400",
    string: "text-emerald-400",
    number: "text-amber-400",
    keyword: "text-violet-300",
    other: "text-slate-300",
  },
};

export interface HighlightedJsonProps {
  source: string;
  theme: "light" | "dark";
  className?: string;
}

export function HighlightedJson({ source, theme, className }: HighlightedJsonProps) {
  const formatted = useMemo(() => prettifyJsonIfPossible(source), [source]);
  const tokens = useMemo(() => tokenizeJson(formatted), [formatted]);
  const palette = themeClasses[theme];

  return (
    <code className={cn("block whitespace-pre-wrap break-all text-left", className)}>
      {tokens.map((token, index) => (
        <span key={index} className={palette[token.kind]}>
          {token.text}
        </span>
      ))}
    </code>
  );
}
