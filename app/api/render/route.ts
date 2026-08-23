import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { buildPrompt, buildNegativePrompt } from "@/lib/prompt-builder";
import type { RenderParams } from "@/lib/prompt-builder";
import { extractOutputUrl, toDataUrlIfRemote } from "@/lib/replicate-output";
import { describeMaterialReference } from "@/lib/describe-material";
import { resolveStyleBrief } from "@/lib/resolve-style";
import { requireUser } from "@/lib/supabase/require-user";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false,
});

/** CG/スケッチ向け: Canny ControlNet で線構造を保持 */
const RENDER_MODEL =
  "fofr/sdxl-multi-controlnet-lora:89eb212b3d1366a83e949c12a4b45dfe6b6b313b594cb8268e864931ac9ffb16" as const;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  let body: RenderParams & {
    image: string;
    structureScale?: number;
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
    partFinishes,
    strength = 0.75,
    structureScale = 0.8,
    customPrompt,
    referenceImage,
    styleImages,
    houseStyleBrief,
    styleStrength,
  } = body;

  if (!image) {
    return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
  }

  const clampedStrength = Math.min(1, Math.max(0.3, strength));
  const clampedStructure = Math.min(1, Math.max(0.4, structureScale));

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
      partFinishes,
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
        prompt_strength: clampedStrength,
        sizing_strategy: "input_image",
        controlnet_1: "edge_canny",
        controlnet_1_image: image,
        controlnet_1_conditioning_scale: clampedStructure,
        num_inference_steps: 40,
        guidance_scale: 7.5,
        width: 1024,
        height: 1024,
        disable_safety_checker: true,
        apply_watermark: false,
      },
    });

    const outputUrl = extractOutputUrl(output);
    return NextResponse.json({ output: await toDataUrlIfRemote(outputUrl) });
  } catch (err) {
    console.error("Render error:", err);
    const message =
      err instanceof Error && err.message.includes("OPENAI_API_KEY")
        ? err.message
        : "画像生成に失敗しました。しばらくしてから再試行してください。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
