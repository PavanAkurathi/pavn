import * as React from "react"

import { cn } from "../../lib/utils"
import { initials } from "../../lib/role-hue"

const SIZES = {
  "2xs": "size-3.5 text-[8px]",
  xs: "size-[18px] text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-[30px] text-[11px]",
  lg: "size-10 text-[13px]",
} as const

export interface InitialsAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string
  /** Any CSS colour. Leave it out for the neutral grey avatar. */
  hue?: string
  size?: keyof typeof SIZES
  /** "solid" fills with the hue; "soft" is a light tint of it with the initials in a deeper shade. */
  tone?: "solid" | "soft"
}

/** A round avatar with the person's initials: neutral grey, or a solid colour when given a hue. */
function InitialsAvatar({ name, hue, size = "md", tone = "solid", className, style, ...props }: InitialsAvatarProps) {
  const soft = Boolean(hue) && tone === "soft"
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold leading-none",
        !hue ? "bg-muted text-muted-foreground" : soft ? "" : "text-white",
        SIZES[size],
        className
      )}
      style={
        !hue
          ? style
          : soft
            ? { background: `color-mix(in srgb, ${hue} 18%, var(--card))`, color: `color-mix(in srgb, ${hue} 70%, #000)`, ...style }
            : { background: hue, ...style }
      }
      {...props}
    >
      {initials(name)}
    </span>
  )
}

export { InitialsAvatar }
