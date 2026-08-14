import { resizeDataUrl } from "@/lib/resize-image";

const DB_NAME = "archirender-style-library";
const DB_VERSION = 1;
const STORE = "styles";
const META_KEY = "archirender-style-library-meta";
const APPLY_KEY = "archirender-apply-house-style";
const MAX_EDGE = 1024;
const MAX_ITEMS = 24;

export interface StyleLibraryItem {
  id: string;
  /** 縮小済み data URL */
  imageUrl: string;
  /** Vision 解析キャッシュ（英語） */
  styleBrief?: string;
  label?: string;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
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

export function getApplyHouseStyle(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(APPLY_KEY);
  if (v === null) return true;
  return v === "1";
}

export function setApplyHouseStyle(on: boolean) {
  localStorage.setItem(APPLY_KEY, on ? "1" : "0");
}

export async function listStyleLibrary(): Promise<StyleLibraryItem[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const items = await idbRequest(tx.objectStore(STORE).getAll());
  db.close();
  return (items as StyleLibraryItem[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function addStyleLibraryImage(
  dataUrl: string,
  label?: string
): Promise<StyleLibraryItem> {
  const existing = await listStyleLibrary();
  if (existing.length >= MAX_ITEMS) {
    throw new Error(`作風ライブラリは最大${MAX_ITEMS}枚までです`);
  }

  const imageUrl = await resizeDataUrl(dataUrl, MAX_EDGE, 0.85);
  const item: StyleLibraryItem = {
    id: crypto.randomUUID(),
    imageUrl,
    label: label?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbRequest(tx.objectStore(STORE).put(item));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("put failed"));
  });
  db.close();
  localStorage.setItem(META_KEY, new Date().toISOString());
  return item;
}

export async function deleteStyleLibraryItem(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await idbRequest(tx.objectStore(STORE).delete(id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("delete failed"));
  });
  db.close();
}

export async function updateStyleBrief(
  id: string,
  styleBrief: string
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const item = (await idbRequest(store.get(id))) as StyleLibraryItem | undefined;
  if (!item) {
    db.close();
    return;
  }
  await idbRequest(store.put({ ...item, styleBrief }));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("update failed"));
  });
  db.close();
}

/**
 * ライブラリ画像の作風要約を返す（未解析なら /api/style-brief で作成してキャッシュ）。
 */
export async function getOrBuildLibraryStyleBrief(): Promise<string | null> {
  const items = await listStyleLibrary();
  if (items.length === 0) return null;

  const withBrief = items.filter((i) => i.styleBrief);
  if (withBrief.length === items.length && items[0]?.styleBrief) {
    const combined = withBrief.map((i) => i.styleBrief).join("; ");
    if (combined.length < 500) return combined;
  }

  const res = await fetch("/api/style-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: items.map((i) => i.imageUrl) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "作風の解析に失敗しました");
  }
  const data = (await res.json()) as { styleBrief: string };
  const brief = data.styleBrief;
  await Promise.all(items.map((i) => updateStyleBrief(i.id, brief)));
  return brief;
}
