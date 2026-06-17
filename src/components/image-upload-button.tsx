"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Wiederverwendbarer Upload-Button. Laedt ein Bild in den angegebenen
 * Storage-Bucket (Pfad: `<pathPrefix>-<uuid>.<ext>`) und gibt die oeffentliche
 * URL via onUploaded zurueck.
 */
export function ImageUploadButton({
  bucket,
  pathPrefix,
  onUploaded,
  children,
  className,
}: {
  bucket: string;
  pathPrefix: string;
  onUploaded: (url: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Bitte eine Bilddatei wählen.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Bild ist zu groß (max. 5 MB).");
      return;
    }

    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${pathPrefix}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);
      onUploaded(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={className}
      >
        {busy ? "…" : children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pick}
      />
      {error && <span className="ml-2 text-xs text-red-500">{error}</span>}
    </>
  );
}
