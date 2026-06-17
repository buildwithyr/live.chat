export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface RoomMember {
  user_id: string;
  profiles: Profile | null;
}

export interface Room {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
  room_members: RoomMember[];
}

/** Raum mit bereits berechnetem Anzeigenamen fuer die UI. */
export interface RoomListItem {
  id: string;
  isGroup: boolean;
  title: string;
  subtitle: string;
  createdAt: string;
}
