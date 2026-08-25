import { NextRequest, NextResponse } from "next/server";
import {
  generateOriginalImage,
  type OriginalImageAspectRatio,
} from "@/lib/gemini-image";
import { storeGeneratedImage } from "@/lib/generated-image-storage";
import { requireUser } from "@/lib/supabase/require-user";

interface RequestBody {
  prompt?: string;
  baseImage?: { dataUrl: string; label?: string };
  referenceImages?: { dataUrl: string; label?: string }[];
  aspectRatio?: OriginalImageAspectRatio;
  previousImageDataUrl?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  try {
    const generated = await generateOriginalImage({
      prompt: body.prompt ?? "",
      baseImage: body.baseImage,
      referenceImages: body.referenceImages,
      aspectRatio: body.aspectRatio,
      previousImageDataUrl: body.previousImageDataUrl,
    });
    const output = await storeGeneratedImage({
      userId: auth.user.id,
      base64: generated.data,
      mimeType: generated.mimeType,
    });
    return NextResponse.json({ output });
  } catch (err) {
    console.error("Original image generation error:", err);
    const message =
      err instanceof Error &&
      (err.message.includes("設定されていません") ||
        err.message.includes("指定してください") ||
        err.message.includes("最大"))
        ? err.message
        : "画像生成に失敗しました。しばらくしてから再試行してください。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
