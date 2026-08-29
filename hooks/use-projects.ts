"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createProject,
  deleteProject,
  getActiveProjectId,
  listProjects,
  renameProject,
  setActiveProjectId,
  subscribeActiveProjectId,
  type Project,
} from "@/lib/project-store";
import { toast } from "sonner";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await listProjects();
      if (!result.ok) {
        toast.error(result.error);
        setProjects([]);
        return;
      }
      setProjects(result.data);
    } catch (err) {
      console.error(err);
      toast.error("Projectsの取得に失敗しました");
      setProjects([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (name: string) => {
      const result = await createProject(name);
      if (!result.ok) throw new Error(result.error);
      await refresh();
      return result.data;
    },
    [refresh]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameProject(id, name);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteProject(id);
      await refresh();
    },
    [refresh]
  );

  return { projects, ready, refresh, create, rename, remove };
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
