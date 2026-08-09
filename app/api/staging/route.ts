import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false,
});

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  let body: { image: string; style: string; roomType: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const { image, style = "modern", roomType = "living room" } = body;

  if (!image) {
    return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
  }

  const stylePromptMap: Record<string, string> = {
    modern: "modern contemporary furnished",
    scandinavian: "Scandinavian minimal furnished, warm wood, hygge",
    japanese: "Japanese minimalist furnished, wabi-sabi, tatami",
    luxury: "luxury high-end furnished, marble, gold accents",
    industrial: "industrial loft furnished, exposed brick, metal",
  };

  const prompt = `${roomType}, ${stylePromptMap[style] ?? "modern furnished"}, photorealistic interior design, professional photography, 8k, ultra detailed, cozy atmosphere`;

  try {
    // Interior design staging model - 空室→家具配置特化
    const output = await replicate.run(
      "adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38",
      {
        input: {
          image,
          prompt,
          negative_prompt: "blurry, distorted, cartoon, low quality, empty room",
          guidance_scale: 15,
          num_inference_steps: 50,
          strength: 0.8,
        },
      }
    );

    const outputUrl = Array.isArray(output) ? output[0] : output;
    return NextResponse.json({ output: outputUrl });
  } catch (err) {
    console.error("Replicate error:", err);
    return NextResponse.json(
      { error: "画像生成に失敗しました。しばらくしてから再試行してください。" },
      { status: 500 }
    );
  }
}
