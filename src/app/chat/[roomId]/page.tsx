import { redirect, notFound } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ChatRoom } from "@/components/chat-room";
import {
  getCurrentProfile,
  getMessages,
  getRoom,
  getRooms,
} from "@/lib/data";
import { toRoomListItem } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const room = await getRoom(roomId);
  if (!room) notFound(); // RLS: kein Mitglied -> kein Zugriff

  const [rooms, messages] = await Promise.all([
    getRooms(),
    getMessages(roomId),
  ]);

  const items = rooms.map((r) => toRoomListItem(r, profile.id));
  const item = toRoomListItem(room, profile.id);
  const members = room.room_members
    .map((m) => m.profiles)
    .filter((p): p is Profile => p !== null);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Sidebar nur auf Desktop sichtbar */}
      <Sidebar
        profile={profile}
        rooms={items}
        activeRoomId={roomId}
        className="hidden md:flex"
      />
      <ChatRoom
        roomId={roomId}
        currentUserId={profile.id}
        members={members}
        isGroup={room.is_group}
        title={item.title}
        subtitle={item.subtitle}
        initialMessages={messages}
      />
    </div>
  );
}
