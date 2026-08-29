import { toResizedJpegDataUrl } from "@/lib/storage-image";
import {
  listProjects,
  createProject,
  createProjectWithLocalId,
  ensurePersonalHistoryProject,
  renameProject,
  touchProject,
  deleteProject,
  getProject,
  addAssetToProject as addAssetAction,
  listAssets,
  countAssets,
  deleteAsset,
  listProjectMembers,
  addProjectMemberByEmail,
  removeProjectMember,
  listOrgProfiles,
  PERSONAL_HISTORY_LOCAL_ID,
} from "@/lib/project-actions";
import type {
  ProjectMode,
  Project,
  ProjectAsset,
  ProjectMember,
} from "@/lib/project-actions";

export type { ProjectMode, Project, ProjectAsset, ProjectMember };
export {
  listProjects,
  createProject,
  createProjectWithLocalId,
  ensurePersonalHistoryProject,
  renameProject,
  touchProject,
  deleteProject,
  getProject,
  listAssets,
  countAssets,
  deleteAsset,
  listProjectMembers,
  addProjectMemberByEmail,
  removeProjectMember,
  listOrgProfiles,
  PERSONAL_HISTORY_LOCAL_ID,
};

const ACTIVE_KEY = "archirender-active-project";
const ACTIVE_EVENT = "archirender-active-project";
const STORE_MAX_EDGE = 1280;

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProjectId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_EVENT, { detail: id })
    );
  }
}

export function subscribeActiveProjectId(
  listener: (id: string | null) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (e: Event) => {
    listener((e as CustomEvent<string | null>).detail ?? null);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACTIVE_KEY) listener(e.newValue);
  };
  window.addEventListener(ACTIVE_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ACTIVE_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * 履歴の保存・表示先 Project を決める。
 * 作業中 Project があればそれ、なければ個人履歴（なければ作成）。
 */
export async function resolveHistoryProject(): Promise<{
  project: Project;
  isPersonal: boolean;
}> {
  const activeId = getActiveProjectId();
  if (activeId) {
    const project = await getProject(activeId);
    if (project) return { project, isPersonal: false };
  }
  const result = await ensurePersonalHistoryProject();
  if (!result.ok) throw new Error(result.error);
  return { project: result.data, isPersonal: true };
}

export async function addAssetToProject(input: {
  projectId: string;
  mode: ProjectMode;
  afterUrl: string;
  beforeUrl?: string;
  params: unknown;
  localId?: string;
}): Promise<ProjectAsset> {
  const afterDataUrl = await toResizedJpegDataUrl(input.afterUrl, STORE_MAX_EDGE);
  const beforeDataUrl = input.beforeUrl
    ? await toResizedJpegDataUrl(input.beforeUrl, STORE_MAX_EDGE)
    : undefined;

  return addAssetAction({
    projectId: input.projectId,
    mode: input.mode,
    afterDataUrl,
    beforeDataUrl,
    params: input.params,
    localId: input.localId,
  });
}

export const MODE_LABELS: Record<ProjectMode, string> = {
  render: "パース",
  redesign: "Reデザイン",
  staging: "ステージング",
  edit: "編集",
  enhance: "高品質化",
  gemini: "オリジナル画像生成",
};
