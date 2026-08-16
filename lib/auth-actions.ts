"use server";

import { createClient } from "@/lib/supabase/server";

export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    isAdmin: profile?.role === "admin",
  };
}
