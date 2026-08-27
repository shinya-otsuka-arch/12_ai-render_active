export const PROMPT_REFINE_MODES = [
  "render",
  "redesign",
  "edit",
  "gemini",
] as const;

export type PromptRefineMode = (typeof PROMPT_REFINE_MODES)[number];

export interface PromptRefineContext {
  hasBaseImage?: boolean;
  hasMask?: boolean;
  hasMaterialRefs?: boolean;
  hasStyleImages?: boolean;
}

export function isPromptRefineMode(value: unknown): value is PromptRefineMode {
  return (
    typeof value === "string" &&
    (PROMPT_REFINE_MODES as readonly string[]).includes(value)
  );
}

function flagList(context: PromptRefineContext): string {
  const flags = [
    context.hasBaseImage ? "元画像あり" : "元画像なし",
    context.hasMask ? "囲み範囲あり" : "囲み範囲なし",
    context.hasMaterialRefs ? "参考素材あり" : "参考素材なし",
    context.hasStyleImages ? "登録画像または作風参考あり" : "登録画像なし",
  ];
  return flags.join("、");
}

function modeInstructions(mode: PromptRefineMode): string {
  switch (mode) {
    case "render":
      return [
        "用途: CG・スケッチを写実的な建築パースへ変換する。",
        "出力は英語の1本の画像生成プロンプト。",
        "必ず含める: 元の建築・壁位置・開口・カメラアングルを維持すること。高解像度・高精細な写実出力。",
      ].join("");
    case "redesign":
      return [
        "用途: 実写真の素材・雰囲気を変えつつ構造は残す。",
        "出力は英語の1本の画像生成プロンプト。",
        "必ず含める: 壁・窓・開口・カメラを動かさないこと。高解像度・高精細な写実出力。",
      ].join("");
    case "edit":
      return [
        "用途: 囲んだ範囲だけを部分編集する。",
        "出力は日本語の1本の編集指示。",
        "必ず含める: 囲んだ範囲以外は構図も素材も触らないこと。範囲外は元画像のまま。高品質な仕上がり。",
      ].join("");
    case "gemini":
      return [
        "用途: テキストや参考画像からの自由な画像生成、または元画像を土台にした編集。",
        "出力は日本語の1本の生成指示。",
        "元画像があるときはそれを土台にし、指示した変更以外は維持すること。高解像度・高精細。",
      ].join("");
  }
}

function referenceInstructions(context: PromptRefineContext): string {
  const lines: string[] = [];
  if (context.hasMaterialRefs) {
    lines.push(
      "参考素材画像が添付されるので、その見た目・質感を根拠として明示すること。"
    );
  }
  if (context.hasStyleImages) {
    lines.push(
      "登録画像または作風参考が添付されるので、その意匠・雰囲気を根拠として明示すること。"
    );
  }
  if (context.hasMask) {
    lines.push("囲んだ範囲だけを変更対象とすること。");
  }
  if (context.hasBaseImage) {
    lines.push("元画像を壊さず、指定した変更以外は維持すること。");
  }
  return lines.join("");
}

export function buildPromptRefineInstruction(input: {
  mode: PromptRefineMode;
  draft: string;
  context: PromptRefineContext;
}): string {
  const draft = input.draft.trim();
  return [
    "建築ビジュアライゼーション用の画像生成プロンプトを作成してください。",
    modeInstructions(input.mode),
    `現在の入力: ${flagList(input.context)}。`,
    referenceInstructions(input.context),
    draft
      ? `ユーザーの雑な指示: ${draft}`
      : "ユーザー指示は未記入です。用途と入力フラグから、生成に使える具体的なプロンプトを作成してください。",
    "ユーザーの意図は保ち、曖昧な表現は具体的な素材・光・質感に直してください。",
    "出力はプロンプト本文のみ。説明、前置き、引用符、Markdownは不要です。",
  ].join("\n");
}
