import { useState } from "react";
import { cn } from "../lib/utils";

const MAX_LINES_COLLAPSED = 6;
/** Si el texto no tiene saltos de línea pero supera esto (~6 líneas de ~120 caracteres), también se colapsa. */
const MAX_CHARS_WHEN_SINGLE_LINE = 720;

export interface ExpandableLogMessageProps {
  text: string;
  /** Estilos del bloque de texto (color, fuente, etc.) */
  className?: string;
  /** Contenedor externo (p. ej. max-width) */
  containerClassName?: string;
  /** Enlace «ver más»: default (claro) o invert (sobre fondo oscuro) */
  expandTone?: "default" | "invert";
  /** Si el texto debe respetar saltos de línea */
  preWrap?: boolean;
}

export function ExpandableLogMessage({
  text,
  className,
  containerClassName,
  expandTone = "default",
  preWrap = true,
}: ExpandableLogMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.length === 0 ? [""] : normalized.split("\n");
  const tooManyLines = lines.length > MAX_LINES_COLLAPSED;
  const longBlob =
    !tooManyLines && normalized.length > MAX_CHARS_WHEN_SINGLE_LINE;
  const needsExpand = tooManyLines || longBlob;
  let shownText = normalized;
  if (needsExpand && !expanded) {
    if (tooManyLines) {
      shownText = lines.slice(0, MAX_LINES_COLLAPSED).join("\n");
    } else {
      shownText = `${normalized.slice(0, MAX_CHARS_WHEN_SINGLE_LINE)}…`;
    }
  }

  const expandBtnClass =
    expandTone === "invert"
      ? "text-white/75 underline decoration-white/35 underline-offset-2 hover:text-white hover:decoration-white/60"
      : "text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary";

  return (
    <div className={cn("min-w-0", containerClassName)}>
      <span className={cn(preWrap && "whitespace-pre-wrap break-words", className)}>{shownText}</span>
      {needsExpand ? (
        <div className="mt-1.5">
          <button
            type="button"
            className={cn("text-[11px] font-medium", expandBtnClass)}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "ver menos" : "ver más"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
