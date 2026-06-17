import { createClient } from "@/lib/supabase/server";
import type { Message, Profile, Room } from "./types";

/** Aktuell angemeldetes Profil laden (oder null). */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

/** Alle Raeume des aktuellen Users (RLS filtert automatisch auf Mitgliedschaft). */
export async function getRooms(): Promise<Room[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id, name, is_group, created_by, created_at, room_members(user_id, last_read_at, profiles(id, username, full_name, avatar_url, updated_at))"
    )
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
    .select(
      "id, name, is_group, created_by, created_at, room_members(user_id, last_read_at, profiles(id, username, full_name, avatar_url, updated_at))"
    )
    .eq("id", roomId)
    .maybeSingle();

  return (data as unknown as Room) ?? null;
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
