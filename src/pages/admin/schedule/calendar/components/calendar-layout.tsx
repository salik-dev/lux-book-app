import { Settings } from "lucide-react";
import { Outlet } from "react-router-dom";

import { CalendarProvider } from "@/pages/admin/schedule/calendar/contexts/calendar-context";

import { ChangeBadgeVariantInput } from "@/pages/admin/schedule/calendar/components/change-badge-variant-input";
import { ChangeVisibleHoursInput } from "@/pages/admin/schedule/calendar/components/change-visible-hours-input";
import { ChangeWorkingHoursInput } from "@/pages/admin/schedule/calendar/components/change-working-hours-input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/pages/admin/schedule/components/ui/accordion";

import { CALENDAR_ITEMS_MOCK, USERS_MOCK } from "@/pages/admin/schedule/calendar/mocks";

export function CalendarLayout() {
  // In a real scenario these would come from an API (see src/calendar/requests.ts).
  const events = CALENDAR_ITEMS_MOCK;
  const users = USERS_MOCK;

  return (
    <CalendarProvider users={users} events={events}>
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-8 py-4">
        <Outlet />

        <Accordion type="single" collapsible>
          <AccordionItem value="item-1" className="border-none">
            <AccordionTrigger className="flex-none gap-2 py-0 hover:no-underline">
              <div className="flex items-center gap-2">
                <Settings className="size-4" />
                <p className="text-base font-semibold">Calendar settings</p>
              </div>
              
            </AccordionTrigger>

            <AccordionContent>
              <div className="mt-4 flex flex-col gap-6">
                <ChangeBadgeVariantInput />
                <ChangeVisibleHoursInput />
                <ChangeWorkingHoursInput />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </CalendarProvider>
  );
}
