"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { cn, displayName } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function NewChat({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", currentUserId)
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(8);
      setResults((data ?? []) as Profile[]);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open, currentUserId, supabase]);

  function reset() {
    setQuery("");
    setResults([]);
    setSelected([]);
    setGroupName("");
    setError(null);
  }

  function toggle(p: Profile) {
    setSelected((prev) =>
      prev.find((x) => x.id === p.id)
        ? prev.filter((x) => x.id !== p.id)
        : [...prev, p]
    );
  }

  async function start() {
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      if (selected.length === 1) {
        // 1:1-Chat via RPC (findet bestehenden oder erstellt neuen)
        const { data, error } = await supabase.rpc("start_direct_chat", {
          _other: selected[0].id,
        });
        if (error) throw error;
        navigate(data as string);
      } else {
        // Gruppenchat anlegen
        const { data: room, error: rErr } = await supabase
          .from("rooms")
          .insert({
            is_group: true,
            name: groupName.trim() || "Neue Gruppe",
            created_by: currentUserId,
          })
          .select("id")
          .single();
        if (rErr) throw rErr;

        const members = [currentUserId, ...selected.map((s) => s.id)].map(
          (user_id) => ({ room_id: room.id, user_id })
        );
        const { error: mErr } = await supabase
          .from("room_members")
          .insert(members);
        if (mErr) throw mErr;

        navigate(room.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte Chat nicht starten.");
    } finally {
      setBusy(false);
    }
  }

  function navigate(roomId: string) {
    setOpen(false);
    reset();
    router.push(`/chat/${roomId}`);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        aria-label="Neuer Chat"
        title="Neuer Chat"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md animate-fade-in overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-neutral-100 p-4 dark:border-neutral-800">
              <h2 className="mb-3 text-sm font-semibold">Neuer Chat</h2>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Personen suchen (Name oder @username)"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:focus:bg-neutral-900"
              />

              {selected.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selected.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggle(s)}
                      className="flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-xs text-white dark:bg-white dark:text-neutral-900"
                    >
                      {displayName(s)}
                      <span className="opacity-60">×</span>
                    </button>
                  ))}
                </div>
              )}

              {selected.length > 1 && (
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Gruppenname (optional)"
                  className="mt-3 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:focus:bg-neutral-900"
                />
              )}
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              {results.length === 0 && query.trim() && (
                <p className="px-2 py-6 text-center text-sm text-neutral-400">
                  Niemand gefunden.
                </p>
              )}
              {results.map((p) => {
                const isSel = !!selected.find((x) => x.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition",
                      isSel
                        ? "bg-neutral-100 dark:bg-neutral-800"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    )}
                  >
                    <Avatar name={displayName(p)} url={p.avatar_url} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {displayName(p)}
                      </span>
                      <span className="block truncate text-xs text-neutral-400">
                        @{p.username}
                      </span>
                    </span>
                    {isSel && <span className="text-neutral-900 dark:text-white">✓</span>}
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="px-4 pb-2 text-sm text-red-500">{error}</p>
            )}

            <div className="flex justify-end gap-2 border-t border-neutral-100 p-3 dark:border-neutral-800">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                Abbrechen
              </button>
              <button
                onClick={start}
                disabled={selected.length === 0 || busy}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40 dark:bg-white dark:text-neutral-900"
              >
                {selected.length > 1 ? "Gruppe erstellen" : "Chat starten"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
