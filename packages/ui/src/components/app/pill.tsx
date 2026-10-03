import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const pillVariants = cva("inline-flex items-center whitespace-nowrap rounded-full font-bold", {
  variants: {
    tone: {
      /** "Active", counts. */
      neutral: "bg-muted text-muted-foreground",
      /** "Invite sent", pending. */
      warning: "bg-warning/15 text-warning",
      /** "3 open", "3 requests", anything that needs the manager. */
      danger: "bg-destructive/12 text-destructive",
      success: "bg-success/15 text-success",
      /** A role tag: set --hue (or pass hue) and it tints itself. */
      role: "border border-[color-mix(in_srgb,var(--hue)_33%,transparent)] bg-[color-mix(in_srgb,var(--hue)_8%,transparent)] text-(--hue)",
    },
    size: {
      /** Role tags and status pills. */
      sm: "px-2.5 py-[3px] text-[10.5px]",
      /** The chips row above the board. */
      md: "px-2.5 py-1 text-[11.5px]",
    },
  },
  defaultVariants: { tone: "neutral", size: "sm" },
})

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  /** For tone="role": any CSS colour; usually roleHue(role). */
  hue?: string
}

function Pill({ className, tone, size, hue, style, ...props }: PillProps) {
  return (
    <span
      className={cn(pillVariants({ tone, size }), className)}
      style={hue ? ({ "--hue": hue, ...style } as React.CSSProperties) : style}
      {...props}
    />
  )
}

export { Pill, pillVariants }
