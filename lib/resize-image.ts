/**
 * data URL を長辺 maxEdge に縮小して JPEG 化する（localStorage 容量対策）。
 * ブラウザ専用。
 */
export function resizeDataUrl(
  dataUrl: string,
  maxEdge = 800,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.width, img.height);
      if (longest <= maxEdge) {
        resolve(dataUrl);
        return;
      }
      const scale = maxEdge / longest;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
