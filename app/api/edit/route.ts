import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { STYLE_GUARDRAIL_POSITIVE } from "@/lib/prompt-builder";
import {
  describeMaterialReference,
  appendMaterialReference,
} from "@/lib/describe-material";
import { requireUser } from "@/lib/supabase/require-user";

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let body: {
    image: string;
    mask: string;
    prompt: string;
    referenceImage?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const { image, mask, prompt, referenceImage } = body;

  if (!image || !mask || !prompt) {
    return NextResponse.json(
      { error: "画像・マスク・プロンプトが必要です" },
      { status: 400 }
    );
  }

  try {
    let instruction = prompt;
    if (referenceImage) {
      const materialReference = await describeMaterialReference(referenceImage);
      instruction = appendMaterialReference(prompt, materialReference, "masked");
    }

    const fullPrompt = `${instruction}, ${STYLE_GUARDRAIL_POSITIVE}, photorealistic, professional architectural photography, 8k, ultra detailed`;

    const imageBuffer = dataUrlToBuffer(image);
    const maskBuffer = dataUrlToBuffer(mask);

    const result = await openai.images.edit({
      model: "gpt-image-2",
      image: await toFile(imageBuffer, "image.png", { type: "image/png" }),
      mask: await toFile(maskBuffer, "mask.png", { type: "image/png" }),
      prompt: fullPrompt,
      size: "auto",
      quality: "high",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("画像データが取得できませんでした");
    }

    return NextResponse.json({ output: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("OpenAI error:", err);
    return NextResponse.json(
      { error: "画像編集に失敗しました。しばらくしてから再試行してください。" },
      { status: 500 }
    );
  }
}
