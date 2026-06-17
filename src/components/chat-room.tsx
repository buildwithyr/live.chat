"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import {
  cn,
  displayName,
  formatDay,
  formatTime,
} from "@/lib/utils";
import type { Message, Profile } from "@/lib/types";

export function ChatRoom({
  roomId,
  currentUserId,
  members,
  isGroup,
  title,
  subtitle,
  initialMessages,
}: {
  roomId: string;
  currentUserId: string;
  members: Profile[];
  isGroup: boolean;
  title: string;
  subtitle: string;
  initialMessages: Message[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const profileById = useMemo(() => {
    const map = new Map<string, Profile>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  // Realtime: auf neue Nachrichten im Raum hoeren.
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  // Immer nach unten scrollen, wenn neue Nachrichten ankommen.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const { error } = await supabase.from("messages").insert({
      room_id: roomId,
      sender_id: currentUserId,
      content,
    });

    if (error) {
      setText(content); // bei Fehler Eingabe wiederherstellen
    }
    setSending(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

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
        <Avatar name={title} isGroup={isGroup} size={38} />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          <p className="truncate text-xs text-neutral-400">{subtitle}</p>
        </div>
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
              isGroup &&
              !mine &&
              (!prev || prev.sender_id !== msg.sender_id || showDay);

            return (
              <div key={msg.id}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-neutral-200/70 px-3 py-1 text-xs text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400">
                      {formatDay(msg.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex w-full",
                    mine ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] sm:max-w-[70%]",
                      mine ? "items-end" : "items-start"
                    )}
                  >
                    {showSender && (
                      <span className="mb-0.5 ml-1 block text-xs font-medium text-neutral-400">
                        {displayName(sender)}
                      </span>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        mine
                          ? "rounded-br-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "rounded-bl-md bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                      )}
                    >
                      <span className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </span>
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
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Eingabe */}
      <div className="safe-bottom border-t border-neutral-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
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
