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
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setActiveIdState(getActiveProjectId());
    setReady(true);
    return subscribeActiveProjectId(setActiveIdState);
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveProjectId(id);
    setActiveIdState(id);
  }, []);

  return { activeId, setActiveId, ready };
}
