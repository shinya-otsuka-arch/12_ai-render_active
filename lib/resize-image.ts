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

/** Vercel の ~4.5MB 上限に余裕を持たせた JSON ボディ上限（文字数） */
export const API_PAYLOAD_BUDGET = Math.floor(3.5 * 1024 * 1024);
export const API_PRIMARY_MAX_EDGE = 2048;
export const API_AUX_MAX_EDGE = 1280;

const QUALITY_STEPS = [0.95, 0.9, 0.85] as const;

const PAYLOAD_TOO_LARGE =
  "画像が大きすぎます。別の写真で試すか、枚数を減らしてください。";

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = dataUrl;
  });
}

function drawScaled(img: HTMLImageElement, maxEdge: number): HTMLCanvasElement {
  const longest = Math.max(img.width, img.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas を初期化できませんでした");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** API 送信用: 高品質JPEGへ再エンコード（PNG巨大化と輪郭劣化の両方を抑える） */
export async function prepareImageForApi(
  dataUrl: string,
  maxEdge = API_PRIMARY_MAX_EDGE,
  quality = 0.95
): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = drawScaled(img, maxEdge);
  return canvas.toDataURL("image/jpeg", quality);
}

/** 透過が必要なマスク等: PNG のまま長辺縮小 */
export async function preparePngForApi(
  dataUrl: string,
  maxEdge = API_PRIMARY_MAX_EDGE
): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = drawScaled(img, maxEdge);
  return canvas.toDataURL("image/png");
}

export function assertPayloadUnderLimit(
  body: unknown,
  budget = API_PAYLOAD_BUDGET
): void {
  if (JSON.stringify(body).length > budget) {
    throw new Error(PAYLOAD_TOO_LARGE);
  }
}

export type PreparedApiImages = {
  primary: string;
  reference?: string;
  styleImages?: string[];
};

/**
 * 主画像・参考画像を段階的に品質を下げてエンコードし、
 * build 結果の JSON が予算内に収まるまで試す。
 */
export async function withFittedApiImages<T>(
  sources: {
    primary: string;
    reference?: string | null;
    styleImages?: string[];
  },
  build: (images: PreparedApiImages) => T
): Promise<T> {
  for (const quality of QUALITY_STEPS) {
    const auxQuality = Math.min(quality, 0.85);
    const primary = await prepareImageForApi(
      sources.primary,
      API_PRIMARY_MAX_EDGE,
      quality
    );
    const reference = sources.reference
      ? await prepareImageForApi(sources.reference, API_AUX_MAX_EDGE, auxQuality)
      : undefined;
    const styleImages = sources.styleImages?.length
      ? await Promise.all(
          sources.styleImages.map((s) =>
            prepareImageForApi(s, API_AUX_MAX_EDGE, auxQuality)
          )
        )
      : undefined;

    const body = build({ primary, reference, styleImages });
    if (JSON.stringify(body).length <= API_PAYLOAD_BUDGET) {
      return body;
    }
  }

  throw new Error(PAYLOAD_TOO_LARGE);
}
