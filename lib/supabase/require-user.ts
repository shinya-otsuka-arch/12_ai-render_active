import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      user: null as null,
      supabase,
      response: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }),
    };
  }
  return { user, supabase, response: null as null };
}
