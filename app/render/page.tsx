"use client";

import { useRef, useState } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { ResultViewer, type ResultStatus } from "@/components/result-viewer";
import { HistoryPanel } from "@/components/history-panel";
import { useHistory } from "@/hooks/use-history";
import {
  resizeDataUrl,
  withFittedApiImages,
    preparePngForApi,
    API_PRIMARY_MAX_EDGE,
    API_PAYLOAD_BUDGET,
} from "@/lib/resize-image";
import { readApiJson } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { MaterialReferencePicker } from "@/components/material-reference-picker";
import { ActiveProjectSelect } from "@/components/active-project-select";
import {
  HouseStyleControls,
  emptyHouseStyleSelection,
  houseStyleToApiFields,
  type HouseStyleSelection,
} from "@/components/house-style-controls";
import {
  PartMaskCanvas,
  type PartMaskCanvasHandle,
} from "@/components/part-mask-canvas";
import { saveToActiveProjectIfSelected } from "@/lib/project-store";
import { toast } from "sonner";
import type { ProjectType, Lighting } from "@/lib/prompt-builder";
import {
  FINISHES,
  PART_LABELS,
  buildPartInpaintPrompt,
  finishLabel,
  partsForProjectType,
  type FinishPart,
  type PartFinishSelection,
} from "@/lib/finish-catalog";

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "interior", label: "内観" },
  { value: "exterior", label: "外観" },
];

const LIGHTINGS: { value: Lighting; label: string; icon: string }[] = [
  { value: "daytime", label: "昼光", icon: "☀" },
  { value: "sunset", label: "夕暮れ", icon: "🌅" },
  { value: "night", label: "夜景", icon: "🌙" },
  { value: "overcast", label: "曇天", icon: "☁" },
  { value: "dramatic", label: "ドラマチック", icon: "✦" },
];

interface RenderHistoryParams {
  projectType: ProjectType;
  lighting: Lighting;
  partFinishes: PartFinishSelection;
  strength: number;
  structureScale: number;
  customPrompt?: string;
}

/** 変換強度(0.3–1.0) ↔ 構造保持(0.4–1.0) の逆マッピング */
function structureFromStrength(s: number): number {
  return Math.min(1, Math.max(0.4, 1.0 - ((s - 0.3) / 0.7) * 0.6));
}

function strengthFromStructure(s: number): number {
  return Math.min(1, Math.max(0.3, 0.3 + ((1.0 - s) / 0.6) * 0.7));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(blob);
  });
}

async function imageToPngAtSize(
  src: string,
  width: number,
  height: number
): Promise<string> {
  let localSrc = src;
  if (!src.startsWith("data:")) {
    const res = await fetch(src);
    if (!res.ok) throw new Error("画像の読み込みに失敗しました");
    localSrc = await blobToDataUrl(await res.blob());
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas を初期化できませんでした"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = localSrc;
  });
}

