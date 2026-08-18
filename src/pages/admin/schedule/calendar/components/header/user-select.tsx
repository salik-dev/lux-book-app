import { useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";

import { AvatarGroup } from "@/pages/admin/schedule/components/ui/avatar-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/pages/admin/schedule/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/pages/admin/schedule/components/ui/select";

import { CarSearchBox, CarThumbnail, CarEmptyState, useCarSearch } from "@/pages/admin/schedule/calendar/components/ui/car-search-select";

export function UserSelect() {
  const { users, selectedUserId, setSelectedUserId, cars } = useCalendar();

  const isCarCalendar = !!cars;
  const disabledCarIds = new Set((cars ?? []).filter(c => !c.is_available).map(c => c.id));

  const { query, setQuery, filtered } = useCarSearch(cars ?? []);
  const filteredUsers = isCarCalendar ? users.filter(u => filtered.some(c => c.id === u.id)) : users;

  return (
    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
      <SelectTrigger className="flex-1 md:w-48">
        <SelectValue />
      </SelectTrigger>

      <SelectContent align="end" className="max-h-72">
        {isCarCalendar && <CarSearchBox value={query} onChange={setQuery} placeholder="Search by car name…" />}

        <SelectItem value="all">
          <div className="flex items-center gap-1">
            <AvatarGroup max={2}>
              {users.map(user => (
                <Avatar key={user.id} className="size-6 text-xxs">
                  <AvatarImage src={user.picturePath ?? undefined} alt={user.name} />
                  <AvatarFallback className="text-xxs">{user.name[0]}</AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            {isCarCalendar ? "All cars" : "All"}
          </div>
        </SelectItem>

        {filteredUsers.length === 0 ? (
          <CarEmptyState />
        ) : (
          filteredUsers.map(user => (
            <SelectItem key={user.id} value={user.id} className="flex-1">
              <div className="flex items-center gap-2">
                {isCarCalendar ? (
                  <CarThumbnail car={{ name: user.name, image_url: user.picturePath }} />
                ) : (
                  <Avatar key={user.id} className="size-6">
                    <AvatarImage src={user.picturePath ?? undefined} alt={user.name} />
                    <AvatarFallback className="text-xxs">{user.name[0]}</AvatarFallback>
                  </Avatar>
                )}

                <p className="truncate">{user.name}</p>

                {disabledCarIds.has(user.id) && (
                  <span className="ml-auto rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                    Disabled
                  </span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
