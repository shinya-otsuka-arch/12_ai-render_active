import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  let body: { image: string; mask: string; prompt: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const { image, mask, prompt } = body;

  if (!image || !mask || !prompt) {
    return NextResponse.json(
      { error: "画像・マスク・プロンプトが必要です" },
      { status: 400 }
    );
  }

  const fullPrompt = `${prompt}, photorealistic, professional architectural photography, 8k, ultra detailed`;
  const negativePrompt = "blurry, distorted, low quality, cartoon, unrealistic";

  try {
    // Stable Diffusion inpainting
    const output = await replicate.run(
      "stability-ai/stable-diffusion-inpainting:95b7223104132402a9ae91cc677285bc5eb997834bd2349fa486f53910fd68b3",
      {
        input: {
          image,
          mask,
          prompt: fullPrompt,
          negative_prompt: negativePrompt,
          num_inference_steps: 25,
          guidance_scale: 7.5,
        },
      }
    );

    const outputUrl = Array.isArray(output) ? output[0] : output;
    return NextResponse.json({ output: outputUrl });
  } catch (err) {
    console.error("Replicate error:", err);
    return NextResponse.json(
      { error: "画像編集に失敗しました。しばらくしてから再試行してください。" },
      { status: 500 }
    );
  }
}
