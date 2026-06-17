import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { getCurrentProfile, getRooms } from "@/lib/data";
import { toRoomListItem } from "@/lib/utils";

export default async function ChatIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const rooms = await getRooms();
  const items = rooms.map((r) => toRoomListItem(r, profile.id));

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Mobil: Liste fuellt den Screen. Desktop: Sidebar + Leerzustand. */}
      <Sidebar profile={profile} rooms={items} className="flex" />
      <section className="hidden flex-1 items-center justify-center bg-neutral-50 dark:bg-neutral-950 md:flex">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-3xl dark:bg-neutral-900">
            💬
          </div>
          <h2 className="text-lg font-semibold">Willkommen bei live.chat</h2>
          <p className="mt-1 max-w-xs text-sm text-neutral-400">
            Waehle links einen Chat aus oder starte einen neuen Gespraech.
          </p>
        </div>
      </section>
    </div>
  );
}
