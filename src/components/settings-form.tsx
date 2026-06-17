"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { displayName } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState(profile.username);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      setMsg({
        ok: false,
        text:
          error.code === "23505"
            ? "Dieser Benutzername ist bereits vergeben."
            : error.message,
      });
    } else {
      setMsg({ ok: true, text: "Gespeichert." });
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar
          name={fullName || username || displayName(profile)}
          url={avatarUrl || null}
          size={64}
        />
        <div className="text-sm text-neutral-500">
          Vorschau deines Avatars.
          <br />
          Optional per Bild-URL.
        </div>
      </div>

      <Field label="Benutzername" value={username} onChange={setUsername} required />
      <Field
        label="Anzeigename"
        value={fullName}
        onChange={setFullName}
        placeholder="z. B. Yannick Reiter"
      />
      <Field
        label="Avatar-URL"
        value={avatarUrl}
        onChange={setAvatarUrl}
        placeholder="https://…"
      />

      {msg && (
        <p
          className={
            msg.ok
              ? "text-sm text-emerald-600 dark:text-emerald-400"
              : "text-sm text-red-500"
          }
        >
          {msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {saving ? "Speichern …" : "Speichern"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {label}
      </span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:focus:bg-neutral-900"
      />
    </label>
  );
}
