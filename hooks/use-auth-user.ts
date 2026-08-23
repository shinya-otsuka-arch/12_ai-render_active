"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthUser } from "@/lib/auth-actions";

export function useAuthUser() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await getAuthUser();
      if (!result.ok || !result.data) {
        setEmail(null);
        setUserId(null);
        setIsAdmin(false);
      } else {
        setEmail(result.data.email);
        setUserId(result.data.id);
        setIsAdmin(result.data.isAdmin);
      }
    } catch {
      setEmail(null);
      setUserId(null);
      setIsAdmin(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  return { email, userId, isAdmin, ready, refresh, signOut };
}
