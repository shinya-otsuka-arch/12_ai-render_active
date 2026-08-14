import OpenAI from "openai";

/**
 * 作風参考画像（1枚以上）から建築ビジュアルのスタイル要約を作る。
 */
export async function describeStyleReferences(dataUrls: string[]): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY が設定されていません（作風解析に必要です）");
  }
  if (dataUrls.length === 0) {
    throw new Error("作風参考画像がありません");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const images = dataUrls.slice(0, 6).map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }));

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "You are a senior architectural visualization art director.",
              "Analyze these reference images as a SINGLE house-style guide for photoreal architectural renders.",
              "Extract: color palette, material honesty, lighting mood, composition restraint, what to avoid (gaudy, kitsch, fake materials).",
              "Reply in English as one dense comma-separated style brief (max 70 words).",
              "Do not describe specific floorplans or furniture layouts. Focus on aesthetic DNA only.",
            ].join(" "),
          },
          ...images,
        ],
      },
    ],
    max_tokens: 200,
  });

  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("作風の解析に失敗しました");
  return text.replace(/^["']|["']$/g, "");
}

/** 作風をプロンプトに注入（strength 0〜1） */
export function appendStyleReference(
  prompt: string,
  styleBrief: string,
  strength = 0.75
): string {
  const weight =
    strength >= 0.85
      ? "strictly follow this house style"
      : strength >= 0.55
        ? "strongly match this house style"
        : "subtly lean toward this house style";
  return `${prompt}, ${weight}: ${styleBrief}, avoid anything that clashes with this aesthetic`;
}

export function appendStyleNegative(negative: string, strength = 0.75): string {
  if (strength < 0.4) return negative;
  return [
    negative,
    "style mismatch, conflicting design language, trendy AI look, overprocessed HDR, plastic CGI sheen, theme-park architecture",
  ].join(", ");
}
