import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { extractOutputUrl } from "@/lib/replicate-output";
import { STYLE_GUARDRAIL_NEGATIVE } from "@/lib/prompt-builder";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false,
});

const ENHANCE_MODEL =
  "philz1337x/clarity-upscaler:dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e" as const;

interface EnhanceBody {
  image: string;
  creativity?: number;
  resemblance?: number;
  scaleFactor?: number;
}

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  let body: EnhanceBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const {
    image,
    creativity = 0.35,
    resemblance = 0.6,
    scaleFactor = 2,
  } = body;

  if (!image) {
    return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
  }

  const scale = scaleFactor === 4 ? 4 : 2;

  try {
    const output = await replicate.run(ENHANCE_MODEL, {
      input: {
        image,
        scale_factor: scale,
        creativity: Math.min(0.9, Math.max(0.3, creativity)),
        resemblance: Math.min(1.6, Math.max(0.3, resemblance)),
        prompt:
          "masterpiece, best quality, highres, photorealistic architecture, natural authentic textures",
        negative_prompt: `(worst quality, low quality, normal quality:2), ${STYLE_GUARDRAIL_NEGATIVE}, plastic look, fake detail`,
        num_inference_steps: 18,
      },
    });

    return NextResponse.json({ output: extractOutputUrl(output) });
  } catch (err) {
    console.error("Replicate error:", err);
    return NextResponse.json(
      { error: "高品質化に失敗しました。しばらくしてから再試行してください。" },
      { status: 500 }
    );
  }
}
