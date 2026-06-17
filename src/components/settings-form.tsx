"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { ImageUploadButton } from "@/components/image-upload-button";
import { cn, displayName, STATUS_OPTIONS } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState(profile.username);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [status, setStatus] = useState(profile.status ?? "");
  const [birthday, setBirthday] = useState(profile.birthday ?? "");
  const [showBirthday, setShowBirthday] = useState(profile.show_birthday);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(profile.banner_url ?? "");
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
        bio: bio.trim() || null,
        status: status.trim() || null,
        birthday: birthday || null,
        show_birthday: showBirthday,
        avatar_url: avatarUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
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
      {/* Banner + Avatar Vorschau & Upload */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div className="relative h-28 bg-neutral-100 dark:bg-neutral-900">
          {bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
          )}
          <div className="absolute right-2 top-2 flex gap-1">
            <ImageUploadButton
              bucket="profile-images"
              pathPrefix={`${profile.id}/banner`}
              onUploaded={setBannerUrl}
              className="rounded-lg bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur"
            >
              Banner ändern
            </ImageUploadButton>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Avatar
            name={fullName || username || displayName(profile)}
            url={avatarUrl || null}
            size={56}
          />
          <ImageUploadButton
            bucket="profile-images"
            pathPrefix={`${profile.id}/avatar`}
            onUploaded={setAvatarUrl}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Profilbild ändern
          </ImageUploadButton>
        </div>
      </div>

      <Field label="Benutzername" value={username} onChange={setUsername} required />
      <Field
        label="Anzeigename"
        value={fullName}
        onChange={setFullName}
        placeholder="z. B. Yannick Reiter"
      />

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Über mich ({bio.length}/250)
        </span>
        <textarea
          value={bio}
          maxLength={250}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="Kurze Beschreibung …"
          className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:focus:bg-neutral-900"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Status
        </span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:focus:bg-neutral-900"
        >
          <option value="">— Kein Status —</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Geburtstag"
          type="date"
          value={birthday}
          onChange={setBirthday}
        />
        <label className="flex items-end pb-2.5">
          <span className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showBirthday}
              onChange={(e) => setShowBirthday(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Geburtstag öffentlich
          </span>
        </label>
      </div>

      {msg && (
        <p className={msg.ok ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-red-500"}>
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
        className={cn(
          "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-950 dark:focus:bg-neutral-900"
        )}
      />
    </label>
  );
}
