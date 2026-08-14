import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { buildPrompt, buildNegativePrompt } from "@/lib/prompt-builder";
import type { RenderParams } from "@/lib/prompt-builder";
import { extractOutputUrl } from "@/lib/replicate-output";
import { describeMaterialReference } from "@/lib/describe-material";
import { resolveStyleBrief } from "@/lib/resolve-style";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false,
});

/** CG/スケッチ向け: Canny ControlNet で線構造を保持 */
const RENDER_MODEL =
  "fofr/sdxl-multi-controlnet-lora:89eb212b3d1366a83e949c12a4b45dfe6b6b313b594cb8268e864931ac9ffb16" as const;

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  let body: RenderParams & {
    image: string;
    referenceImage?: string;
    styleImages?: string[];
    houseStyleBrief?: string;
    styleStrength?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const {
    image,
    projectType,
    lighting,
    materials,
    strength = 0.75,
    customPrompt,
    referenceImage,
    styleImages,
    houseStyleBrief,
    styleStrength,
  } = body;

  if (!image) {
    return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
  }

  try {
    let materialReference: string | undefined;
    if (referenceImage) {
      materialReference = await describeMaterialReference(referenceImage);
    }

    const { styleBrief, styleStrength: resolvedStrength } = await resolveStyleBrief({
      styleImages,
      houseStyleBrief,
      styleStrength,
    });

    const prompt = buildPrompt({
      projectType,
      lighting,
      materials,
      customPrompt,
      materialReference,
      styleReference: styleBrief,
      styleStrength: resolvedStrength,
    });
    const negativePrompt = buildNegativePrompt(styleBrief ? resolvedStrength : 0);

    const output = await replicate.run(RENDER_MODEL, {
      input: {
        prompt,
        negative_prompt: negativePrompt,
        image,
        prompt_strength: strength,
        sizing_strategy: "input_image",
        controlnet_1: "edge_canny",
        controlnet_1_image: image,
        controlnet_1_conditioning_scale: 0.9,
        num_inference_steps: 30,
        guidance_scale: 7.5,
        width: 1024,
        height: 1024,
        disable_safety_checker: true,
        apply_watermark: false,
      },
    });

    return NextResponse.json({ output: extractOutputUrl(output) });
  } catch (err) {
    console.error("Render error:", err);
    const message =
      err instanceof Error && err.message.includes("OPENAI_API_KEY")
        ? err.message
        : "画像生成に失敗しました。しばらくしてから再試行してください。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
