import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Nicht angemeldet -> nach Login zurueck zur Einladung
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${code}`)}`);
  }

  const { data: roomId, error } = await supabase.rpc("join_via_invite", { _code: code });

  if (error || !roomId) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-3 text-3xl">🔗</div>
        <h1 className="text-lg font-semibold">Einladung ungültig</h1>
        <p className="mt-1 max-w-xs text-sm text-neutral-500">
          Dieser Einladungslink ist abgelaufen oder wurde deaktiviert.
        </p>
        <Link
          href="/chat"
          className="mt-6 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Zu den Chats
        </Link>
      </main>
    );
  }

  redirect(`/chat/${roomId}`);
}
