import { createContext, useContext } from 'react';

/**
 * DOM node rendered in the admin dashboard's top header (replacing the static
 * subtitle) that data-table pages portal their search bar + action button(s)
 * into, so those controls appear at the top of the page instead of buried
 * inside each management component's own card.
 */
export const AdminHeaderSlotContext = createContext<HTMLDivElement | null>(null);

export const useAdminHeaderSlot = () => useContext(AdminHeaderSlotContext);
