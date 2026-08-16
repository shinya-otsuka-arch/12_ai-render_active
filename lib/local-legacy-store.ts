/**
 * クラウド移行前のブラウザ内ストア読み取り専用 API（取り込み用）。
 */

export type LegacyProjectMode =
  | "render"
  | "redesign"
  | "staging"
  | "edit"
  | "enhance";

export interface LegacyProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyProjectAsset {
  id: string;
  projectId: string;
  mode: LegacyProjectMode;
  afterUrl: string;
  beforeUrl?: string;
  params: unknown;
  createdAt: string;
}

export interface LegacyStyleItem {
  id: string;
  imageUrl: string;
  styleBrief?: string;
  label?: string;
  createdAt: string;
}

const PROJECTS_KEY = "archirender-projects-meta";
const PROJECT_DB = "archirender-projects";
const ASSET_STORE = "assets";
const STYLE_DB = "archirender-style-library";
const STYLE_STORE = "styles";
const IMPORT_FLAG = "archirender-cloud-import-done";

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
  });
}

export function isCloudImportDone(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(IMPORT_FLAG) === "1";
}

export function markCloudImportDone() {
  localStorage.setItem(IMPORT_FLAG, "1");
}

export function listLegacyProjects(): LegacyProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as LegacyProject[]) : [];
  } catch {
    return [];
  }
}

export async function listLegacyAssets(
  projectId: string
): Promise<LegacyProjectAsset[]> {
  try {
    const db = await openDb(PROJECT_DB);
    if (!db.objectStoreNames.contains(ASSET_STORE)) {
      db.close();
      return [];
    }
    const tx = db.transaction(ASSET_STORE, "readonly");
    const index = tx.objectStore(ASSET_STORE).index("projectId");
    const assets = await idbRequest(index.getAll(projectId));
    db.close();
    return assets as LegacyProjectAsset[];
  } catch {
    return [];
  }
}

export async function listLegacyStyles(): Promise<LegacyStyleItem[]> {
  try {
    const db = await openDb(STYLE_DB);
    if (!db.objectStoreNames.contains(STYLE_STORE)) {
      db.close();
      return [];
    }
    const tx = db.transaction(STYLE_STORE, "readonly");
    const items = await idbRequest(tx.objectStore(STYLE_STORE).getAll());
    db.close();
    return items as LegacyStyleItem[];
  } catch {
    return [];
  }
}

export async function hasLegacyLocalData(): Promise<boolean> {
  if (isCloudImportDone()) return false;
  const projects = listLegacyProjects();
  if (projects.length > 0) return true;
  const styles = await listLegacyStyles();
  return styles.length > 0;
}
