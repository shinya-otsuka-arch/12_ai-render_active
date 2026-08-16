import JSZip from "jszip";
import {
  listAssets,
  MODE_LABELS,
  type Project,
  type ProjectAsset,
} from "@/lib/project-store";

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "project";
}

async function urlToBinary(
  src: string
): Promise<{ ext: string; data: Uint8Array }> {
  if (src.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(src);
    if (!match) {
      return { ext: "bin", data: new TextEncoder().encode(src) };
    }
    const mime = match[1];
    const ext =
      mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { ext, data: bytes };
  }

  const res = await fetch(src);
  if (!res.ok) throw new Error("画像の取得に失敗しました");
  const buf = new Uint8Array(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "";
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  return { ext, data: buf };
}

export async function exportProjectZip(project: Project): Promise<void> {
  const assets = await listAssets(project.id);
  const zip = new JSZip();
  const exportedAt = new Date().toISOString();

  zip.file(
    "project.json",
    JSON.stringify(
      {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        exportedAt,
        assetCount: assets.length,
      },
      null,
      2
    )
  );

  const folder = zip.folder("assets");
  if (!folder) throw new Error("ZIP フォルダの作成に失敗しました");

  const ordered = assets.slice().reverse();
  for (let index = 0; index < ordered.length; index++) {
    const asset: ProjectAsset = ordered[index];
    const n = String(index + 1).padStart(3, "0");
    const prefix = `${n}_${asset.mode}`;

    const after = await urlToBinary(asset.afterUrl);
    folder.file(`${prefix}_after.${after.ext}`, after.data);

    if (asset.beforeUrl) {
      const before = await urlToBinary(asset.beforeUrl);
      folder.file(`${prefix}_before.${before.ext}`, before.data);
    }

    folder.file(
      `${prefix}_meta.json`,
      JSON.stringify(
        {
          id: asset.id,
          mode: asset.mode,
          modeLabel: MODE_LABELS[asset.mode],
          createdAt: asset.createdAt,
          params: asset.params,
          hasBefore: Boolean(asset.beforeUrl),
        },
        null,
        2
      )
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const date = exportedAt.slice(0, 10);
  const filename = `${safeFileName(project.name)}_${date}.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
