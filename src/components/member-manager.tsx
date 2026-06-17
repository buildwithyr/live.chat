"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { ROLE_LABEL, canManageGroup, canModerate, cn, displayName, isOwner } from "@/lib/utils";
import type { Profile, Role, RoomMember } from "@/lib/types";

const ROLE_STYLE: Record<Role, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  moderator: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  member: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

export function MemberManager({
  roomId,
  currentUserId,
  myRole,
  members,
}: {
  roomId: string;
  currentUserId: string;
  myRole: Role;
  members: RoomMember[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function call(fn: string, args: Record<string, unknown>) {
    setError(null);
    const { error } = await supabase.rpc(fn, args);
    if (error) setError(error.message);
    else router.refresh();
  }

  const sorted = [...members].sort(
    (a, b) => rank(b.role) - rank(a.role) || displayName(a.profiles).localeCompare(displayName(b.profiles))
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-500">
          Mitglieder ({members.length})
        </h2>
        {canManageGroup(myRole) && (
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            + Hinzufügen
          </button>
        )}
      </div>

      {adding && (
        <AddMember
          roomId={roomId}
          existing={members.map((m) => m.user_id)}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {sorted.map((m) => {
          const target = m.role;
          const isSelf = m.user_id === currentUserId;
          // Berechtigungen
          const canEditRole =
            (isOwner(myRole) && target !== "owner") ||
            (myRole === "admin" && target !== "owner" && target !== "admin");
          const canRemove =
            !isSelf &&
            ((isOwner(myRole) && target !== "owner") ||
              (myRole === "admin" && target !== "owner" && target !== "admin"));
          const canMute =
            !isSelf && canModerate(myRole) && target !== "owner" && target !== "admin";
          const canTransfer = isOwner(myRole) && !isSelf;

          return (
            <li key={m.user_id} className="flex items-center gap-3 py-2.5">
              <Link href={`/u/${m.profiles?.username ?? ""}`}>
                <Avatar name={displayName(m.profiles)} url={m.profiles?.avatar_url} size={40} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {displayName(m.profiles)} {isSelf && "(du)"}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", ROLE_STYLE[target])}>
                    {ROLE_LABEL[target]}
                  </span>
                  {m.muted && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-600 dark:bg-red-950/50 dark:text-red-400">
                      stumm
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-400">@{m.profiles?.username}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {canEditRole && (
                  <select
                    value={target}
                    onChange={(e) =>
                      call("set_member_role", {
                        _room_id: roomId,
                        _target: m.user_id,
                        _role: e.target.value,
                      })
                    }
                    className="rounded-lg border border-neutral-200 bg-transparent px-1.5 py-1 text-xs dark:border-neutral-700"
                  >
                    {(isOwner(myRole)
                      ? ["admin", "moderator", "member"]
                      : ["moderator", "member"]
                    ).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r as Role]}
                      </option>
                    ))}
                  </select>
                )}
                {canMute && (
                  <button
                    onClick={() =>
                      call("set_member_muted", {
                        _room_id: roomId,
                        _target: m.user_id,
                        _muted: !m.muted,
                      })
                    }
                    title={m.muted ? "Stummschaltung aufheben" : "Stummschalten"}
                    className="rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {m.muted ? "🔈" : "🔇"}
                  </button>
                )}
                {canTransfer && (
                  <button
                    onClick={() => {
                      if (confirm(`Owner an ${displayName(m.profiles)} übertragen?`))
                        call("transfer_owner", { _room_id: roomId, _new: m.user_id });
                    }}
                    title="Owner übertragen"
                    className="rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    👑
                  </button>
                )}
                {canRemove && (
                  <button
                    onClick={() =>
                      call("remove_member", { _room_id: roomId, _target: m.user_id })
                    }
                    title="Entfernen"
                    className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    ✕
                  </button>
                )}
                {!isSelf && !canModerate(myRole) && (
                  <button
                    onClick={() => {
                      const reason = prompt("Grund der Meldung?") ?? "";
                      if (reason)
                        call("report_member", {
                          _room_id: roomId,
                          _target: m.user_id,
                          _reason: reason,
                        });
                    }}
                    title="Melden"
                    className="rounded-lg px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    ⚐
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function rank(r: Role) {
  return { owner: 3, admin: 2, moderator: 1, member: 0 }[r];
}

function AddMember({
  roomId,
  existing,
  onDone,
}: {
  roomId: string;
  existing: string[];
  onDone: () => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim();
      if (!q) return setResults([]);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(6);
      setResults(((data ?? []) as Profile[]).filter((p) => !existing.includes(p.id)));
    }, 200);
    return () => clearTimeout(t);
  }, [query, existing, supabase]);

  async function add(p: Profile) {
    setErr(null);
    const { error } = await supabase.rpc("add_member", { _room_id: roomId, _target: p.id });
    if (error) setErr(error.message);
    else onDone();
  }

  return (
    <div className="mb-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Person suchen …"
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-950"
      />
      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
      <div className="mt-2 space-y-1">
        {results.map((p) => (
          <button
            key={p.id}
            onClick={() => add(p)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          >
            <Avatar name={displayName(p)} url={p.avatar_url} size={28} />
            <span className="text-sm">{displayName(p)}</span>
            <span className="text-xs text-neutral-400">@{p.username}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
