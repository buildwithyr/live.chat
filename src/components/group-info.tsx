"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { ImageUploadButton } from "@/components/image-upload-button";
import { MemberManager } from "@/components/member-manager";
import { InvitePanel } from "@/components/invite-panel";
import { Polls } from "@/components/polls";
import { canManageGroup, formatDate, isOwner } from "@/lib/utils";
import type { Poll, Role, Room } from "@/lib/types";

export function GroupInfo({
  room,
  currentUserId,
  myRole,
  polls,
}: {
  room: Room;
  currentUserId: string;
  myRole: Role;
  polls: Poll[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const canEdit = canManageGroup(myRole);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(room.name ?? "");
  const [description, setDescription] = useState(room.description ?? "");
  const [category, setCategory] = useState(room.category ?? "");
  const [error, setError] = useState<string | null>(null);

  async function patchRoom(patch: Record<string, unknown>) {
    setError(null);
    const { error } = await supabase.from("rooms").update(patch).eq("id", room.id);
    if (error) setError(error.message);
    else router.refresh();
  }

  async function saveText() {
    await patchRoom({
      name: name.trim() || "Gruppe",
      description: description.trim() || null,
      category: category.trim() || null,
    });
    setEditing(false);
  }

  async function leave() {
    if (!confirm("Gruppe wirklich verlassen?")) return;
    const { error } = await supabase.rpc("remove_member", {
      _room_id: room.id,
      _target: currentUserId,
    });
    if (error) setError(error.message);
    else {
      router.push("/chat");
      router.refresh();
    }
  }

  async function destroy() {
    if (!confirm("Gruppe unwiderruflich löschen?")) return;
    const { error } = await supabase.rpc("delete_group", { _room_id: room.id });
    if (error) setError(error.message);
    else {
      router.push("/chat");
      router.refresh();
    }
  }

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-lg pb-12">
      {/* Banner */}
      <div className="relative h-40 bg-neutral-100 dark:bg-neutral-900 sm:rounded-b-2xl">
        {room.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={room.banner_url} alt="Banner" className="h-full w-full object-cover sm:rounded-b-2xl" />
        )}
        <Link
          href={`/chat/${room.id}`}
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
          aria-label="Zurück"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        {canEdit && (
          <ImageUploadButton
            bucket="group-images"
            pathPrefix={`${room.id}/banner`}
            onUploaded={(url) => patchRoom({ banner_url: url })}
            className="absolute right-3 top-3 rounded-lg bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur"
          >
            Banner ändern
          </ImageUploadButton>
        )}
      </div>

      <div className="px-5">
        <div className="-mt-10 flex items-end gap-3">
          <div className="relative rounded-full border-4 border-neutral-50 dark:border-neutral-950">
            <Avatar name={room.name || "Gruppe"} url={room.avatar_url} isGroup size={80} />
            {canEdit && (
              <ImageUploadButton
                bucket="group-images"
                pathPrefix={`${room.id}/avatar`}
                onUploaded={(url) => patchRoom({ avatar_url: url })}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs text-white dark:bg-white dark:text-neutral-900"
              >
                ✎
              </ImageUploadButton>
            )}
          </div>
        </div>

        {/* Name / Beschreibung */}
        {editing ? (
          <div className="mt-3 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gruppenname"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Kategorie (optional)"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung"
              rows={3}
              className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <div className="flex gap-2">
              <button onClick={saveText} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
                Speichern
              </button>
              <button onClick={() => setEditing(false)} className="rounded-lg px-4 py-2 text-sm text-neutral-500">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-semibold">{room.name || "Gruppe"}</h1>
              {canEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Bearbeiten
                </button>
              )}
            </div>
            {room.category && (
              <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {room.category}
              </span>
            )}
            {room.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                {room.description}
              </p>
            )}
            <p className="mt-2 text-xs text-neutral-400">
              Erstellt am {formatDate(room.created_at)}
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {/* Abschnitte */}
        <div className="mt-8 space-y-8">
          <MemberManager
            roomId={room.id}
            currentUserId={currentUserId}
            myRole={myRole}
            members={room.room_members}
          />

          {canEdit && (
            <InvitePanel
              roomId={room.id}
              inviteCode={room.invite_code}
              inviteActive={room.invite_active}
              canManage={canEdit}
            />
          )}

          <Polls
            roomId={room.id}
            currentUserId={currentUserId}
            myRole={myRole}
            initialPolls={polls}
          />

          {/* Gefahrenzone */}
          <div className="space-y-2 border-t border-neutral-100 pt-6 dark:border-neutral-800">
            {!isOwner(myRole) && (
              <button
                onClick={leave}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Gruppe verlassen
              </button>
            )}
            {isOwner(myRole) && (
              <button
                onClick={destroy}
                className="w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Gruppe löschen
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
