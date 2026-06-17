export type Role = "owner" | "admin" | "moderator" | "member";

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: string | null;
  banner_url: string | null;
  birthday: string | null;
  show_birthday: boolean;
  updated_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
}

export interface RoomMember {
  user_id: string;
  role: Role;
  muted: boolean;
  last_read_at: string | null;
  profiles: Profile | null;
}

/** Lesestand eines Mitglieds (fuer Lesebestaetigungen). */
export interface MemberRead {
  userId: string;
  lastReadAt: string | null;
}

export interface Room {
  id: string;
  name: string | null;
  is_group: boolean;
  description: string | null;
  category: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  invite_code: string | null;
  invite_active: boolean;
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
  avatarUrl: string | null;
  createdAt: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  position: number;
}

export interface PollVote {
  poll_id: string;
  option_id: string;
  user_id: string;
}

export interface Poll {
  id: string;
  room_id: string;
  question: string;
  multiple: boolean;
  closed: boolean;
  created_by: string | null;
  created_at: string;
  poll_options: PollOption[];
  poll_votes: PollVote[];
}
