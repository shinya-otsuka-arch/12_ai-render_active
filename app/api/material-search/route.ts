import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";

interface SearchBody {
  query?: string;
  mode?: string;
  reuseOnly?: boolean;
}

interface SerpImage {
  title?: string;
  original?: string;
  thumbnail?: string;
  serpapi_thumbnail?: string;
  link?: string;
  source?: string;
  original_width?: number;
  original_height?: number;
}

async function buildSearchQuery(query: string, mode?: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return query;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents:
        `建築ビジュアライゼーションの素材参考画像を検索します。` +
        `ユーザー要望を、画像検索に適した具体的な1行の検索語へ変換してください。` +
        `説明や引用符は不要です。用途: ${mode ?? "建築"}。要望: ${query}`,
    });
    return response.text?.trim() || query;
  } catch {
    return query;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  if (!process.env.SERPAPI_API_KEY) {
    return NextResponse.json(
      { error: "SERPAPI_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  let body: SearchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }
  const query = body.query?.trim();
  if (!query || query.length > 400) {
    return NextResponse.json({ error: "400文字以内で検索内容を入力してください" }, { status: 400 });
  }

  try {
    const searchQuery = await buildSearchQuery(query, body.mode);
    const params = new URLSearchParams({
      engine: "google_images",
      q: searchQuery,
      api_key: process.env.SERPAPI_API_KEY,
      gl: "jp",
      hl: "ja",
      safe: "active",
      tbs: "itp:photos,isz:l",
    });
    if (body.reuseOnly) params.set("licenses", "fmc");

    const response = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`SerpApi ${response.status}`);
    const data = (await response.json()) as {
      images_results?: SerpImage[];
      error?: string;
    };
    if (data.error) throw new Error(data.error);

    const results = (data.images_results ?? [])
      .filter((item) => item.original && item.link)
      .slice(0, 24)
      .map((item) => ({
        id: createHash("sha256")
          .update(`${item.original}|${item.link}`)
          .digest("hex")
          .slice(0, 20),
        title: item.title ?? "画像候補",
        imageUrl: item.original as string,
        thumbnailUrl: item.serpapi_thumbnail ?? item.thumbnail ?? item.original,
        sourceUrl: item.link as string,
        source: item.source ?? new URL(item.link as string).hostname,
        width: item.original_width,
        height: item.original_height,
        reuseFiltered: Boolean(body.reuseOnly),
      }));
    return NextResponse.json({ query: searchQuery, results });
  } catch (err) {
    console.error("Material search error:", err);
    return NextResponse.json(
      { error: "画像検索に失敗しました。検索語を変えて再試行してください。" },
      { status: 502 }
    );
  }
}
