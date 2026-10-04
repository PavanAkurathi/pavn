import * as React from "react"

import { cn } from "../../lib/utils"

export interface ShiftCardProps extends Omit<React.ComponentPropsWithRef<"button">, "children" | "title"> {
  /** "assigned" is a shift; "open" is the dashed slot nobody has yet. */
  kind?: "assigned" | "open"
  /** What the shift is, e.g. its role or the event it belongs to. Bold, unless `leadWith` is "time". */
  title?: string
  /** "4p–11p". */
  time: string
  /** Which line is strongest. A worker's entry leads with the time; a shift on its own leads with its title. */
  leadWith?: "title" | "time"
  /** Where it is, shown under the title when the board spans more than one site. */
  site?: string
  /** Ends the next day: "+1" after the time. */
  overnight?: boolean
  /** Small text after the time: "3/4" filled, or the role. */
  detail?: string
  /** Not published yet: dashed, with a DRAFT tag. Staff can't see it. */
  draft?: boolean
  /** Double-booked or on approved time off: red ring and a "!" badge. */
  conflict?: boolean
  /** Being removed at the next publish. */
  removed?: boolean
  /** Part of an event: a ◆ before the title. */
  event?: boolean
  /** Published, with edits staff can't see yet: an amber dot. */
  edited?: boolean
  /** Comfortable is the full chip; compact is one line, for big teams. */
  density?: "comfortable" | "compact"
  /** Native tooltip (the `title` attribute is the bold line here). */
  tooltip?: string
  /** Right-aligned extra. */
  trailing?: React.ReactNode
  /** Text of an open card. */
  openLabel?: string
}

/**
 * The shift chip, after docs/design/manager-scheduler/pavn-schedule-board.html.
 * Black and white on purpose: a draft reads as a draft by its dashed edge, not
 * by a colour.
 *
 *   comfortable          compact
 *   ┌───────────────┐    ┌──────────────────────┐
 *   │ DRAFT         │    │ 11a–4p  Server · 3/4 │
 *   │ Server        │    └──────────────────────┘
 *   │ 11a–4p · 3/4  │
 *   └───────────────┘
 *
 * It is a button so it can be focused, clicked and dragged; refs and listeners
 * pass straight through to it.
 */
function ShiftCard({
  kind = "assigned",
  title,
  time,
  leadWith = "title",
  site,
  overnight,
  detail,
  draft,
  conflict,
  removed,
  edited,
  event,
  density = "comfortable",
  tooltip,
  trailing,
  openLabel = "OPEN · tap to assign",
  className,
  ...props
}: ShiftCardProps) {
  const open = kind === "open"
  const compact = density === "compact"
  const diamond = event ? (
    <span aria-hidden className="mr-0.5 text-[10px] font-normal">
      ◆
    </span>
  ) : null
  const sub = detail ? `${time} · ${detail}` : time
  const timeText = overnight ? `${time} +1` : time

  return (
    <button
      type="button"
      data-shift-card
      data-kind={kind}
      className={cn(
        "relative block w-full min-w-0 rounded-chip border border-border bg-card text-left text-xs leading-tight transition-shadow",
        "hover:shadow-[0_4px_14px_rgba(20,16,60,0.1)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        compact ? "px-1.5 py-0.5" : "px-[9px] py-[7px]",
        // Open: no fill, a firm dashed outline, centred text.
        open && "border-dashed border-foreground bg-transparent text-center",
        open && !compact && "px-[5px] py-2",
        // Draft: a dashed edge and a faint fill.
        draft && "border-dashed bg-muted/40",
        // Removed at next publish.
        removed && "border-dashed border-destructive bg-muted opacity-60",
        conflict && "shadow-[0_0_0_2px_var(--destructive)]",
        // "N open" in the toolbar marks the open cards for a moment.
        "data-[flash=true]:outline-2 data-[flash=true]:outline-offset-2 data-[flash=true]:outline-primary",
        className
      )}
      title={tooltip}
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
            <span className="font-semibold tabular-nums">{sub}</span>
            {trailing}
          </span>
        ) : (
          <>
            <span className="block text-[11px] font-semibold text-muted-foreground">{openLabel}</span>
            <span className="mt-px block text-[11px] tabular-nums text-muted-foreground">
              {sub}
              {trailing ? <span className="ml-1.5 font-bold text-foreground">{trailing}</span> : null}
            </span>
          </>
        )
      ) : compact ? (
        <span className="flex items-center gap-1.5">
          <span className={cn("whitespace-nowrap font-semibold tabular-nums", removed && "line-through")}>
            {diamond}
            {timeText}
          </span>
          {title || detail || site ? (
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              {[title, site, detail].filter(Boolean).join(" · ")}
              {draft ? " · draft" : ""}
            </span>
          ) : null}
          {trailing ? <span className="ml-auto text-[11px] font-semibold tabular-nums">{trailing}</span> : null}
        </span>
      ) : leadWith === "time" ? (
        <>
          {draft ? (
            <span className="mb-0.5 block text-[9px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground/70">Draft</span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <span className={cn("min-w-0 flex-1 truncate text-[12.5px] font-bold tabular-nums", removed && "line-through")}>
              {diamond}
              {timeText}
            </span>
            {trailing ? <span className="shrink-0 text-[11px] font-semibold tabular-nums">{trailing}</span> : null}
          </span>
          {title ? <span className="mt-px block truncate text-[11.5px] text-foreground/80">{title}</span> : null}
          {site ? <span className="block truncate text-[11px] text-muted-foreground">{site}</span> : null}
        </>
      ) : (
        <>
          {draft ? (
            <span className="mb-0.5 block text-[9px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground/70">Draft</span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <span className={cn("min-w-0 flex-1 truncate text-[12.5px] font-bold", removed && "line-through")}>
              {diamond}
              {title ?? time}
            </span>
            {trailing ? <span className="shrink-0 text-[11px] font-semibold tabular-nums">{trailing}</span> : null}
          </span>
          {title ? (
            <span className={cn("mt-px block truncate text-[11.5px] tabular-nums text-muted-foreground", removed && "line-through")}>
              {sub}
            </span>
          ) : detail ? (
            <span className="mt-px block truncate text-[11.5px] text-muted-foreground">{detail}</span>
          ) : null}
        </>
      )}
    </button>
  )
}

export { ShiftCard }
