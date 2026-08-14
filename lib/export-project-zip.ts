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

function dataUrlToBinary(dataUrl: string): { ext: string; data: Uint8Array } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return { ext: "bin", data: new TextEncoder().encode(dataUrl) };
  }
  const mime = match[1];
  const ext =
    mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { ext, data: bytes };
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

  assets
    .slice()
    .reverse()
    .forEach((asset: ProjectAsset, index) => {
      const n = String(index + 1).padStart(3, "0");
      const prefix = `${n}_${asset.mode}`;

      const after = dataUrlToBinary(asset.afterUrl);
      folder.file(`${prefix}_after.${after.ext}`, after.data);

      if (asset.beforeUrl) {
        const before = dataUrlToBinary(asset.beforeUrl);
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
    });

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
