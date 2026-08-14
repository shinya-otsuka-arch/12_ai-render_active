"use client";

import { useState, useRef } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { ResultViewer, type ResultStatus } from "@/components/result-viewer";
import { HistoryPanel } from "@/components/history-panel";
import { useHistory } from "@/hooks/use-history";
import { resizeDataUrl } from "@/lib/resize-image";
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
import { saveToActiveProjectIfSelected } from "@/lib/project-store";
import { toast } from "sonner";
import type { ProjectType, Lighting, Material } from "@/lib/prompt-builder";

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

const MATERIALS: { value: Material; label: string }[] = [
  { value: "concrete", label: "コンクリート" },
  { value: "wood", label: "木材" },
  { value: "tile", label: "タイル" },
  { value: "brick", label: "レンガ" },
  { value: "glass", label: "ガラス" },
  { value: "marble", label: "大理石" },
];

interface RenderHistoryParams {
  projectType: ProjectType;
  lighting: Lighting;
  materials: Material[];
  customPrompt?: string;
}

export default function RenderPage() {
  const [projectType, setProjectType] = useState<ProjectType>("interior");
  const [lighting, setLighting] = useState<Lighting>("daytime");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [strength, setStrength] = useState([0.75]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [houseStyle, setHouseStyle] = useState<HouseStyleSelection>(emptyHouseStyleSelection);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ResultStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);

  const { history, addEntry, clearHistory } = useHistory<RenderHistoryParams>(
    "archirender-history-render"
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleMaterial = (m: Material) => {
    setMaterials((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
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

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast.error("CGまたはスケッチ画像をアップロードしてください");
      return;
    }
    setStatus("generating");
    setResultImage(null);

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: uploadedImage,
          projectType,
          lighting,
          materials,
          strength: strength[0],
          customPrompt: customPrompt.trim() || undefined,
          referenceImage: referenceImage || undefined,
          ...houseStyleToApiFields(houseStyle),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "生成に失敗しました");
      }

      const data = await res.json();
      setResultImage(data.output);
      setStatus("done");
      const beforeUrl = await resizeDataUrl(uploadedImage);
      addEntry(
        data.output,
        {
          projectType,
          lighting,
          materials,
          customPrompt: customPrompt.trim() || undefined,
        },
        beforeUrl
      );
      await saveToActiveProjectIfSelected({
        mode: "render",
        afterUrl: data.output,
        beforeUrl: uploadedImage,
        params: {
          projectType,
          lighting,
          materials,
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
                  onClick={() => setProjectType(t.value)}
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
              素材（複数選択可）
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MATERIALS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => toggleMaterial(m.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    materials.includes(m.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                変換強度
              </p>
              <span className="text-xs text-muted-foreground">{strength[0].toFixed(2)}</span>
            </div>
            <Slider
              value={strength}
              onValueChange={(val) => {
                if (Array.isArray(val)) setStrength(val as number[]);
                else setStrength([val as number]);
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
              {PROJECT_TYPES.find((t) => t.value === params.projectType)?.label} ·{" "}
              {LIGHTINGS.find((l) => l.value === params.lighting)?.label}
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
            {uploadedImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={uploadedImage}
                alt="アップロード画像"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <div className="text-4xl mb-3 opacity-30">⬆</div>
                <p className="text-sm font-medium">CG・スケッチをアップロード</p>
                <p className="text-xs mt-1 opacity-70">PNG · JPG · WEBP</p>
              </div>
            )}
          </div>
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
              generatingLabel="レンダリング中..."
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
        {materials.map((m) => (
          <Badge key={m} variant="outline" className="text-xs">
            {MATERIALS.find((mat) => mat.value === m)?.label}
          </Badge>
        ))}
      </div>
    </ToolLayout>
  );
}
