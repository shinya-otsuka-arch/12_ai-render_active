import { NextRequest, NextResponse } from "next/server";
import { describeStyleReferences } from "@/lib/describe-style";

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  let body: { images?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const images = body.images?.filter(Boolean) ?? [];
  if (images.length === 0) {
    return NextResponse.json({ error: "画像が必要です" }, { status: 400 });
  }

  try {
    const styleBrief = await describeStyleReferences(images);
    return NextResponse.json({ styleBrief });
  } catch (err) {
    console.error("style-brief error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "作風の解析に失敗しました",
      },
      { status: 500 }
    );
  }
}
