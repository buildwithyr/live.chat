import type { Profile, Role, Room, RoomListItem } from "./types";

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

/** Datum (z. B. Geburtstag, Erstellungsdatum). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
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
    return {
      id: room.id,
      isGroup: true,
      title: room.name?.trim() || "Gruppe",
      subtitle: `${room.room_members.length} Mitglieder`,
      avatarUrl: room.avatar_url,
      createdAt: room.created_at,
    };
  }
  const other = room.room_members.find((m) => m.user_id !== currentUserId);
  return {
    id: room.id,
    isGroup: false,
    title: displayName(other?.profiles),
    subtitle: other?.profiles?.username ? `@${other.profiles.username}` : "Direktnachricht",
    avatarUrl: other?.profiles?.avatar_url ?? null,
    createdAt: room.created_at,
  };
}

// ---- Rollen & Berechtigungen --------------------------------------

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  member: "Mitglied",
};

const ROLE_RANK: Record<Role, number> = {
  owner: 3,
  admin: 2,
  moderator: 1,
  member: 0,
};

export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Darf Gruppenbild/-beschreibung/-mitglieder verwalten (Admin+). */
export const canManageGroup = (role: Role | null) => roleAtLeast(role, "admin");
/** Darf moderieren (Nachrichten loeschen, stummschalten) (Moderator+). */
export const canModerate = (role: Role | null) => roleAtLeast(role, "moderator");
/** Darf Gruppe loeschen / Owner uebertragen (Owner). */
export const isOwner = (role: Role | null) => role === "owner";

/** Vorgaben fuer den Status. */
export const STATUS_OPTIONS = [
  "Verfügbar",
  "Arbeiten",
  "Im Urlaub",
  "Zuhause",
  "Im Fitnessstudio",
  "Nicht stören",
] as const;
