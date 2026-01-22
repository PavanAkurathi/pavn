"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "../../lib/utils"


export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: cn("w-full", defaultClassNames.root),
        months: cn("flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0", defaultClassNames.months),
        month: cn("space-y-4 w-full", defaultClassNames.month),
        // 'caption' -> 'month_caption' or components override? 
        // Using 'month_caption' for container of caption
        // 'caption' -> 'month_caption'
        // Create a distinct header bar with light background
        month_caption: cn("flex justify-center pt-2 pb-2 relative items-center bg-primary/5 mb-2 border-b border-primary/10", defaultClassNames.month_caption),

        caption_label: cn(
          "text-sm font-medium",
          props.captionLayout ? "hidden" : "", // Hide label if using dropdowns to avoid duplication
          defaultClassNames.caption_label
        ),
        nav: cn("space-x-1 flex items-center", defaultClassNames.nav),
        button_previous: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1 flex items-center justify-center border border-input rounded-md hover:bg-accent hover:text-accent-foreground",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1 flex items-center justify-center border border-input rounded-md hover:bg-accent hover:text-accent-foreground",
          defaultClassNames.button_next
        ),
        // 'table' not supported in ClassNames? It relies on default.
        // 'head_row' -> 'weekdays'
        weekdays: cn("flex w-full", defaultClassNames.weekdays),
        // 'head_cell' -> 'weekday'
        weekday: cn(
          "text-muted-foreground rounded-md font-normal text-[0.8rem] flex-1",
          defaultClassNames.weekday
        ),
        // 'row' -> 'week'
        week: cn("flex w-full mt-2", defaultClassNames.week),
        // 'cell' not supported? Styles usually go on 'day'. 
        // We will try to rely on 'day' button styling to fill space.
        // 'day' -> Base day cell style
        day: cn(
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-full flex items-center justify-center hover:bg-muted transition-colors",
          defaultClassNames.day
        ),
        // 'day_range_end' -> 'range_end'
        range_end: cn("day-range-end", defaultClassNames.range_end),
        // 'day_selected' -> 'selected'
        selected: cn(
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full",
          defaultClassNames.selected
        ),
        // 'day_today' -> 'today'
        today: cn("bg-accent text-accent-foreground", defaultClassNames.today),
        // 'day_outside' -> 'outside'
        outside: cn(
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        // 'day_disabled' -> 'disabled'
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        // 'day_range_middle' -> 'range_middle'
        range_middle: cn(
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
          defaultClassNames.range_middle
        ),
        // 'day_hidden' -> 'hidden'
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className={cn("h-4 w-4", className)} {...props} />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
