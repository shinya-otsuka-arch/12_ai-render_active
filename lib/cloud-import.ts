import {
  addAssetToProject,
  createProjectWithLocalId,
} from "@/lib/project-store";
import { addStyleLibraryImage } from "@/lib/style-library-store";
import {
  listLegacyAssets,
  listLegacyProjects,
  listLegacyStyles,
  markCloudImportDone,
  type LegacyProjectMode,
} from "@/lib/local-legacy-store";

export async function importLegacyLocalData(onProgress?: (msg: string) => void) {
  const projects = listLegacyProjects();
  const styles = await listLegacyStyles();

  let projectCount = 0;
  let assetCount = 0;
  let styleCount = 0;

  for (const project of projects) {
    onProgress?.(`案件「${project.name}」を取り込み中…`);
    const cloud = await createProjectWithLocalId(project.name, project.id);
    projectCount += 1;

    const assets = await listLegacyAssets(project.id);
    for (const asset of assets) {
      await addAssetToProject({
        projectId: cloud.id,
        mode: asset.mode as LegacyProjectMode,
        afterUrl: asset.afterUrl,
        beforeUrl: asset.beforeUrl,
        params: asset.params,
        localId: asset.id,
      });
      assetCount += 1;
    }
  }

  for (const style of styles) {
    onProgress?.(`作風「${style.label || style.id}」を取り込み中…`);
    await addStyleLibraryImage(style.imageUrl, style.label, {
      localId: style.id,
      styleBrief: style.styleBrief,
    });
    styleCount += 1;
  }

  markCloudImportDone();
  return { projectCount, assetCount, styleCount };
}
