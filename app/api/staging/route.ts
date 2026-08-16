import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import {
  STYLE_GUARDRAIL_POSITIVE,
  STYLE_GUARDRAIL_NEGATIVE,
} from "@/lib/prompt-builder";
import { extractOutputUrl } from "@/lib/replicate-output";
import {
  describeMaterialReference,
  appendMaterialReference,
} from "@/lib/describe-material";
import { resolveStyleBrief, applyStyleToPrompts } from "@/lib/resolve-style";
import { requireUser } from "@/lib/supabase/require-user";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false,
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  let body: {
    image: string;
    style: string;
    roomType: string;
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
    style = "modern",
    roomType = "living room",
    referenceImage,
    styleImages,
    houseStyleBrief,
    styleStrength,
  } = body;

  if (!image) {
    return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
  }

  const stylePromptMap: Record<string, string> = {
    modern: "modern contemporary furnished",
    scandinavian: "Scandinavian minimal furnished, warm wood, hygge",
    japanese: "Japanese minimalist furnished, wabi-sabi, tatami",
    luxury: "refined high-end furnished, quality natural materials",
    industrial: "industrial loft furnished, exposed brick, metal",
  };

  try {
    let prompt = [
      roomType,
      stylePromptMap[style] ?? "modern furnished",
      STYLE_GUARDRAIL_POSITIVE,
      "photorealistic interior design, professional photography, 8k, ultra detailed, cozy atmosphere",
    ].join(", ");

    if (referenceImage) {
      const materialReference = await describeMaterialReference(referenceImage);
      prompt = appendMaterialReference(prompt, materialReference, "global");
    }

    const { styleBrief, styleStrength: resolvedStrength } = await resolveStyleBrief({
      styleImages,
      houseStyleBrief,
      styleStrength,
    });

    let negative = [
      "blurry, distorted, cartoon, low quality, empty room",
      STYLE_GUARDRAIL_NEGATIVE,
    ].join(", ");

    const styled = applyStyleToPrompts(prompt, negative, styleBrief, resolvedStrength);
    prompt = styled.prompt;
    negative = styled.negative;

    const output = await replicate.run(
      "adirik/interior-design:76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38",
      {
        input: {
          image,
          prompt,
          negative_prompt: negative,
          guidance_scale: 15,
          num_inference_steps: 50,
          strength: 0.8,
        },
      }
    );

    return NextResponse.json({ output: extractOutputUrl(output) });
  } catch (err) {
    console.error("Staging error:", err);
    const message =
      err instanceof Error && err.message.includes("OPENAI_API_KEY")
        ? err.message
        : "画像生成に失敗しました。しばらくしてから再試行してください。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
