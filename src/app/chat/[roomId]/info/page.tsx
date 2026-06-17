import { redirect, notFound } from "next/navigation";
import { GroupInfo } from "@/components/group-info";
import { getCurrentProfile, getPolls, getRoom, myRole } from "@/lib/data";

export default async function GroupInfoPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const room = await getRoom(roomId);
  if (!room || !room.is_group) notFound();

  const role = myRole(room, profile.id);
  if (!role) notFound(); // kein Mitglied

  const polls = await getPolls(roomId);

  return (
    <GroupInfo
      room={room}
      currentUserId={profile.id}
      myRole={role}
      polls={polls}
    />
  );
}
