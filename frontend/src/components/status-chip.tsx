import { Chip, cn } from "@heroui/react";
import type { ReactNode } from "react";
import type { StatusTone } from "../lib/dashboard";

const toneProps = {
  neutral: { color: "default", variant: "soft" },
  live: { color: "accent", variant: "soft" },
  success: { color: "success", variant: "soft" },
  warning: { color: "warning", variant: "soft" },
  danger: { color: "danger", variant: "soft" },
} as const;

type StatusChipProps = {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
};

export function StatusChip({ tone, children, className }: StatusChipProps) {
  return (
    <Chip
      color={toneProps[tone].color}
      variant={toneProps[tone].variant}
      size="sm"
      className={cn("px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", className)}
    >
      {children}
    </Chip>
  );
}
