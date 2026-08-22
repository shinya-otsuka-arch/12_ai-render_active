import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore if middleware already refreshed session
          }
        },
      },
    }
  );

  // skipAutoInitialize: true (set by @supabase/ssr) defers session loading.
  // getSession() fires INITIAL_SESSION which sets changedAccessToken used by
  // all REST/DB requests — without this, Server Action DB queries fall back
  // to the anon key and RLS rejects them.
  await supabase.auth.getSession();

  return supabase;
}

/**
 * サービスロールクライアント。
 * RLS をバイパスするため Server Action / API Route の信頼できるコードでのみ使用する。
 * auth.getUser() で身元確認を先に行うこと。
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
