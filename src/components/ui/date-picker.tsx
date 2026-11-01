"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  className?: string;
  disabled?: (date: Date) => boolean;
  /** For a <Label htmlFor>. */
  id?: string;
}

// The calendar opens on the chosen date's month (not today's, so an older session's date can be found and
// changed), closes once a day is picked, and keeps the date when the chosen day is tapped again (the calendar
// would otherwise clear it, leaving no date).
export function DatePicker({ date, setDate, className, disabled, id }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={picked => {
            if (picked) setDate(picked)
            setOpen(false)
          }}
          initialFocus
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  )
}
