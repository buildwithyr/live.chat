import type { Room, RoomListItem, Profile } from "./types";

/** Klassennamen bedingt zusammenfuegen. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Initialen aus Name/Username ableiten. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Uhrzeit (HH:MM) fuer Zeitstempel. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tages-Trenner ("Heute", "Gestern", Datum). */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Heute";
  if (sameDay(d, yesterday)) return "Gestern";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Anzeigenamen eines Profils. */
export function displayName(p: Profile | null | undefined): string {
  if (!p) return "Unbekannt";
  return p.full_name?.trim() || p.username;
}

/** Rohen Raum aus der DB in ein UI-freundliches Listenelement umwandeln. */
export function toRoomListItem(room: Room, currentUserId: string): RoomListItem {
  if (room.is_group) {
    const others = room.room_members
      .filter((m) => m.user_id !== currentUserId)
      .map((m) => displayName(m.profiles));
    return {
      id: room.id,
      isGroup: true,
      title: room.name?.trim() || "Gruppe",
      subtitle: `${room.room_members.length} Mitglieder`,
      createdAt: room.created_at,
    };
  }
  const other = room.room_members.find((m) => m.user_id !== currentUserId);
  return {
    id: room.id,
    isGroup: false,
    title: displayName(other?.profiles),
    subtitle: other?.profiles?.username ? `@${other.profiles.username}` : "Direktnachricht",
    createdAt: room.created_at,
  };
}
