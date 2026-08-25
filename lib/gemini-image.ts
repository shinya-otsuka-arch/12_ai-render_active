import "server-only";

import { GoogleGenAI, Modality } from "@google/genai";

export const ORIGINAL_IMAGE_MODEL = "gemini-2.5-flash-image";
export const ORIGINAL_IMAGE_MAX_IMAGES = 5;

export type OriginalImageAspectRatio =
  | "1:1"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "4:5"
  | "5:4"
  | "9:16"
  | "16:9"
  | "21:9";

// Legacy alias for compatibility
export type GeminiAspectRatio = OriginalImageAspectRatio;
export type GeminiImageSize = "1K" | "2K" | "4K";

export interface OriginalImageInput {
  dataUrl: string;
  label?: string;
}

// Legacy alias
export type GeminiReferenceImage = OriginalImageInput;

export interface GenerateOriginalImageInput {
  prompt: string;
  baseImage?: OriginalImageInput;
  referenceImages?: OriginalImageInput[];
  aspectRatio?: OriginalImageAspectRatio;
  previousImageDataUrl?: string;
}

// Legacy alias
export type GenerateGeminiImageInput = GenerateOriginalImageInput & {
  images?: OriginalImageInput[];
  imageSize?: GeminiImageSize;
  previousInteractionId?: string;
};

export interface GeneratedOriginalImage {
  data: string;
  mimeType: string;
}

// Legacy alias
export type GeneratedGeminiImage = GeneratedOriginalImage & {
  interactionId: string;
};

function parseDataUrl(dataUrl: string): { data: string; mimeType: string } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    dataUrl
  );
  if (!match) {
    throw new Error("PNG・JPEG・WEBP形式の画像を指定してください");
  }
  return { mimeType: match[1], data: match[2].replace(/\s/g, "") };
}

function aspectRatioText(ratio: OriginalImageAspectRatio): string {
  const map: Record<OriginalImageAspectRatio, string> = {
    "1:1": "正方形(1:1)",
    "2:3": "縦長(2:3)",
    "3:2": "横長(3:2)",
    "3:4": "縦長(3:4)",
    "4:3": "横長(4:3)",
    "4:5": "縦長(4:5)",
    "5:4": "横長(5:4)",
    "9:16": "縦長スマホ(9:16)",
    "16:9": "横長ワイド(16:9)",
    "21:9": "超横長(21:9)",
  };
  return map[ratio] ?? ratio;
}

export async function generateOriginalImage(
  input: GenerateOriginalImageInput
): Promise<GeneratedOriginalImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません");

  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("生成指示を入力してください");

  const totalImages =
    (input.baseImage ? 1 : 0) + (input.referenceImages?.length ?? 0);
  if (totalImages > ORIGINAL_IMAGE_MAX_IMAGES) {
    throw new Error(`画像は合計最大${ORIGINAL_IMAGE_MAX_IMAGES}枚です`);
  }

  const aspectSuffix = input.aspectRatio
    ? ` 縦横比は${aspectRatioText(input.aspectRatio)}で生成してください。`
    : "";
  const fullPrompt = prompt + aspectSuffix;

  const ai = new GoogleGenAI({ apiKey });

  type Part =
    | { inlineData: { mimeType: string; data: string } }
    | { text: string };

  const buildFirstUserParts = (): Part[] => {
    const parts: Part[] = [];
    if (input.baseImage) {
      const parsed = parseDataUrl(input.baseImage.dataUrl);
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
    for (const img of input.referenceImages ?? []) {
      const parsed = parseDataUrl(img.dataUrl);
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
    parts.push({ text: fullPrompt });
    return parts;
  };

  let contents: { role: string; parts: Part[] }[];

  if (input.previousImageDataUrl) {
    const prev = parseDataUrl(input.previousImageDataUrl);
    contents = [
      { role: "user", parts: buildFirstUserParts() },
      { role: "model", parts: [{ inlineData: { mimeType: prev.mimeType, data: prev.data } }] },
      { role: "user", parts: [{ text: fullPrompt }] },
    ];
  } else {
    contents = [{ role: "user", parts: buildFirstUserParts() }];
  }

  const response = await ai.models.generateContent({
    model: ORIGINAL_IMAGE_MODEL,
    contents,
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (p) => p.inlineData?.data
  );
  if (!imagePart?.inlineData?.data) {
    throw new Error("画像データが返されませんでした");
  }

  return {
    data: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType ?? "image/jpeg",
  };
}

/** Legacy wrapper for backward compat with old route */
export async function generateGeminiImage(
  input: GenerateGeminiImageInput
): Promise<GeneratedGeminiImage> {
  const result = await generateOriginalImage({
    prompt: input.prompt,
    baseImage: input.images?.[0],
    referenceImages: input.images?.slice(1),
    aspectRatio: input.aspectRatio,
    previousImageDataUrl: input.previousImageDataUrl,
  });
  return { ...result, interactionId: crypto.randomUUID() };
}
