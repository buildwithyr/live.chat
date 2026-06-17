"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn, canModerate } from "@/lib/utils";
import type { Poll, Role } from "@/lib/types";

const POLL_SELECT =
  "id, room_id, question, multiple, closed, created_by, created_at, poll_options(id, poll_id, text, position), poll_votes(poll_id, option_id, user_id)";

export function Polls({
  roomId,
  currentUserId,
  myRole,
  initialPolls,
}: {
  roomId: string;
  currentUserId: string;
  myRole: Role;
  initialPolls: Poll[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [polls, setPolls] = useState<Poll[]>(initialPolls);
  const [creating, setCreating] = useState(false);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("polls")
      .select(POLL_SELECT)
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    if (data) setPolls(data as unknown as Poll[]);
  }, [supabase, roomId]);

  useEffect(() => {
    const channel = supabase
      .channel(`polls:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "polls", filter: `room_id=eq.${roomId}` }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, refetch]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-500">Umfragen</h2>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {creating ? "Abbrechen" : "+ Umfrage"}
        </button>
      </div>

      {creating && (
        <CreatePoll
          roomId={roomId}
          onDone={() => {
            setCreating(false);
            refetch();
          }}
        />
      )}

      {polls.length === 0 && !creating && (
        <p className="py-6 text-center text-sm text-neutral-400">Noch keine Umfragen.</p>
      )}

      <div className="space-y-4">
        {polls.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            currentUserId={currentUserId}
            canClose={poll.created_by === currentUserId || canModerate(myRole)}
            onChanged={refetch}
          />
        ))}
      </div>
    </div>
  );
}

function PollCard({
  poll,
  currentUserId,
  canClose,
  onChanged,
}: {
  poll: Poll;
  currentUserId: string;
  canClose: boolean;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const myVotes = poll.poll_votes.filter((v) => v.user_id === currentUserId).map((v) => v.option_id);
  const voters = new Set(poll.poll_votes.map((v) => v.user_id)).size;

  async function vote(optionId: string) {
    if (poll.closed) return;
    let next: string[];
    if (poll.multiple) {
      next = myVotes.includes(optionId)
        ? myVotes.filter((id) => id !== optionId)
        : [...myVotes, optionId];
    } else {
      next = myVotes.includes(optionId) ? [] : [optionId];
    }
    await supabase.rpc("cast_vote", { _poll_id: poll.id, _option_ids: next });
    onChanged();
  }

  async function close() {
    await supabase.rpc("close_poll", { _poll_id: poll.id });
    onChanged();
  }

  const options = [...poll.poll_options].sort((a, b) => a.position - b.position);

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{poll.question}</p>
          <p className="text-xs text-neutral-400">
            {poll.multiple ? "Mehrfachauswahl" : "Eine Stimme"} · {voters} {voters === 1 ? "Stimme" : "Stimmen"}
            {poll.closed && " · geschlossen"}
          </p>
        </div>
        {canClose && !poll.closed && (
          <button
            onClick={close}
            className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Schließen
          </button>
        )}
      </div>

      <div className="space-y-2">
        {options.map((opt) => {
          const count = poll.poll_votes.filter((v) => v.option_id === opt.id).length;
          const pct = voters ? Math.round((count / voters) * 100) : 0;
          const mine = myVotes.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => vote(opt.id)}
              disabled={poll.closed}
              className={cn(
                "relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-default",
                mine
                  ? "border-neutral-900 dark:border-white"
                  : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700"
              )}
            >
              <span
                className="absolute inset-y-0 left-0 bg-neutral-100 transition-all dark:bg-neutral-800"
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border text-[10px]", mine ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900" : "border-neutral-300")}>
                    {mine && "✓"}
                  </span>
                  {opt.text}
                </span>
                <span className="text-xs text-neutral-500">
                  {pct}% · {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CreatePoll({ roomId, onDone }: { roomId: string; onDone: () => void }) {
  const supabase = createClient();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) {
      setError("Frage und mindestens 2 Optionen erforderlich.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("create_poll", {
      _room_id: roomId,
      _question: question.trim(),
      _multiple: multiple,
      _options: opts,
    });
    if (error) setError(error.message);
    else onDone();
    setBusy(false);
  }

  return (
    <div className="mb-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Frage … (z. B. Wo essen?)"
        className="mb-2 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-950"
      />
      <div className="space-y-2">
        {options.map((opt, i) => (
          <input
            key={i}
            value={opt}
            onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
            placeholder={`Option ${i + 1}`}
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-950"
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={() => setOptions([...options, ""])}
          className="text-xs font-medium text-neutral-500 hover:underline"
        >
          + Option
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
          Mehrfachauswahl
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {busy ? "Erstellen …" : "Umfrage erstellen"}
      </button>
    </div>
  );
}
