import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, RefreshCw, Search, SearchX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CarData } from "@/@types/data";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import defaultImg from "../../assets/luxury-car-collection-garage-premium.jpg";

interface VehicleSwitcherProps {
  selectedCar: CarData;
  onSelect: (car: CarData) => void;
  disabled?: boolean;
}

const CAR_COLUMNS =
  "id, name, model, brand, year, description, base_price_per_hour, base_price_per_day, deposit_amount, included_km_per_day, extra_km_rate, image_url, is_available";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("no-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
  }).format(price);

export const VehicleSwitcher: React.FC<VehicleSwitcherProps> = ({ selectedCar, onSelect, disabled }) => {
  const [open, setOpen] = useState(false);
  const [cars, setCars] = useState<CarData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const loadCars = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("cars")
        .select(CAR_COLUMNS)
        .order("base_price_per_day", { ascending: true });
      if (fetchError) throw fetchError;
      if (requestId !== requestIdRef.current) return;
      setCars((data ?? []) as unknown as CarData[]);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("Failed to load vehicles:", err);
      setError("Could not load vehicles. Please try again.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // Load lazily when the menu opens; reuse the list afterwards (a failed load retries on reopen).
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && cars === null && !loading) void loadCars();
  };

  const filteredCars = useMemo(() => {
    const list = cars ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((car) =>
      [car.name, car.brand, car.model, String(car.year ?? "")]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [cars, query]);

  const isSelectable = (car: CarData) => car.is_available !== false;

  // Reset search and point the highlight at the current vehicle each time the menu opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filteredCars.findIndex((car) => String(car.id) === String(selectedCar.id));
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, filteredCars.findIndex(isSelectable)));
    // Only re-anchor when the visible list changes, not on every highlight move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filteredCars, selectedCar.id]);

  // Keep the highlighted option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // The menu is portaled to <body>, so it isn't clipped by the booking dialog's scroll area and
  // would float over the dialog header while the form scrolls. Clip it to the scroll container
  // each frame so it slides "behind" the container edges like in-flow content.
  useEffect(() => {
    if (!open) return;
    const container = triggerRef.current?.closest<HTMLElement>("[data-booking-scroll-container]");
    if (!container) return;

    let frame = 0;
    let lastClip = "";
    const update = () => {
      // Measure the popper wrapper: it is positioned but not scaled by the open animation.
      const box = contentRef.current?.closest<HTMLElement>("[data-radix-popper-content-wrapper]");
      const content = box?.firstElementChild as HTMLElement | null | undefined;
      if (content && box) {
        const c = container.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        const top = Math.max(0, c.top - b.top);
        const bottom = Math.max(0, b.bottom - c.bottom);
        const fullyHidden = top + bottom >= b.height;
        const clip = fullyHidden ? "inset(50% 0 50% 0)" : top || bottom ? `inset(${top}px 0 ${bottom}px 0)` : "";
        if (clip !== lastClip) {
          lastClip = clip;
          content.style.clipPath = clip;
          content.style.pointerEvents = fullyHidden ? "none" : "";
        }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const handleSelect = (car: CarData) => {
    if (!isSelectable(car)) return;
    setOpen(false);
    if (String(car.id) !== String(selectedCar.id)) onSelect(car);
  };

  const moveActive = (direction: 1 | -1) => {
    if (!filteredCars.length) return;
    let next = activeIndex;
    for (let i = 0; i < filteredCars.length; i += 1) {
      next = (next + direction + filteredCars.length) % filteredCars.length;
      if (isSelectable(filteredCars[next])) break;
    }
    setActiveIndex(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const car = filteredCars[activeIndex];
      if (car) handleSelect(car);
    }
  };

  const listboxId = "vehicle-switcher-listbox";
  const activeCar = filteredCars[activeIndex];

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "group inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-[#46555d] bg-[#1b2529] px-3 text-sm font-medium text-[#b1bdc3] transition-colors",
            "hover:border-[#E3C08D]/70 hover:bg-[#27343a] hover:text-[#E3C08D]",
            "focus-visible:border-[#E3C08D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C08D]/50",
            "disabled:cursor-not-allowed disabled:opacity-60",
            open && "border-[#E3C08D]/70 text-[#E3C08D]"
          )}
        >
          Change vehicle
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchRef.current?.focus();
        }}
        className="lux-pop w-[min(380px,calc(100vw-32px))] overflow-hidden border-[#46555d] bg-[#1b2529] p-0 text-[#b1bdc3] shadow-2xl"
      >
        <div ref={contentRef} className="flex items-center gap-2 border-b border-[#334047] px-3">
          <Search className="h-4 w-4 shrink-0 text-[#7f8d93]" aria-hidden />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name, brand or model ..."
            aria-label="Search vehicles"
            aria-controls={listboxId}
            aria-activedescendant={activeCar ? `vehicle-option-${activeCar.id}` : undefined}
            role="combobox"
            aria-expanded={open}
            className="h-11 w-full bg-transparent text-sm text-[#d0d9dd] placeholder:text-[#6f7d84] focus:outline-none"
          />
        </div>

        {/* The menu is portaled outside the booking Dialog, whose scroll lock cancels wheel/touch
            scrolling on document; stopping propagation here lets this list scroll natively. */}
        <div
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className="max-h-[min(360px,55vh)] overflow-y-auto overscroll-contain p-1.5 [scrollbar-color:#6b7280_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-track]:bg-transparent">
          {cars === null && !error ? (
            <div className="space-y-1.5 p-1" aria-busy="true" aria-label="Loading vehicles">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md p-2">
                  <div className="h-12 w-16 shrink-0 animate-pulse rounded bg-[#2a363b]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-[#2a363b]" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-[#2a363b]" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <p className="text-sm text-red-200">{error}</p>
              <button
                type="button"
                onClick={() => void loadCars()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md border border-[#46555d] px-3 py-1.5 text-xs font-medium text-[#b1bdc3] transition-colors hover:border-[#E3C08D]/70 hover:text-[#E3C08D] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Retry
              </button>
            </div>
          ) : filteredCars.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-[#9eabb1]">
              <SearchX className="h-5 w-5 text-[#6f7d84]" aria-hidden />
              {query ? `No vehicles match "${query.trim()}".` : "No vehicles available right now."}
            </div>
          ) : (
            <ul ref={listRef} id={listboxId} role="listbox" aria-label="Vehicles" className="space-y-0.5">
              {filteredCars.map((car, index) => {
                const isSelected = String(car.id) === String(selectedCar.id);
                const selectable = isSelectable(car);
                const isActive = index === activeIndex;
                const subtitle = [car.brand, car.model, car.year].filter(Boolean).join(" · ");
                return (
                  <li
                    key={car.id}
                    id={`vehicle-option-${car.id}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={!selectable}
                    onMouseEnter={() => selectable && setActiveIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(car)}
                    className={cn(
                      "flex items-center gap-3 rounded-md p-2 transition-colors",
                      selectable ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                      isActive && selectable && "bg-[#27343a]",
                      isSelected && "bg-[#E3C08D]/10 ring-1 ring-inset ring-[#E3C08D]/40"
                    )}
                  >
                    <img
                      src={car.image_url || defaultImg}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        if (e.currentTarget.src !== defaultImg) e.currentTarget.src = defaultImg;
                      }}
                      className="h-12 w-16 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", isSelected ? "text-[#E3C08D]" : "text-[#d0d9dd]")}>
                        {car.name}
                      </p>
                      {subtitle && <p className="truncate text-xs text-[#8a979d]">{subtitle}</p>}
                      <p className="mt-0.5 text-xs text-[#b1bdc3]">
                        {formatPrice(Number(car.base_price_per_day ?? 0))}
                        <span className="text-[#7f8d93]"> / day</span>
                        <span className="mx-1.5 text-[#46555d]">·</span>
                        {formatPrice(Number(car.base_price_per_hour ?? 0))}
                        <span className="text-[#7f8d93]"> / hour</span>
                      </p>
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-[#E3C08D]" aria-hidden />
                    ) : !selectable ? (
                      <span className="shrink-0 rounded border border-[#46555d] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#9eabb1]">
                        Unavailable
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
