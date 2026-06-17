import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { NewChat } from "@/components/new-chat";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { cn, displayName } from "@/lib/utils";
import type { Profile, RoomListItem } from "@/lib/types";

export function Sidebar({
  profile,
  rooms,
  activeRoomId,
  className,
}: {
  profile: Profile;
  rooms: RoomListItem[];
  activeRoomId?: string;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 md:w-80 md:border-r",
        className
      )}
    >
      {/* Kopf */}
      <header className="safe-top flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-3 dark:border-neutral-800">
        <Link
          href="/chat/settings"
          className="flex min-w-0 items-center gap-2.5 rounded-lg p-1 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Avatar
            name={displayName(profile)}
            url={profile.avatar_url}
            size={36}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {displayName(profile)}
            </span>
            <span className="block truncate text-xs text-neutral-400">
              @{profile.username}
            </span>
          </span>
        </Link>
        <div className="flex items-center">
          <NewChat currentUserId={profile.id} />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      {/* Raumliste */}
      <nav className="flex-1 overflow-y-auto p-2">
        {rooms.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-neutral-400">
            Noch keine Chats.
            <br />
            Tippe auf <span className="font-medium">+</span>, um zu starten.
          </div>
        ) : (
          rooms.map((room) => (
            <Link
              key={room.id}
              href={`/chat/${room.id}`}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition",
                room.id === activeRoomId
                  ? "bg-neutral-100 dark:bg-neutral-800"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              )}
            >
              <Avatar name={room.title} isGroup={room.isGroup} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {room.title}
                </span>
                <span className="block truncate text-xs text-neutral-400">
                  {room.subtitle}
                </span>
              </span>
            </Link>
          ))
        )}
      </nav>
    </aside>
  );
}
