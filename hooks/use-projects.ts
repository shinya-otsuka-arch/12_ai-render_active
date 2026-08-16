"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createProject,
  deleteProject,
  getActiveProjectId,
  listProjects,
  renameProject,
  setActiveProjectId,
  type Project,
} from "@/lib/project-store";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch (err) {
      console.error(err);
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
      const project = await createProject(name);
      await refresh();
      return project;
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
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveProjectId(id);
    setActiveIdState(id);
  }, []);

  return { activeId, setActiveId, ready };
}
