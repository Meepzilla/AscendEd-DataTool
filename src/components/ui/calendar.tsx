"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// react-day-picker 9 (needed for React 19): the same look as before, with v9's class names. A day is now a
// cell (`day`) holding a button (`day_button`); selection, today and outside-month styles go on the cell.
export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 h-7 items-center",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between px-1 pt-1 z-10",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative [&.range-end]:rounded-r-md [&.range-start]:rounded-l-md [&.outside[aria-selected]]:bg-accent/50 [&[aria-selected]]:bg-accent first:[&[aria-selected]]:rounded-l-md last:[&[aria-selected]]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal"
        ),
        range_start: "range-start",
        range_end: "range-end",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground [&>button:focus]:bg-primary [&>button:focus]:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside:
          "outside text-muted-foreground [&>button]:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        // v9 marks the days between the ends "selected" too; they keep the lighter accent (as in v8), not the
        // primary fill of the start and end days.
        range_middle:
          "[&>button]:!bg-accent [&>button]:!text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className }) =>
          orientation === "left"
            ? <ChevronLeft className={cn("h-4 w-4", className)} />
            : <ChevronRight className={cn("h-4 w-4", className)} />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
