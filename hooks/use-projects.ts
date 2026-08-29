"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getActiveProjectId,
  setActiveProjectId,
  subscribeActiveProjectId,
} from "@/lib/project-store";
import { useProjectsContext } from "@/app/providers";

export function useProjects() {
  return useProjectsContext();
}

export function useActiveProject() {
  const [activeId, setActiveIdState] = useState<string | null>(() =>
    typeof window !== "undefined" ? getActiveProjectId() : null
  );
  const [ready, setReady] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    return subscribeActiveProjectId(setActiveIdState);
  }, []);

  // setReady は SSR 環境（ready=false）でのハイドレーション後に true にする
  useEffect(() => {
    setReady(true);
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveProjectId(id);
    setActiveIdState(id);
  }, []);

  return { activeId, setActiveId, ready };
}
