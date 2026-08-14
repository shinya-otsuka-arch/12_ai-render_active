import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { buildPrompt, buildNegativePrompt } from "@/lib/prompt-builder";
import type { ProjectType, Lighting, Material } from "@/lib/prompt-builder";
import { extractOutputUrl } from "@/lib/replicate-output";
import { describeMaterialReference } from "@/lib/describe-material";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false,
});

const INTERIOR_MODEL =
  "rocketdigitalai/interior-design-sdxl:a3c091059a25590ce2d5ea13651fab63f447f21760e50c358d4b850e844f59ee" as const;

const EXTERIOR_MODEL =
  "fofr/sdxl-multi-controlnet-lora:89eb212b3d1366a83e949c12a4b45dfe6b6b313b594cb8268e864931ac9ffb16" as const;

interface RedesignBody {
  image: string;
  projectType: ProjectType;
  lighting: Lighting;
  materials: Material[];
  strength?: number;
  structureScale?: number;
  customPrompt?: string;
  referenceImage?: string;
}

function buildInteriorInput(
  image: string,
  prompt: string,
  negativePrompt: string,
  strength: number,
  structureScale: number
) {
  return {
    image,
    prompt,
    negative_prompt: negativePrompt,
    depth_strength: structureScale,
    promax_strength: structureScale,
    num_inference_steps: 50,
    guidance_scale: 7.5,
    refiner_strength: Math.min(0.6, 0.25 + strength * 0.35),
  };
}

function buildExteriorInput(
  image: string,
  prompt: string,
  negativePrompt: string,
  strength: number,
  structureScale: number
) {
  return {
    prompt,
    negative_prompt: negativePrompt,
    image,
    prompt_strength: strength,
    sizing_strategy: "input_image",
    controlnet_1: "edge_canny",
    controlnet_1_image: image,
    controlnet_1_conditioning_scale: structureScale,
    controlnet_2: "depth_midas",
    controlnet_2_image: image,
    controlnet_2_conditioning_scale: structureScale,
    num_inference_steps: 30,
    guidance_scale: 7.5,
    width: 1024,
    height: 1024,
    disable_safety_checker: true,
    apply_watermark: false,
  };
}

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  let body: RedesignBody;
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
    strength = 0.7,
    structureScale = 0.8,
    customPrompt,
    referenceImage,
  } = body;

  if (!image) {
    return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
  }

  if (projectType !== "interior" && projectType !== "exterior") {
    return NextResponse.json({ error: "projectType が不正です" }, { status: 400 });
  }

  const clampedStrength = Math.min(1, Math.max(0.3, strength));
  const clampedStructure = Math.min(1, Math.max(0.4, structureScale));

  try {
    let materialReference: string | undefined;
    if (referenceImage) {
      materialReference = await describeMaterialReference(referenceImage);
    }

    const prompt = buildPrompt({
      projectType,
      lighting,
      materials,
      customPrompt,
      materialReference,
    });
    const negativePrompt = buildNegativePrompt();

    const output =
      projectType === "interior"
        ? await replicate.run(INTERIOR_MODEL, {
            input: buildInteriorInput(
              image,
              prompt,
              negativePrompt,
              clampedStrength,
              clampedStructure
            ),
          })
        : await replicate.run(EXTERIOR_MODEL, {
            input: buildExteriorInput(
              image,
              prompt,
              negativePrompt,
              clampedStrength,
              clampedStructure
            ),
          });

    return NextResponse.json({ output: extractOutputUrl(output) });
  } catch (err) {
    console.error("Redesign error:", err);
    const message =
      err instanceof Error && err.message.includes("OPENAI_API_KEY")
        ? err.message
        : "画像生成に失敗しました。しばらくしてから再試行してください。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
