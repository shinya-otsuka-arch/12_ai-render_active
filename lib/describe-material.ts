import OpenAI from "openai";

/**
 * 参考素材画像を英語の質感フレーズに変換する（生成プロンプト注入用）。
 * OpenAI Vision を使用。
 */
export async function describeMaterialReference(dataUrl: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が設定されていません（参考素材の解析に必要です）");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "You are helping an architectural visualization tool.",
              "Describe this material/texture/style reference image for a photorealistic render prompt.",
              "Focus on material type, color, surface finish, grain, and tactile quality.",
              "Reply in English as one concise comma-separated phrase (max 40 words).",
              "Do not mention people, logos, or that it is a photo.",
            ].join(" "),
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 120,
  });

  const text = res.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("参考素材の解析に失敗しました");
  }
  return text.replace(/^["']|["']$/g, "");
}

/** 生成プロンプトに参考素材の指示を追加 */
export function appendMaterialReference(
  prompt: string,
  description: string,
  mode: "global" | "masked"
): string {
  const clause =
    mode === "masked"
      ? `in the masked region only, apply this material appearance and texture: ${description}`
      : `use materials and finishes matching this reference sample: ${description}`;
  return `${prompt}, ${clause}`;
}
