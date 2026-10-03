import * as React from "react"

import { cn } from "../../lib/utils"
import { InitialsAvatar } from "./initials-avatar"

export interface ShiftCardProps extends Omit<React.ComponentPropsWithRef<"button">, "children"> {
  /** The role's colour (roleHue(role)). Tint, border and left bar all come from it. */
  hue: string
  /** "assigned" shows the person; "open" is the dashed slot nobody has yet. */
  kind?: "assigned" | "open"
  /**
   * The assignee, for a card on a position row. Leave it out on a person's own
   * row, where the row already says who: the card then leads with the time.
   */
  name?: string
  /** "4p – 11p". */
  time: string
  /** Small text after the time: the role, "draft", "2 open". */
  detail?: string
  /** Not published yet: dashed and faded; staff can't see it. */
  draft?: boolean
  /** Double-booked or on approved time off: red ring and a "!" badge. */
  conflict?: boolean
  /** Being removed at the next publish. */
  removed?: boolean
  /** Part of an event: a ◆ before the time. */
  event?: boolean
  /** Published, with edits staff can't see yet: an amber dot. */
  edited?: boolean
  /** Comfortable is the mockup card; compact is one line, for big teams. */
  density?: "comfortable" | "compact"
  /** Right-aligned extra, e.g. a "2/3" fill count. */
  trailing?: React.ReactNode
  /** Text of an open card. */
  openLabel?: string
}

/**
 * The shift card, after docs/design/manager-scheduler/shiftly-phase1.html.
 *
 *   comfortable        compact
 *   ┌──────────────┐   ┌─────────────┐
 *   ┃ (MR) Maya R. │   ┃ (MR) 4p–11p │
 *   ┃ 4p – 11p     │   └─────────────┘
 *   └──────────────┘
 *
 * It is a button so it can be focused, clicked and dragged; refs and listeners
 * pass straight through to it.
 */
function ShiftCard({
  hue,
  kind = "assigned",
  name,
  time,
  detail,
  draft,
  conflict,
  removed,
  edited,
  event,
  density = "comfortable",
  trailing,
  openLabel = "OPEN · tap to assign",
  className,
  style,
  ...props
}: ShiftCardProps) {
  const open = kind === "open"
  const compact = density === "compact"
  const diamond = event ? (
    <span aria-hidden className="mr-0.5 text-[10px] font-normal">
      ◆
    </span>
  ) : null
  const timeLine = detail ? `${time} · ${detail}` : time

  return (
    <button
      type="button"
      data-shift-card
      data-kind={kind}
      className={cn(
        "relative block w-full min-w-0 rounded-chip border text-left text-xs leading-tight",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        compact ? "px-1.5 py-0.5" : "px-[7px] py-[5px]",
        // Assigned: a tint of the role hue, a firmer border, a 3px bar on the left.
        !open &&
          "border-[color-mix(in_srgb,var(--hue)_40%,transparent)] border-l-[3px] border-l-(--hue) bg-[color-mix(in_srgb,var(--hue)_9%,var(--card))]",
        // Open: no fill, a dashed outline, centred text.
        open && "border-dashed border-foreground bg-transparent text-center",
        open && !compact && "px-[5px] py-2",
        // Draft: dashed and faded.
        draft && "border-dashed opacity-[0.72]",
        // Removed at next publish.
        removed && "border-dashed border-destructive bg-muted opacity-60",
        conflict && "shadow-[0_0_0_2px_var(--destructive)]",
        // "N open" in the toolbar marks the open cards for a moment.
        "data-[flash=true]:outline-2 data-[flash=true]:outline-offset-2 data-[flash=true]:outline-primary",
        className
      )}
      style={{ "--hue": hue, ...style } as React.CSSProperties}
      {...props}
    >
      {conflict ? (
        <span
          aria-hidden
          className="absolute -right-[5px] -top-[7px] flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-extrabold leading-none text-white"
        >
          !
        </span>
      ) : null}
      {edited && !draft ? (
        <span aria-hidden className="absolute right-1 top-1 size-[7px] rounded-full bg-warning ring-[1.5px] ring-card" />
      ) : null}

      {open ? (
        compact ? (
          <span className="flex items-center justify-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">OPEN</span>
            <span className="font-semibold tabular-nums">{timeLine}</span>
            {trailing}
          </span>
        ) : (
          <>
            <span className="block text-[11px] font-semibold text-muted-foreground">{openLabel}</span>
            <span className="mt-px block text-[11px] tabular-nums text-muted-foreground">
              {timeLine}
              {trailing ? <span className="ml-1.5 font-bold text-destructive">{trailing}</span> : null}
            </span>
          </>
        )
      ) : compact ? (
        <span className="flex items-center gap-1.5">
          {name ? <InitialsAvatar name={name} hue={hue} size="2xs" /> : null}
          <span className={cn("whitespace-nowrap font-semibold tabular-nums", removed && "line-through")}>
            {diamond}
            {time}
          </span>
          {detail ? <span className="min-w-0 truncate text-[11px] text-muted-foreground">{detail}</span> : null}
          {trailing ? <span className="ml-auto text-[11px] font-semibold tabular-nums">{trailing}</span> : null}
        </span>
      ) : name ? (
        // On a position row: who, then when.
        <>
          <span className="flex items-center gap-1.5">
            <InitialsAvatar name={name} hue={hue} size="xs" />
            <span className="min-w-0 flex-1 truncate text-xs font-bold">{name}</span>
            {trailing ? <span className="shrink-0 text-[11px] font-semibold tabular-nums">{trailing}</span> : null}
          </span>
          <span className={cn("mt-px block text-[11px] tabular-nums text-muted-foreground", removed && "line-through")}>
            {diamond}
            {timeLine}
          </span>
        </>
      ) : (
        // On a person's row the row already says who: when, then what (the role, if it differs).
        <>
          <span className="flex items-center gap-1.5">
            <span className={cn("min-w-0 flex-1 truncate text-xs font-bold tabular-nums", removed && "line-through")}>
              {diamond}
              {time}
            </span>
            {trailing ? <span className="shrink-0 text-[11px] font-semibold tabular-nums">{trailing}</span> : null}
          </span>
          {detail ? <span className="mt-px block truncate text-[11px] text-muted-foreground">{detail}</span> : null}
        </>
      )}
    </button>
  )
}

export { ShiftCard }
