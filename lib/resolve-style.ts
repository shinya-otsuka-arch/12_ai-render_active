import {
  describeStyleReferences,
  appendStyleReference,
  appendStyleNegative,
} from "@/lib/describe-style";

export interface StyleInput {
  /** セッションでアップロードした作風参考（data URL） */
  styleImages?: string[];
  /** クライアントでライブラリから組み立てた作風 brief */
  houseStyleBrief?: string;
  styleStrength?: number;
}

/**
 * リクエストの作風入力から最終 styleBrief と strength を解決する。
 */
export async function resolveStyleBrief(input: StyleInput): Promise<{
  styleBrief?: string;
  styleStrength: number;
}> {
  const strength = Math.min(1, Math.max(0, input.styleStrength ?? 0.75));
  const parts: string[] = [];

  if (input.houseStyleBrief?.trim()) {
    parts.push(input.houseStyleBrief.trim());
  }

  if (input.styleImages && input.styleImages.length > 0) {
    const fromSession = await describeStyleReferences(input.styleImages);
    parts.push(fromSession);
  }

  if (parts.length === 0) {
    return { styleStrength: strength };
  }

  return {
    styleBrief: parts.join("; "),
    styleStrength: strength,
  };
}

export function applyStyleToPrompts(
  prompt: string,
  negative: string,
  styleBrief: string | undefined,
  styleStrength: number
): { prompt: string; negative: string } {
  if (!styleBrief) return { prompt, negative };
  return {
    prompt: appendStyleReference(prompt, styleBrief, styleStrength),
    negative: appendStyleNegative(negative, styleStrength),
  };
}
