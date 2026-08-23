"use server";

import { createClient } from "@/lib/supabase/server";
import {
  actionFail,
  actionOk,
  errorMessage,
  type ActionResult,
} from "@/lib/action-result";

export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export async function getAuthUser(): Promise<ActionResult<AuthUser | null>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionOk(null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return actionOk({
      id: user.id,
      email: user.email ?? "",
      isAdmin: profile?.role === "admin",
    });
  } catch (err) {
    return actionFail(errorMessage(err, "認証情報の取得に失敗しました"));
  }
}
