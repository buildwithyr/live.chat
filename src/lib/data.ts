import { createClient } from "@/lib/supabase/server";
import type { Message, Poll, Profile, Role, Room } from "./types";

const PROFILE_COLS =
  "id, username, full_name, avatar_url, bio, status, banner_url, birthday, show_birthday, updated_at";

const ROOM_SELECT = `id, name, is_group, description, category, avatar_url, banner_url, invite_code, invite_active, created_by, created_at, room_members(user_id, role, muted, last_read_at, profiles(${PROFILE_COLS}))`;

/** Aktuell angemeldetes Profil laden (oder null). */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

/** Profil per Benutzername laden (fuer die oeffentliche Profilseite). */
export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("username", username)
    .maybeSingle();

  return data as Profile | null;
}

/** Alle Raeume des aktuellen Users (RLS filtert automatisch auf Mitgliedschaft). */
export async function getRooms(): Promise<Room[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(ROOM_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getRooms:", error.message);
    return [];
  }
  return (data ?? []) as unknown as Room[];
}

/** Einen einzelnen Raum laden (oder null, falls kein Zugriff). */
export async function getRoom(roomId: string): Promise<Room | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select(ROOM_SELECT)
    .eq("id", roomId)
    .maybeSingle();

  return (data as unknown as Room) ?? null;
}

/** Rolle des aktuellen Users in einem Raum. */
export function myRole(room: Room, userId: string): Role | null {
  return room.room_members.find((m) => m.user_id === userId)?.role ?? null;
}

/** Letzte Nachrichten eines Raums (chronologisch aufsteigend). */
export async function getMessages(roomId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, room_id, sender_id, content, image_url, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);

  return (data ?? []) as Message[];
}

/** Umfragen eines Raums inkl. Optionen und Stimmen. */
export async function getPolls(roomId: string): Promise<Poll[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("polls")
    .select(
      "id, room_id, question, multiple, closed, created_by, created_at, poll_options(id, poll_id, text, position), poll_votes(poll_id, option_id, user_id)"
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as Poll[];
}
