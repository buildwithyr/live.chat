"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { cn, displayName, formatDay, formatTime } from "@/lib/utils";
import type { MemberRead, Message, Profile } from "@/lib/types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function ChatRoom({
  roomId,
  currentUserId,
  members,
  isGroup,
  title,
  subtitle,
  initialMessages,
  initialReads,
  canModerate = false,
  avatarUrl = null,
}: {
  roomId: string;
  currentUserId: string;
  members: Profile[];
  isGroup: boolean;
  title: string;
  subtitle: string;
  initialMessages: Message[];
  initialReads: MemberRead[];
  canModerate?: boolean;
  avatarUrl?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Lesestaende: userId -> last_read_at (ISO)
  const [reads, setReads] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(initialReads.map((r) => [r.userId, r.lastReadAt]))
  );
  // Wer tippt gerade? userId -> { name, ts }
  const [typing, setTyping] = useState<Record<string, { name: string; ts: number }>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);

  const profileById = useMemo(() => {
    const map = new Map<string, Profile>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const myName = displayName(profileById.get(currentUserId));
  // Im Direktchat: Profil des Gegenübers (fuer Verlinkung auf /u/<username>).
  const otherProfile = !isGroup
    ? members.find((m) => m.id !== currentUserId) ?? null
    : null;

  // Raum als gelesen markieren (debounced via Aufruf).
  const markRead = useCallback(async () => {
    await supabase.rpc("mark_room_read", { _room_id: roomId });
  }, [supabase, roomId]);

  // ---- Realtime: Nachrichten, Lesestaende, Tippanzeige ----
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const old = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string | null };
          setReads((prev) => ({ ...prev, [row.user_id]: row.last_read_at }));
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { userId: string; name: string };
        if (p.userId === currentUserId) return;
        setTyping((prev) => ({ ...prev, [p.userId]: { name: p.name, ts: Date.now() } }));
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, supabase, currentUserId]);

  // Tippanzeigen nach 3s automatisch entfernen.
  useEffect(() => {
    const id = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const next: typeof prev = {};
        for (const [uid, v] of Object.entries(prev)) {
          if (now - v.ts < 3000) next[uid] = v;
        }
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Beim Oeffnen + bei neuen Nachrichten als gelesen markieren.
  useEffect(() => {
    markRead();
  }, [markRead, messages.length]);

  // Bei Fenster-Fokus erneut als gelesen markieren.
  useEffect(() => {
    const onFocus = () => markRead();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [markRead]);

  // Immer nach unten scrollen.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function broadcastTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, name: myName },
    });
  }

  // Push-Benachrichtigung an die anderen Mitglieder ausloesen (fire-and-forget).
  function notify(content: string | null) {
    supabase.functions
      .invoke("notify-message", { body: { room_id: roomId, content } })
      .catch(() => {
        /* Push ist optional – Fehler hier nicht stoerend. */
      });
  }

  async function deleteMessage(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id)); // optimistisch
    await supabase.from("messages").delete().eq("id", id);
  }

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const { error } = await supabase
      .from("messages")
      .insert({ room_id: roomId, sender_id: currentUserId, content });

    if (error) {
      setText(content); // bei Fehler Eingabe wiederherstellen
    } else {
      notify(content);
    }
    setSending(false);
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // gleiches Bild erneut waehlbar
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith("image/")) {
      setUploadError("Bitte eine Bilddatei waehlen.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("Bild ist zu gross (max. 5 MB).");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from("chat-images").getPublicUrl(path);

      const caption = text.trim();
      const { error: msgErr } = await supabase.from("messages").insert({
        room_id: roomId,
        sender_id: currentUserId,
        content: caption || null,
        image_url: publicUrl,
      });
      if (msgErr) throw msgErr;
      setText("");
      notify(caption || null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ---- Lesebestaetigung fuer die letzte eigene Nachricht ----
  const readStatus = useMemo(() => {
    const lastOwn = [...messages].reverse().find((m) => m.sender_id === currentUserId);
    if (!lastOwn) return null;
    const others = members.filter((m) => m.id !== currentUserId);
    const seenBy = others.filter((o) => {
      const at = reads[o.id];
      return at && new Date(at) >= new Date(lastOwn.created_at);
    });
    return { messageId: lastOwn.id, seen: seenBy.length, total: others.length };
  }, [messages, members, reads, currentUserId]);

  const typingNames = Object.values(typing).map((t) => t.name);

  return (
    <div className="flex h-[100dvh] flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Kopfzeile */}
      <header className="safe-top flex items-center gap-3 border-b border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
        <Link
          href="/chat"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800 md:hidden"
          aria-label="Zurueck"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        {isGroup ? (
          <Link
            href={`/chat/${roomId}/info`}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Avatar name={title} url={avatarUrl} isGroup size={38} />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{title}</h1>
              <p className="truncate text-xs text-neutral-400">
                {typingNames.length > 0
                  ? typingNames.length === 1
                    ? `${typingNames[0]} schreibt …`
                    : "Mehrere schreiben …"
                  : subtitle}
              </p>
            </div>
          </Link>
        ) : otherProfile ? (
          <Link
            href={`/u/${otherProfile.username}`}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Avatar name={title} url={avatarUrl} size={38} />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{title}</h1>
              <p className="truncate text-xs text-neutral-400">
                {typingNames.length > 0
                  ? typingNames.length === 1
                    ? `${typingNames[0]} schreibt …`
                    : "Mehrere schreiben …"
                  : subtitle}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={title} url={avatarUrl} size={38} />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{title}</h1>
              <p className="truncate text-xs text-neutral-400">
                {typingNames.length > 0
                  ? typingNames.length === 1
                    ? `${typingNames[0]} schreibt …`
                    : "Mehrere schreiben …"
                  : subtitle}
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Nachrichtenverlauf */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-1">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-neutral-400">
              Noch keine Nachrichten. Sag Hallo! 👋
            </p>
          )}
          {messages.map((msg, i) => {
            const mine = msg.sender_id === currentUserId;
            const prev = messages[i - 1];
            const showDay =
              !prev ||
              new Date(prev.created_at).toDateString() !==
                new Date(msg.created_at).toDateString();
            const sender = profileById.get(msg.sender_id);
            const showSender =
              isGroup && !mine && (!prev || prev.sender_id !== msg.sender_id || showDay);

            return (
              <div key={msg.id}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-neutral-200/70 px-3 py-1 text-xs text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400">
                      {formatDay(msg.created_at)}
                    </span>
                  </div>
                )}
                <div className={cn("group flex w-full items-center gap-1.5", mine ? "justify-end" : "justify-start")}>
                  {(mine || canModerate) && (
                    <button
                      onClick={() => {
                        if (confirm("Nachricht löschen?")) deleteMessage(msg.id);
                      }}
                      title="Nachricht löschen"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-400 opacity-0 transition hover:bg-neutral-200 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-neutral-800"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                  <div className={cn("max-w-[80%] sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                    {showSender && (
                      <Link
                        href={`/u/${sender?.username ?? ""}`}
                        className="mb-0.5 ml-1 block text-xs font-medium text-neutral-400 hover:underline"
                      >
                        {displayName(sender)}
                      </Link>
                    )}
                    <div
                      className={cn(
                        "overflow-hidden text-sm leading-relaxed",
                        msg.image_url ? "rounded-2xl" : "rounded-2xl px-3.5 py-2",
                        mine
                          ? "rounded-br-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "rounded-bl-md bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                      )}
                    >
                      {msg.image_url && (
                        <a href={msg.image_url} target="_blank" rel="noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.image_url}
                            alt="Bild"
                            className="max-h-72 w-full object-cover"
                          />
                        </a>
                      )}
                      <div className={cn(msg.image_url && "px-3.5 py-2")}>
                        {msg.content && (
                          <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                        )}
                        <span
                          className={cn(
                            "ml-2 inline-block translate-y-0.5 text-[10px]",
                            mine
                              ? "text-white/60 dark:text-neutral-900/50"
                              : "text-neutral-400"
                          )}
                        >
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                    {/* Lesebestaetigung unter der letzten eigenen Nachricht */}
                    {mine && readStatus?.messageId === msg.id && (
                      <span className="mr-1 mt-0.5 block text-right text-[10px] text-neutral-400">
                        {readStatus.seen > 0
                          ? isGroup
                            ? `Gelesen · ${readStatus.seen}/${readStatus.total}`
                            : "Gelesen ✓✓"
                          : "Gesendet ✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Tippanzeige-Blase */}
          {typingNames.length > 0 && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 shadow-sm dark:bg-neutral-800">
                <Dot /> <Dot delay={150} /> <Dot delay={300} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Eingabe */}
      <div className="safe-bottom border-t border-neutral-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        {uploadError && (
          <p className="mx-auto mb-2 max-w-2xl text-xs text-red-500">{uploadError}</p>
        )}
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickImage}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Bild senden"
            title="Bild senden"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            {uploading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            )}
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              broadcastTyping();
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Nachricht schreiben …"
            className="max-h-36 flex-1 resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:focus:bg-neutral-900"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            aria-label="Senden"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition active:scale-95 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-neutral-400"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
