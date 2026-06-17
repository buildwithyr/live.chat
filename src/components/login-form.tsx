"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/chat";
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setInfo(
            "Fast geschafft! Bitte bestaetige deine E-Mail-Adresse ueber den Link, den wir dir geschickt haben."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-2xl font-semibold text-white dark:bg-white dark:text-neutral-900">
            ◆
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">live.chat</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {mode === "login"
              ? "Melde dich an, um weiterzuchatten."
              : "Erstelle dein Konto in Sekunden."}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
        >
          {mode === "signup" && (
            <Field
              label="Benutzername"
              type="text"
              value={username}
              onChange={setUsername}
              placeholder="z. B. yannick"
              autoComplete="username"
              required
            />
          )}
          <Field
            label="E-Mail"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="du@beispiel.de"
            autoComplete="email"
            required
          />
          <Field
            label="Passwort"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {loading
              ? "Bitte warten …"
              : mode === "login"
                ? "Anmelden"
                : "Konto erstellen"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-neutral-500">
          {mode === "login" ? "Noch kein Konto?" : "Bereits registriert?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setInfo(null);
            }}
            className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-white"
          >
            {mode === "login" ? "Registrieren" : "Anmelden"}
          </button>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  onChange,
  ...props
}: {
  label: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {label}
      </span>
      <input
        {...props}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none transition",
          "focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-900/5",
          "dark:border-neutral-800 dark:bg-neutral-950 dark:focus:border-neutral-600 dark:focus:bg-neutral-900"
        )}
      />
    </label>
  );
}
