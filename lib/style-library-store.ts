import { toResizedJpegDataUrl } from "@/lib/storage-image";
import { resizeDataUrl, assertPayloadUnderLimit } from "@/lib/resize-image";
import { readApiJson } from "@/lib/api-client";
import {
  listStyleLibrary,
  addStyleLibraryImage as addStyleAction,
  deleteStyleLibraryItem,
  updateStyleBrief,
} from "@/lib/style-actions";
import type { StyleLibraryItem } from "@/lib/style-actions";

export type { StyleLibraryItem };
export { listStyleLibrary, deleteStyleLibraryItem, updateStyleBrief };

const APPLY_KEY = "archirender-apply-house-style";
const MAX_EDGE = 1024;

export function getApplyHouseStyle(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(APPLY_KEY);
  if (v === null) return true;
  return v === "1";
}

export function setApplyHouseStyle(on: boolean) {
  localStorage.setItem(APPLY_KEY, on ? "1" : "0");
}

export async function addStyleLibraryImage(
  dataUrl: string,
  label?: string,
  options?: { localId?: string; styleBrief?: string }
): Promise<StyleLibraryItem> {
  // ブラウザ側でリサイズしてからサーバーアクションへ渡す
  const resized = await toResizedJpegDataUrl(dataUrl, MAX_EDGE);
  return addStyleAction({
    dataUrl: resized,
    label,
    localId: options?.localId,
    styleBrief: options?.styleBrief,
  });
}

export async function getOrBuildLibraryStyleBrief(): Promise<string | null> {
  const items = await listStyleLibrary();
  if (items.length === 0) return null;

  const withBrief = items.filter((i) => i.styleBrief);
  if (withBrief.length === items.length && items[0]?.styleBrief) {
    const combined = withBrief.map((i) => i.styleBrief).join("; ");
    if (combined.length < 500) return combined;
  }

  const dataUrls: string[] = [];
  for (const item of items) {
    const resized = await toResizedJpegDataUrl(item.imageUrl, MAX_EDGE);
    dataUrls.push(await resizeDataUrl(resized, MAX_EDGE, 0.8));
  }

  const body = { images: dataUrls };
  assertPayloadUnderLimit(body);
  const res = await fetch("/api/style-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readApiJson<{ styleBrief: string }>(res);
  const brief = data.styleBrief;
  await Promise.all(items.map((i) => updateStyleBrief(i.id, brief)));
  return brief;
}
