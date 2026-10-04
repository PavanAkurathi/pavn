import * as React from "react"

import { cn } from "../../lib/utils"
import { initials } from "../../lib/role-hue"

const SIZES = {
  "2xs": "size-3.5 text-[8px]",
  xs: "size-[18px] text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-[30px] text-[11px]",
} as const

export interface InitialsAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string
  /** Any CSS colour. Leave it out for the neutral grey avatar. */
  hue?: string
  size?: keyof typeof SIZES
}

/** A round avatar with the person's initials: neutral grey, or a solid colour when given a hue. */
function InitialsAvatar({ name, hue, size = "md", className, style, ...props }: InitialsAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold leading-none",
        hue ? "text-white" : "bg-muted text-muted-foreground",
        SIZES[size],
        className
      )}
      style={hue ? { background: hue, ...style } : style}
      {...props}
    >
      {initials(name)}
    </span>
  )
}

export { InitialsAvatar }
