import { useCalendar } from "@/pages/admin/schedule/calendar/contexts/calendar-context";

import { AvatarGroup } from "@/pages/admin/schedule/components/ui/avatar-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/pages/admin/schedule/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/pages/admin/schedule/components/ui/select";

export function UserSelect() {
  const { users, selectedUserId, setSelectedUserId, cars } = useCalendar();

  const isCarCalendar = !!cars;
  const disabledCarIds = new Set((cars ?? []).filter(c => !c.is_available).map(c => c.id));

  return (
    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
      <SelectTrigger className="flex-1 md:w-48">
        <SelectValue />
      </SelectTrigger>

      <SelectContent align="end">
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

        {users.map(user => (
          <SelectItem key={user.id} value={user.id} className="flex-1">
            <div className="flex items-center gap-2">
              <Avatar key={user.id} className="size-6">
                <AvatarImage src={user.picturePath ?? undefined} alt={user.name} />
                <AvatarFallback className="text-xxs">{user.name[0]}</AvatarFallback>
              </Avatar>

              <p className="truncate">{user.name}</p>

              {disabledCarIds.has(user.id) && (
                <span className="ml-auto rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                  Disabled
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
