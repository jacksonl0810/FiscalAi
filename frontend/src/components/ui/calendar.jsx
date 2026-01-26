import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { format, getYear, getMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  const [currentMonth, setCurrentMonth] = React.useState(
    props.selected || new Date()
  );

  // Generate years (current year ± 50 years)
  const currentYear = getYear(new Date());
  const years = Array.from({ length: 101 }, (_, i) => currentYear - 50 + i);

  const handleMonthChange = (monthIndex) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(monthIndex);
    setCurrentMonth(newDate);
  };

  const handleYearChange = (year) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    setCurrentMonth(newDate);
  };

  return (
    (<DayPicker
      showOutsideDays={showOutsideDays}
      month={currentMonth}
      onMonthChange={setCurrentMonth}
      className={cn(
        "p-4 rounded-2xl",
        "bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95",
        "backdrop-blur-xl border border-white/10",
        "shadow-2xl shadow-black/50",
        "relative overflow-hidden",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:to-transparent before:pointer-events-none",
        className
      )}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-between items-center mb-4 px-2",
        caption_label: "hidden", // Hide default caption, we'll use custom dropdowns
        caption_dropdowns: "flex items-center gap-2",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-8 w-8 rounded-lg",
          "bg-gradient-to-br from-white/5 to-white/0",
          "border border-white/10",
          "text-white/70 hover:text-white",
          "hover:bg-gradient-to-br hover:from-orange-500/20 hover:to-orange-500/10",
          "hover:border-orange-500/30",
          "transition-all duration-200",
          "p-0 opacity-70 hover:opacity-100",
          "shadow-sm hover:shadow-md hover:shadow-orange-500/20"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex mb-2",
        head_cell:
          "text-gray-400 rounded-md w-9 font-medium text-xs uppercase tracking-wider",
        row: "flex w-full mt-1",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-gradient-to-br [&:has([aria-selected])]:from-orange-500/20 [&:has([aria-selected])]:to-orange-600/20",
          "[&:has([aria-selected].day-outside)]:from-orange-500/10 [&:has([aria-selected].day-outside)]:to-orange-600/10",
          "[&:has([aria-selected].day-range-end)]:rounded-r-lg",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-lg [&:has(>.day-range-start)]:rounded-l-lg first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg"
            : "[&:has([aria-selected])]:rounded-lg"
        ),
        day: cn(
          "h-9 w-9 p-0 font-medium",
          "rounded-lg",
          "text-white/80 hover:text-white",
          "bg-transparent hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5",
          "border border-transparent hover:border-white/10",
          "transition-all duration-200",
          "hover:shadow-md hover:shadow-orange-500/10",
          "aria-selected:opacity-100",
          "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
        ),
        day_range_start: "day-range-start rounded-l-lg",
        day_range_end: "day-range-end rounded-r-lg",
        day_selected:
          "bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold shadow-lg shadow-orange-500/30 border-orange-400/50 hover:from-orange-400 hover:to-orange-500",
        day_today: "bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-orange-300 font-semibold border border-orange-500/30",
        day_outside:
          "day-outside text-gray-600 aria-selected:bg-orange-500/10 aria-selected:text-orange-300",
        day_disabled: "text-gray-700 opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-700",
        day_range_middle:
          "aria-selected:bg-gradient-to-br aria-selected:from-orange-500/20 aria-selected:to-orange-600/20 aria-selected:text-orange-200",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
        Caption: ({ displayMonth }) => {
          const monthIndex = getMonth(displayMonth);
          const year = getYear(displayMonth);

          return (
            <div className="flex items-center justify-between w-full px-2">
              <div className="flex items-center gap-2">
                <Select
                  value={monthIndex.toString()}
                  onValueChange={(value) => handleMonthChange(parseInt(value))}
                >
                  <SelectTrigger className="w-[140px] h-9 bg-gradient-to-br from-white/5 to-white/0 border-white/10 text-white hover:bg-white/10 hover:border-white/20">
                    <SelectValue>{MONTHS[monthIndex]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10">
                    {MONTHS.map((month, index) => (
                      <SelectItem
                        key={index}
                        value={index.toString()}
                        className="text-white hover:bg-white/10 focus:bg-white/10"
                      >
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={year.toString()}
                  onValueChange={(value) => handleYearChange(parseInt(value))}
                >
                  <SelectTrigger className="w-[100px] h-9 bg-gradient-to-br from-white/5 to-white/0 border-white/10 text-white hover:bg-white/10 hover:border-white/20">
                    <SelectValue>{year}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 max-h-[300px] overflow-y-auto">
                    {years.map((y) => (
                      <SelectItem
                        key={y}
                        value={y.toString()}
                        className="text-white hover:bg-white/10 focus:bg-white/10"
                      >
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        },
      }}
      {...props} />)
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
