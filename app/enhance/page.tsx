"use client";

import { useState, useRef } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { ResultViewer, type ResultStatus } from "@/components/result-viewer";
import { HistoryPanel } from "@/components/history-panel";
import { useHistory } from "@/hooks/use-history";
import { withFittedApiImages } from "@/lib/resize-image";
import { readApiJson } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ActiveProjectSelect } from "@/components/active-project-select";
import { MaterialSearchAssistant } from "@/components/material-search-assistant";
import { toast } from "sonner";

interface EnhanceHistoryParams {
  creativity: number;
  resemblance: number;
  scaleFactor: number;
  preset?: string;
}

export default function EnhancePage() {
  const [creativity, setCreativity] = useState([0.35]);
  const [resemblance, setResemblance] = useState([0.6]);
  const [scaleFactor, setScaleFactor] = useState<2 | 4>(2);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ResultStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const { history, addEntry, clearHistory } =
    useHistory<EnhanceHistoryParams>("enhance");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyPreset = (preset: "draft" | "resolve") => {
    if (preset === "draft") {
      setCreativity([0.65]);
      setResemblance([0.45]);
      setActivePreset("下書きを高品質化");
    } else {
      setCreativity([0.3]);
      setResemblance([1.0]);
      setActivePreset("解像度だけ上げる");
    }
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
      toast.error("完成パースをアップロードしてください");
      return;
    }
    setStatus("generating");
    setResultImage(null);

    try {
      const body = await withFittedApiImages(
        { primary: uploadedImage },
        ({ primary }) => ({
          image: primary,
          creativity: creativity[0],
          resemblance: resemblance[0],
          scaleFactor,
        })
      );

      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await readApiJson<{ output: string }>(res);
      setResultImage(data.output);
      setStatus("done");
      await addEntry(
        data.output,
        {
          creativity: creativity[0],
          resemblance: resemblance[0],
          scaleFactor,
          preset: activePreset ?? undefined,
        },
        uploadedImage
      );
      toast.success("高品質化が完成しました");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  return (
    <ToolLayout
      title="AI高品質化"
      description="完成パース → 高品質化・高解像度化"
      paramPanel={
        <>
          <ActiveProjectSelect />

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              入力について
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              CG下書きから AI 生成結果まで、完成パース全般の仕上げに使えます。
            </p>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              プリセット
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={() => applyPreset("draft")}
                className={`rounded-md px-3 py-2 text-sm text-left transition-colors ${
                  activePreset === "下書きを高品質化"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                <span className="font-medium">下書きを高品質化</span>
                <span className="block text-xs opacity-70 mt-0.5">
                  creativity高め / resemblance低め
                </span>
              </button>
              <button
                onClick={() => applyPreset("resolve")}
                className={`rounded-md px-3 py-2 text-sm text-left transition-colors ${
                  activePreset === "解像度だけ上げる"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                <span className="font-medium">解像度だけ上げる</span>
                <span className="block text-xs opacity-70 mt-0.5">
                  creativity低め / resemblance高め
                </span>
              </button>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Creativity
              </p>
              <span className="text-xs text-muted-foreground">
                {creativity[0].toFixed(2)}
              </span>
            </div>
            <Slider
              value={creativity}
              onValueChange={(val) => {
                setActivePreset(null);
                if (Array.isArray(val)) setCreativity(val as number[]);
                else setCreativity([val as number]);
              }}
              min={0.3}
              max={0.9}
              step={0.05}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">忠実</span>
              <span className="text-xs text-muted-foreground">創造的</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Resemblance
              </p>
              <span className="text-xs text-muted-foreground">
                {resemblance[0].toFixed(2)}
              </span>
            </div>
            <Slider
              value={resemblance}
              onValueChange={(val) => {
                setActivePreset(null);
                if (Array.isArray(val)) setResemblance(val as number[]);
                else setResemblance([val as number]);
              }}
              min={0.3}
              max={1.6}
              step={0.05}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">変化可</span>
              <span className="text-xs text-muted-foreground">構造保持</span>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              スケール倍率
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {([2, 4] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScaleFactor(s)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    scaleFactor === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={status === "generating" || !uploadedImage}
            className="w-full"
            size="lg"
          >
            {status === "generating" ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">↻</span> 処理中...
              </span>
            ) : (
              "高品質化する"
            )}
          </Button>
        </>
      }
      historyPanel={
        <HistoryPanel
          history={history}
          onSelect={(item) => {
            setResultImage(item.url);
            setUploadedImage(item.beforeUrl ?? null);
            setStatus("done");
          }}
          onClear={clearHistory}
          renderLabel={(params) => (
            <>
              {params.scaleFactor}x · C{params.creativity.toFixed(2)} · R
              {params.resemblance.toFixed(2)}
            </>
          )}
        />
      }
      materialAssistant={
        <MaterialSearchAssistant mode="建築パースの高品質化参考" />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            入力（完成パース）
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
                <p className="text-sm font-medium">完成パースをアップロード</p>
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
            高品質化結果
          </p>
          <div className="relative flex-1 min-h-64 rounded-xl border-2 border-border overflow-hidden bg-stone-50">
            <ResultViewer
              status={status}
              beforeSrc={uploadedImage}
              afterSrc={resultImage}
              placeholderIcon="◎"
              emptyHint="ここに高品質化結果が表示されます"
              generatingLabel="アップスケール中..."
              generatingHint="解像度によっては1分以上かかることがあります"
              downloadFileNamePrefix="enhance"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">現在の設定:</span>
        <Badge variant="secondary" className="text-xs">
          {scaleFactor}x
        </Badge>
        <Badge variant="secondary" className="text-xs">
          C {creativity[0].toFixed(2)}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          R {resemblance[0].toFixed(2)}
        </Badge>
        {activePreset && (
          <Badge variant="outline" className="text-xs">
            {activePreset}
          </Badge>
        )}
      </div>
    </ToolLayout>
  );
}
