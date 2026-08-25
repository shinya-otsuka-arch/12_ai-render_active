import { NextRequest, NextResponse } from "next/server";
import { fetchPublicImage } from "@/lib/safe-remote-image";
import { requireUser } from "@/lib/supabase/require-user";

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  let body: { imageUrl?: string; rightsConfirmed?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }
  if (!body.rightsConfirmed) {
    return NextResponse.json(
      { error: "掲載元で画像の利用条件を確認してください" },
      { status: 400 }
    );
  }
  if (!body.imageUrl || body.imageUrl.length > 4_000) {
    return NextResponse.json({ error: "画像URLが不正です" }, { status: 400 });
  }

  try {
    const image = await fetchPublicImage(body.imageUrl);
    return NextResponse.json({
      dataUrl: `data:${image.mimeType};base64,${image.buffer.toString("base64")}`,
    });
  } catch (err) {
    console.error("Material import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "画像の取込に失敗しました" },
      { status: 400 }
    );
  }
}
