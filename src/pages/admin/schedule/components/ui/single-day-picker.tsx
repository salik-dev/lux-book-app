import { format } from "date-fns";

import { useDisclosure } from "@/pages/admin/schedule/hooks/use-disclosure";

import { ChevronDown } from "lucide-react";
import { Button } from "@/pages/admin/schedule/components/ui/button";
import { SingleCalendar } from "@/pages/admin/schedule/components/ui/single-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/pages/admin/schedule/components/ui/popover";

import { cn } from "@/pages/admin/schedule/lib/utils";

import type { ButtonHTMLAttributes } from "react";

// ================================== //

type TProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect" | "value"> & {
  onSelect: (value: Date | undefined) => void;
  value?: Date | undefined;
  placeholder: string;
  labelVariant?: "P" | "PP" | "PPP";
};

function SingleDayPicker({ id, onSelect, className, placeholder, labelVariant = "PPP", value, ...props }: TProps) {
  const { isOpen, onClose, onToggle } = useDisclosure();

  const handleSelect = (date: Date | undefined) => {
    onSelect(date);
    onClose();
  };

  return (
    <Popover open={isOpen} onOpenChange={onToggle}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn("group relative h-9 w-full min-w-0 justify-between whitespace-nowrap px-3 py-2 font-normal hover:bg-inherit", className)}
          {...props}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {value && <span>{format(value, labelVariant)}</span>}
            {!value && <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="center" className="w-fit p-0 lux-calendar pointer-events-auto" onClick={e => e.stopPropagation()}>
        <div className="pointer-events-auto">
          <SingleCalendar mode="single" selected={value} onSelect={handleSelect} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ================================== //

export { SingleDayPicker };
