import { resizeDataUrl } from "@/lib/resize-image";

export type ProjectMode =
  | "render"
  | "redesign"
  | "staging"
  | "edit"
  | "enhance";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAsset {
  id: string;
  projectId: string;
  mode: ProjectMode;
  afterUrl: string;
  beforeUrl?: string;
  params: unknown;
  createdAt: string;
}

const DB_NAME = "archirender-projects";
const DB_VERSION = 1;
const ASSET_STORE = "assets";
const PROJECTS_KEY = "archirender-projects-meta";
const ACTIVE_KEY = "archirender-active-project";
const STORE_MAX_EDGE = 1280;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        const store = db.createObjectStore(ASSET_STORE, { keyPath: "id" });
        store.createIndex("projectId", "projectId", { unique: false });
      }
    };
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export function listProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProjectId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function createProject(name: string): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    name: name.trim() || "無題の案件",
    createdAt: now,
    updatedAt: now,
  };
  const projects = listProjects();
  projects.unshift(project);
  saveProjects(projects);
  return project;
}

export function renameProject(id: string, name: string): Project | null {
  const projects = listProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  projects[idx] = {
    ...projects[idx],
    name: name.trim() || projects[idx].name,
    updatedAt: new Date().toISOString(),
  };
  saveProjects(projects);
  return projects[idx];
}

export function touchProject(id: string) {
  const projects = listProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return;
  projects[idx] = { ...projects[idx], updatedAt: new Date().toISOString() };
  saveProjects(projects);
}

export async function deleteProject(id: string): Promise<void> {
  const projects = listProjects().filter((p) => p.id !== id);
  saveProjects(projects);
  if (getActiveProjectId() === id) setActiveProjectId(null);

  const db = await openDb();
  const tx = db.transaction(ASSET_STORE, "readwrite");
  const store = tx.objectStore(ASSET_STORE);
  const index = store.index("projectId");
  const assets = await idbRequest(index.getAll(id));
  await Promise.all(assets.map((a) => idbRequest(store.delete(a.id))));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("delete failed"));
  });
  db.close();
}

export function getProject(id: string): Project | undefined {
  return listProjects().find((p) => p.id === id);
}

/** http(s) URL や data URL を data URL に揃えてから縮小 */
async function normalizeImage(src: string, maxEdge = STORE_MAX_EDGE): Promise<string> {
  let dataUrl = src;
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const res = await fetch(src);
    const blob = await res.blob();
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      reader.readAsDataURL(blob);
    });
  }
  return resizeDataUrl(dataUrl, maxEdge, 0.85);
}

export async function addAssetToProject(input: {
  projectId: string;
  mode: ProjectMode;
  afterUrl: string;
  beforeUrl?: string;
  params: unknown;
}): Promise<ProjectAsset> {
  const afterUrl = await normalizeImage(input.afterUrl);
  const beforeUrl = input.beforeUrl
    ? await normalizeImage(input.beforeUrl)
    : undefined;

  const asset: ProjectAsset = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    mode: input.mode,
    afterUrl,
    beforeUrl,
    params: input.params,
    createdAt: new Date().toISOString(),
  };

  const db = await openDb();
  const tx = db.transaction(ASSET_STORE, "readwrite");
  await idbRequest(tx.objectStore(ASSET_STORE).put(asset));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("put failed"));
  });
  db.close();

  touchProject(input.projectId);
  return asset;
}

export async function listAssets(projectId: string): Promise<ProjectAsset[]> {
  const db = await openDb();
  const tx = db.transaction(ASSET_STORE, "readonly");
  const index = tx.objectStore(ASSET_STORE).index("projectId");
  const assets = await idbRequest(index.getAll(projectId));
  db.close();
  return assets.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function countAssets(projectId: string): Promise<number> {
  const assets = await listAssets(projectId);
  return assets.length;
}

export async function deleteAsset(assetId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ASSET_STORE, "readwrite");
  const store = tx.objectStore(ASSET_STORE);
  const existing = await idbRequest(store.get(assetId));
  await idbRequest(store.delete(assetId));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("delete asset failed"));
  });
  db.close();
  if (existing?.projectId) touchProject(existing.projectId);
}

/** 作業中案件があれば成果物を保存。未選択時・失敗時は生成フローを止めない */
export async function saveToActiveProjectIfSelected(input: {
  mode: ProjectMode;
  afterUrl: string;
  beforeUrl?: string;
  params: unknown;
}): Promise<void> {
  const projectId = getActiveProjectId();
  if (!projectId) return;
  if (!getProject(projectId)) return;
  try {
    await addAssetToProject({ projectId, ...input });
  } catch (err) {
    console.error("案件への保存に失敗:", err);
  }
}

export const MODE_LABELS: Record<ProjectMode, string> = {
  render: "パース",
  redesign: "リデザイン",
  staging: "ステージング",
  edit: "編集",
  enhance: "高品質化",
};