export default function RenderPage() {
  const [projectType, setProjectType] = useState<ProjectType>("interior");
  const [lighting, setLighting] = useState<Lighting>("daytime");
  const [partFinishes, setPartFinishes] = useState<PartFinishSelection>({});
  const [activePart, setActivePart] = useState<FinishPart>("ceiling");
  const [brushSize, setBrushSize] = useState([24]);
  const [erase, setErase] = useState(false);
  const [strength, setStrength] = useState([0.75]);
  const [structureScale, setStructureScale] = useState([
    structureFromStrength(0.75),
  ]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [houseStyle, setHouseStyle] = useState<HouseStyleSelection>(
    emptyHouseStyleSelection
  );
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ResultStatus>("idle");
  const [generatingLabel, setGeneratingLabel] = useState("レンダリング中...");
  const [isDragging, setIsDragging] = useState(false);

  const { history, addEntry, clearHistory } = useHistory<RenderHistoryParams>(
    "archirender-history-render"
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const maskCanvasRef = useRef<PartMaskCanvasHandle>(null);

  const visibleParts = partsForProjectType(projectType);

  const handleProjectType = (next: ProjectType) => {
    setProjectType(next);
    setActivePart(partsForProjectType(next)[0]);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setResultImage(null);
      setStatus("idle");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const inpaintPart = async (
    imageSrc: string,
    mask: string,
    prompt: string
  ): Promise<string> => {
    const size = maskCanvasRef.current?.getSize();
    if (!size || size.width === 0) throw new Error("マスクサイズを取得できません");
    const cleanImagePng = await imageToPngAtSize(imageSrc, size.width, size.height);
    const edgeSteps = [API_PRIMARY_MAX_EDGE, 1536, 1280, 1024];
    let body:
      | { image: string; mask: string; prompt: string }
      | undefined;
    for (const edge of edgeSteps) {
      const image = await preparePngForApi(cleanImagePng, edge);
      const maskPrepared = await preparePngForApi(mask, edge);
      const candidate = { image, mask: maskPrepared, prompt };
      if (JSON.stringify(candidate).length <= API_PAYLOAD_BUDGET) {
        body = candidate;
        break;
      }
    }
    if (!body) {
      throw new Error(
        "画像が大きすぎます。別の写真で試すか、枚数を減らしてください。"
      );
    }
    const res = await fetch("/api/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readApiJson<{ output: string }>(res);
    return data.output;
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast.error("CGまたはスケッチ画像をアップロードしてください");
      return;
    }
    setStatus("generating");
    setResultImage(null);
    setGeneratingLabel("レンダリング中...");

    try {
      const styleFields = houseStyleToApiFields(houseStyle);
      const body = await withFittedApiImages(
        {
          primary: uploadedImage,
          reference: referenceImage,
          styleImages: styleFields.styleImages,
        },
        ({ primary, reference, styleImages }) => ({
          image: primary,
          projectType,
          lighting,
          partFinishes,
          strength: strength[0],
          structureScale: structureScale[0],
          customPrompt: customPrompt.trim() || undefined,
          referenceImage: reference,
          ...styleFields,
          styleImages,
        })
      );

      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await readApiJson<{ output: string }>(res);
      let output = data.output;

      const masks = maskCanvasRef.current?.getMasks() ?? {};
      for (const part of visibleParts) {
        const finishId = partFinishes[part];
        const mask = masks[part];
        if (!finishId || !mask) continue;
        setGeneratingLabel(`${PART_LABELS[part]}を仕上げ中...`);
        output = await inpaintPart(
          output,
          mask,
          buildPartInpaintPrompt(part, finishId)
        );
      }

      setResultImage(output);
      setStatus("done");
      const beforeUrl = await resizeDataUrl(uploadedImage);
      addEntry(
        output,
        {
          projectType,
          lighting,
          partFinishes,
          strength: strength[0],
          structureScale: structureScale[0],
          customPrompt: customPrompt.trim() || undefined,
        },
        beforeUrl
      );
      await saveToActiveProjectIfSelected({
        mode: "render",
        afterUrl: output,
        beforeUrl: uploadedImage,
        params: {
          projectType,
          lighting,
          partFinishes,
          strength: strength[0],
          structureScale: structureScale[0],
          customPrompt: customPrompt.trim() || undefined,
        },
      });
      toast.success("レンダリングが完成しました");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  return (
    <ToolLayout
      title="AIパース"
      description="SketchUp / CG / スケッチ → 構造を保った写実化"
      paramPanel={
        <>
          <ActiveProjectSelect />

          <Separator />

          <HouseStyleControls value={houseStyle} onChange={setHouseStyle} />

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              入力について
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              CG・スケッチ向けです。実写真のデザイン変更はリデザインを使ってください。
            </p>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              用途
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleProjectType(t.value)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    projectType === t.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              ライティング
            </p>
            <div className="grid grid-cols-1 gap-1">
              {LIGHTINGS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLighting(l.value)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    lighting === l.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <span>{l.icon}</span>
                  <span className="font-medium">{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              仕上げ
            </p>
            <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
              部位ごとに選択します。画像上をブラシで塗ると、その範囲に仕上げを割り当てます。
            </p>
            <div className="space-y-3">
              {visibleParts.map((part) => (
                <label key={part} className="block">
                  <span className="mb-1 block text-xs font-medium">
                    {PART_LABELS[part]}
                  </span>
                  <select
                    value={partFinishes[part] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPartFinishes((prev) => {
                        const next = { ...prev };
                        if (v) next[part] = v;
                        else delete next[part];
                        return next;
                      });
                      setActivePart(part);
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">指定なし</option>
                    {FINISHES[part].map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                変換強度
              </p>
              <span className="text-xs text-muted-foreground">
                {strength[0].toFixed(2)}
              </span>
            </div>
            <Slider
              value={strength}
              onValueChange={(val) => {
                const next = Array.isArray(val) ? (val as number[]) : [val as number];
                setStrength(next);
                setStructureScale([structureFromStrength(next[0])]);
              }}
              min={0.3}
              max={1.0}
              step={0.05}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">元画像重視</span>
              <span className="text-xs text-muted-foreground">AI重視</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                構造保持強度
              </p>
              <span className="text-xs text-muted-foreground">
                {structureScale[0].toFixed(2)}
              </span>
            </div>
            <Slider
              value={structureScale}
              onValueChange={(val) => {
                const next = Array.isArray(val) ? (val as number[]) : [val as number];
                setStructureScale(next);
                setStrength([strengthFromStructure(next[0])]);
              }}
              min={0.4}
              max={1.0}
              step={0.05}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">柔軟</span>
              <span className="text-xs text-muted-foreground">厳密</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              変換強度と連動します。質感を強く変えたいときは構造を緩め、線を崩したくないときは厳密側へ。
            </p>
          </div>

          <Separator />

          <MaterialReferencePicker
            value={referenceImage}
            onChange={setReferenceImage}
            hint="床・壁・外壁などの質感サンプル。CGの素材表現に反映します"
          />

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              任意プロンプト
            </p>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="例: warm oak flooring, soft morning light"
              className="text-sm resize-none h-20"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={status === "generating" || !uploadedImage}
            className="w-full"
            size="lg"
          >
            {status === "generating" ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">↻</span> 生成中...
              </span>
            ) : (
              "パースを生成"
            )}
          </Button>
        </>
      }
      historyPanel={
        <HistoryPanel
          history={history}
          onSelect={(item) => {
            setResultImage(item.url);
            if (item.beforeUrl) setUploadedImage(item.beforeUrl);
            setStatus("done");
          }}
          onClear={clearHistory}
          renderLabel={(params) => (
            <>
              {PROJECT_TYPES.find((t) => t.value === params.projectType)?.label}{" "}
              · {LIGHTINGS.find((l) => l.value === params.lighting)?.label}
            </>
          )}
        />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            入力（CG / スケッチ）
          </p>
          {!uploadedImage ? (
            <div
              className={`relative flex-1 min-h-64 rounded-xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/30"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <div className="text-4xl mb-3 opacity-30">⬆</div>
                <p className="text-sm font-medium">CG・スケッチをアップロード</p>
                <p className="text-xs mt-1 opacity-70">PNG · JPG · WEBP</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-2 min-h-64">
              <div className="flex flex-wrap items-center gap-1.5">
                {visibleParts.map((part) => (
                  <button
                    key={part}
                    type="button"
                    onClick={() => setActivePart(part)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activePart === part
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {PART_LABELS[part]}
                    {partFinishes[part] ? ` · ${finishLabel(part, partFinishes[part])}` : ""}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-h-64 rounded-xl border-2 border-border overflow-hidden bg-stone-50">
                <PartMaskCanvas
                  ref={maskCanvasRef}
                  imageSrc={uploadedImage}
                  activePart={activePart}
                  brushSize={brushSize[0]}
                  erase={erase}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={erase ? "outline" : "default"}
                  onClick={() => setErase(false)}
                >
                  ブラシ
                </Button>
                <Button
                  size="sm"
                  variant={erase ? "default" : "outline"}
                  onClick={() => setErase(true)}
                >
                  消しゴム
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => maskCanvasRef.current?.clearActive()}
                >
                  {PART_LABELS[activePart]}の塗りを消す
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  画像を変更
                </Button>
              </div>
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-xs text-muted-foreground">ブラシサイズ</span>
                  <span className="text-xs text-muted-foreground">{brushSize[0]}</span>
                </div>
                <Slider
                  value={brushSize}
                  onValueChange={(val) => {
                    const next = Array.isArray(val)
                      ? (val as number[])
                      : [val as number];
                    setBrushSize(next);
                  }}
                  min={8}
                  max={64}
                  step={2}
                  className="w-full"
                />
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            生成結果
          </p>
          <div className="relative flex-1 min-h-64 rounded-xl border-2 border-border overflow-hidden bg-stone-50">
            <ResultViewer
              status={status}
              beforeSrc={uploadedImage}
              afterSrc={resultImage}
              placeholderIcon="◈"
              emptyHint="ここに生成結果が表示されます"
              generatingLabel={generatingLabel}
              downloadFileNamePrefix="archirender"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">現在の設定:</span>
        <Badge variant="secondary" className="text-xs">
          {PROJECT_TYPES.find((t) => t.value === projectType)?.label}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {LIGHTINGS.find((l) => l.value === lighting)?.label}
        </Badge>
        <Badge variant="outline" className="text-xs">
          構造 {structureScale[0].toFixed(2)}
        </Badge>
        {visibleParts.map((part) => {
          const label = finishLabel(part, partFinishes[part]);
          if (!label) return null;
          return (
            <Badge key={part} variant="outline" className="text-xs">
              {PART_LABELS[part]} {label}
            </Badge>
          );
        })}
      </div>
    </ToolLayout>
  );
}
