"use client";

import { useAuthContext } from "@/app/providers";

export function useAuthUser() {
  return useAuthContext();
}
