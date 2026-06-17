import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Diese Seite oder dieser Chat existiert nicht – oder du hast keinen Zugriff.
      </p>
      <Link
        href="/chat"
        className="mt-6 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Zurueck zu den Chats
      </Link>
    </main>
  );
}
