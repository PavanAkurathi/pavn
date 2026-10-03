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
  /** Any CSS colour; usually roleHue(role). */
  hue: string
  size?: keyof typeof SIZES
}

/** A round, solid-colour avatar with the person's initials. */
function InitialsAvatar({ name, hue, size = "md", className, style, ...props }: InitialsAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold leading-none text-white",
        SIZES[size],
        className
      )}
      style={{ background: hue, ...style }}
      {...props}
    >
      {initials(name)}
    </span>
  )
}

export { InitialsAvatar }
