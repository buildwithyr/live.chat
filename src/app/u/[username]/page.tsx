import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { getCurrentProfile, getProfileByUsername } from "@/lib/data";
import { displayName, formatDate } from "@/lib/utils";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const me = await getCurrentProfile();
  const isMe = me?.id === profile.id;
  const showBirthday = profile.birthday && (profile.show_birthday || isMe);

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-lg">
      {/* Banner */}
      <div className="relative h-40 bg-neutral-100 dark:bg-neutral-900 sm:rounded-b-2xl">
        {profile.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.banner_url}
            alt="Banner"
            className="h-full w-full object-cover sm:rounded-b-2xl"
          />
        )}
        <Link
          href="/chat"
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
          aria-label="Zurück"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      </div>

      <div className="px-5">
        <div className="-mt-10 flex items-end justify-between">
          <div className="rounded-full border-4 border-neutral-50 dark:border-neutral-950">
            <Avatar name={displayName(profile)} url={profile.avatar_url} size={80} />
          </div>
          {isMe && (
            <Link
              href="/chat/settings"
              className="mb-2 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Bearbeiten
            </Link>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{displayName(profile)}</h1>
            {profile.status && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {profile.status}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-400">@{profile.username}</p>

          {profile.bio && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {profile.bio}
            </p>
          )}

          {showBirthday && profile.birthday && (
            <p className="mt-3 flex items-center gap-2 text-sm text-neutral-500">
              <span>🎂</span> {formatDate(profile.birthday)}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
