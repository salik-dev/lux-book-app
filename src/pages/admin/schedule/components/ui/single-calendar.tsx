import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/pages/admin/schedule/components/ui/button";
import { buttonVariants } from "@/pages/admin/schedule/components/ui/button";

import { cn } from "@/pages/admin/schedule/lib/utils";

// react-day-picker v9 API
function SingleCalendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  const selectedDate = "selected" in props && props.selected instanceof Date ? props.selected : undefined;
  const [currentMonth, setCurrentMonth] = React.useState<Date | undefined>(() => selectedDate || new Date());

  React.useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(selectedDate);
    }
  }, [selectedDate]);

  const handlePrevious = () => {
    if (currentMonth) {
      const newMonth = new Date(currentMonth);
      newMonth.setMonth(newMonth.getMonth() - 1);
      setCurrentMonth(newMonth);
    }
  };

  const handleNext = () => {
    if (currentMonth) {
      const newMonth = new Date(currentMonth);
      newMonth.setMonth(newMonth.getMonth() + 1);
      setCurrentMonth(newMonth);
    }
  };

  const monthYear = currentMonth ? currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-4 px-3 pt-3">
        <Button
          type="button"
          onClick={handlePrevious}
          variant="outline"
          className="h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-accent transition-all cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{monthYear}</span>
        <Button
          type="button"
          onClick={handleNext}
          variant="outline"
          className="h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-accent transition-all cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <DayPicker
        showOutsideDays={showOutsideDays}
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        className={cn("p-3", className)}
        classNames={{
          months: "flex flex-col sm:flex-row gap-4",
          month: "space-y-4",
          month_caption: "hidden",
          caption_label: "hidden",
          nav: "hidden",
          button_previous: "hidden",
          button_next: "hidden",
          month_grid: "w-full border-collapse space-y-1",
          weekdays: "flex",
          weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
          week: "flex w-full mt-2",
          day: cn(
            "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
            "[&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-md",
            "[&:has([aria-selected])]:rounded-md"
          ),
          day_button: cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded-md"),
          range_start: "day-range-start",
          range_end: "day-range-end",
          selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
          today: "bg-accent text-accent-foreground",
          outside: "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
          disabled: "text-muted-foreground opacity-50",
          range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
          hidden: "invisible",
          ...classNames,
        }}
        components={{
          Chevron: ({ orientation, className, ...chevronProps }) => {
            const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
            return <Icon className={cn("h-4 w-4", className)} {...chevronProps} />;
          },
        }}
        {...props}
      />
    </div>
  );
}
SingleCalendar.displayName = "Calendar";

export { SingleCalendar };