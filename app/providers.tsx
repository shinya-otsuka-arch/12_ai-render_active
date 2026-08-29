"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthUser, type AuthUser } from "@/lib/auth-actions";
import {
  listProjects,
  createProject,
  renameProject,
  deleteProject,
  type Project,
} from "@/lib/project-store";
import { toast } from "sonner";

// ─── Auth ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  email: string | null;
  userId: string | null;
  isAdmin: boolean;
  ready: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  email: null,
  userId: null,
  isAdmin: false,
  ready: false,
  refresh: async () => {},
  signOut: async () => {},
});

// ─── Projects ────────────────────────────────────────────────────────────────

interface ProjectsContextValue {
  projects: Project[];
  ready: boolean;
  refresh: () => Promise<void>;
  create: (name: string) => Promise<Project>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const ProjectsContext = createContext<ProjectsContextValue>({
  projects: [],
  ready: false,
  refresh: async () => {},
  create: async () => { throw new Error("ProjectsContext not initialized"); },
  rename: async () => {},
  remove: async () => {},
});

// ─── Providers ───────────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  // Auth state
  const [authData, setAuthData] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const result = await getAuthUser();
      setAuthData(result.ok && result.data ? result.data : null);
    } catch {
      setAuthData(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsReady, setProjectsReady] = useState(false);

  const refreshProjects = useCallback(async () => {
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
      setProjectsReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const createProj = useCallback(
    async (name: string) => {
      const result = await createProject(name);
      if (!result.ok) throw new Error(result.error);
      await refreshProjects();
      return result.data;
    },
    [refreshProjects]
  );

  const renameProj = useCallback(
    async (id: string, name: string) => {
      await renameProject(id, name);
      await refreshProjects();
    },
    [refreshProjects]
  );

  const removeProj = useCallback(
    async (id: string) => {
      await deleteProject(id);
      await refreshProjects();
    },
    [refreshProjects]
  );

  return (
    <AuthContext.Provider
      value={{
        email: authData?.email ?? null,
        userId: authData?.id ?? null,
        isAdmin: authData?.isAdmin ?? false,
        ready: authReady,
        refresh: refreshAuth,
        signOut,
      }}
    >
      <ProjectsContext.Provider
        value={{
          projects,
          ready: projectsReady,
          refresh: refreshProjects,
          create: createProj,
          rename: renameProj,
          remove: removeProj,
        }}
      >
        {children}
      </ProjectsContext.Provider>
    </AuthContext.Provider>
  );
}

// ─── convenience hooks ───────────────────────────────────────────────────────

export function useAuthContext() {
  return useContext(AuthContext);
}

export function useProjectsContext() {
  return useContext(ProjectsContext);
}
