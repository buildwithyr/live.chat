import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";
import { PushToggle } from "@/components/push-toggle";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/chat"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Zurueck"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold">Profil</h1>
      </div>
      <SettingsForm profile={profile} />

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-500">
          Benachrichtigungen
        </h2>
        <PushToggle userId={profile.id} />
      </div>
    </main>
  );
}
