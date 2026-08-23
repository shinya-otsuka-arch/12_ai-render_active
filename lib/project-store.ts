import { toResizedJpegDataUrl } from "@/lib/storage-image";
import {
  listProjects,
  createProject,
  createProjectWithLocalId,
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
};

const ACTIVE_KEY = "archirender-active-project";
const STORE_MAX_EDGE = 1280;

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProjectId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export async function addAssetToProject(input: {
  projectId: string;
  mode: ProjectMode;
  afterUrl: string;
  beforeUrl?: string;
  params: unknown;
  localId?: string;
}): Promise<ProjectAsset> {
  // ブラウザ側でリサイズしてから data URL をサーバーアクションへ渡す
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

export async function saveToActiveProjectIfSelected(input: {
  mode: ProjectMode;
  afterUrl: string;
  beforeUrl?: string;
  params: unknown;
}): Promise<void> {
  const projectId = getActiveProjectId();
  if (!projectId) return;
  try {
    const project = await getProject(projectId);
    if (!project) return;
    await addAssetToProject({ projectId, ...input });
  } catch (err) {
    console.error("Projectへの保存に失敗:", err);
  }
}

export const MODE_LABELS: Record<ProjectMode, string> = {
  render: "パース",
  redesign: "リデザイン",
  staging: "ステージング",
  edit: "編集",
  enhance: "高品質化",
};
