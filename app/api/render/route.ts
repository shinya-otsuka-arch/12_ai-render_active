import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { buildPrompt, buildNegativePrompt } from "@/lib/prompt-builder";
import type { RenderParams } from "@/lib/prompt-builder";

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

  let body: RenderParams & { image: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const { image, projectType, style, lighting, materials, strength = 0.8 } = body;

  if (!image) {
    return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
  }

  const prompt = buildPrompt({ projectType, style, lighting, materials });
  const negativePrompt = buildNegativePrompt();

  try {
    // Stable Diffusion img2img (SDXL) - 建築レンダリング用
    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37291fae17e408b9b3a1a4a4",
      {
        input: {
          prompt,
          negative_prompt: negativePrompt,
          image,
          strength,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          width: 1024,
          height: 1024,
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
