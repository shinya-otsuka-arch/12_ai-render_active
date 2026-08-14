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

  const refresh = useCallback(() => {
    setProjects(listProjects());
  }, []);

  useEffect(() => {
    refresh();
    setReady(true);
  }, [refresh]);

  const create = useCallback(
    (name: string) => {
      const project = createProject(name);
      refresh();
      return project;
    },
    [refresh]
  );

  const rename = useCallback(
    (id: string, name: string) => {
      renameProject(id, name);
      refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteProject(id);
      refresh();
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
