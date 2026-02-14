import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function isReadonlyCookiesError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Cookies can only be modified")
  );
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // During Server Component rendering, cookies are read-only.
            // Proxy middleware handles auth cookie refresh writes.
            if (!isReadonlyCookiesError(error)) {
              throw error;
            }
          }
        }
      }
    }
  );
}
