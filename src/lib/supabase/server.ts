import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase-Client fuer Server Components, Route Handlers und Server Actions. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // In Server Components kann set() fehlschlagen – die Middleware
            // aktualisiert die Session, daher ist das hier unkritisch.
          }
        },
      },
    }
  );
}
