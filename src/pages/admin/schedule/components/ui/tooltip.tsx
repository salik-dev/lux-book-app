import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/pages/admin/schedule/lib/utils"

const TooltipProvider = ({
  delayDuration = 150,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
)

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "tooltip-pop z-50 max-w-xs rounded-lg border border-[#c9a875] bg-[#E3C08D] px-2.5 py-1 text-[11px] font-medium text-[#1a1208] shadow-lg origin-[--radix-tooltip-content-transform-origin]",
        className
      )}
      {...props}
    >
      {props.children}
      <TooltipPrimitive.Arrow className="fill-[#E3C08D]" width={11} height={6} />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
