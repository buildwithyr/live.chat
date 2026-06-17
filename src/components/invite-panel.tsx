"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";

export function InvitePanel({
  roomId,
  inviteCode,
  inviteActive,
  canManage,
}: {
  roomId: string;
  inviteCode: string | null;
  inviteActive: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link =
    inviteCode && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${inviteCode}`
      : null;
  const active = !!inviteCode && inviteActive;

  useEffect(() => {
    if (link && active) {
      QRCode.toDataURL(link, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(null));
    } else {
      setQr(null);
    }
  }, [link, active]);

  async function call(fn: string, args: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc(fn, args);
    if (error) setError(error.message);
    else router.refresh();
    setBusy(false);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = "einladung-qr.png";
    a.click();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="mb-3 text-sm font-semibold text-neutral-500">Einladungslink</h2>

      {active && link ? (
        <>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              onClick={copy}
              className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              {copied ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>

          {qr && (
            <div className="mt-4 flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR-Code" className="h-44 w-44 rounded-xl" />
              <button
                onClick={download}
                className="text-xs font-medium text-neutral-500 underline-offset-2 hover:underline"
              >
                QR-Code herunterladen
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-neutral-400">
          {inviteCode ? "Der Einladungslink ist deaktiviert." : "Noch kein Einladungslink erstellt."}
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => call("generate_invite_code", { _room_id: roomId })}
            disabled={busy}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {inviteCode ? "Neu generieren" : "Link erzeugen"}
          </button>
          {inviteCode && (
            <button
              onClick={() => call("set_invite_active", { _room_id: roomId, _active: !inviteActive })}
              disabled={busy}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {inviteActive ? "Deaktivieren" : "Aktivieren"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
