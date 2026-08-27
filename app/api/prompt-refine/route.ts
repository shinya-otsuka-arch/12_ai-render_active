import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import {
  buildPromptRefineInstruction,
  isPromptRefineMode,
  type PromptRefineContext,
} from "@/lib/prompt-refine";
import { requireUser } from "@/lib/supabase/require-user";

const DRAFT_MAX_LENGTH = 2000;

interface RefineBody {
  mode?: unknown;
  draft?: unknown;
  context?: PromptRefineContext;
}

function cleanPrompt(text: string): string {
  let value = text.trim();
  value = value.replace(/^```(?:\w+)?\s*/, "").replace(/\s*```$/, "").trim();
  value = value.replace(/^["'「『]+|["'」』]+$/g, "").trim();
  return value;
}

function parseContext(value: PromptRefineContext | undefined): PromptRefineContext {
  return {
    hasBaseImage: Boolean(value?.hasBaseImage),
    hasMask: Boolean(value?.hasMask),
    hasMaterialRefs: Boolean(value?.hasMaterialRefs),
    hasStyleImages: Boolean(value?.hasStyleImages),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  let body: RefineBody;
  try {
    body = (await req.json()) as RefineBody;
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  if (!isPromptRefineMode(body.mode)) {
    return NextResponse.json({ error: "対象モードが不正です" }, { status: 400 });
  }

  const draft = typeof body.draft === "string" ? body.draft : "";
  if (draft.length > DRAFT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `${DRAFT_MAX_LENGTH}文字以内で入力してください` },
      { status: 400 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: buildPromptRefineInstruction({
        mode: body.mode,
        draft,
        context: parseContext(body.context),
      }),
    });
    const prompt = cleanPrompt(response.text ?? "");
    if (!prompt) {
      return NextResponse.json(
        { error: "プロンプトを作成できませんでした。内容を変えて再試行してください。" },
        { status: 500 }
      );
    }
    return NextResponse.json({ prompt });
  } catch (err) {
    console.error("Prompt refine error:", err);
    return NextResponse.json(
      { error: "プロンプトの作成に失敗しました。しばらくしてから再試行してください。" },
      { status: 500 }
    );
  }
}
