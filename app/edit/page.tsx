"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { ResultViewer, type ResultStatus } from "@/components/result-viewer";
import { HistoryPanel } from "@/components/history-panel";
import { useHistory } from "@/hooks/use-history";
import {
  resizeDataUrl,
  preparePngForApi,
  prepareImageForApi,
  API_PRIMARY_MAX_EDGE,
  API_AUX_MAX_EDGE,
  API_PAYLOAD_BUDGET,
} from "@/lib/resize-image";
import { readApiJson } from "@/lib/api-client";
import { outputsFromResponse } from "@/lib/variant-outputs";
import { Button } from "@/components/ui/button";
import { PromptRefineField } from "@/components/prompt-refine-field";
import { Separator } from "@/components/ui/separator";
import { MaterialReferencePicker } from "@/components/material-reference-picker";
import { ActiveProjectSelect } from "@/components/active-project-select";
import { MaterialSearchAssistant } from "@/components/material-search-assistant";
import { saveToActiveProjectIfSelected } from "@/lib/project-store";
import {
  fillShape,
  MASK_SHAPE_TOOLS,
  strokeShapePreview,
  type MaskPoint,
  type MaskShapeTool,
} from "@/lib/mask-shapes";
import { toast } from "sonner";

interface EditHistoryParams {
  prompt: string;
}

export default function EditPage() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState(0);
  const [status, setStatus] = useState<ResultStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [maskTool, setMaskTool] = useState<MaskShapeTool>("rect");
  const [erase, setErase] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [hasMask, setHasMask] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const { history, addEntry, clearHistory } = useHistory<EditHistoryParams>(
    "archirender-history-edit"
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const maskLayerRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<MaskPoint>({ x: 0, y: 0 });
  const currentRef = useRef<{ end: MaskPoint; points: MaskPoint[] } | null>(null);

  const layerHasPaint = (layer: HTMLCanvasElement | null) => {
    if (!layer) return false;
    const ctx = layer.getContext("2d");
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, layer.width, layer.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  };

  const redrawDisplay = useCallback(
    (preview?: { end: MaskPoint; points: MaskPoint[] } | null) => {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const layer = maskLayerRef.current;
      if (layer && layerHasPaint(layer)) {
        const tint = document.createElement("canvas");
        tint.width = canvas.width;
        tint.height = canvas.height;
        const tctx = tint.getContext("2d");
        if (tctx) {
          tctx.drawImage(layer, 0, 0);
          tctx.globalCompositeOperation = "source-in";
          tctx.fillStyle = "rgba(239, 68, 68, 0.45)";
          tctx.fillRect(0, 0, tint.width, tint.height);
          ctx.drawImage(tint, 0, 0);
        }
      }
      if (preview) {
        strokeShapePreview(
          ctx,
          maskTool,
          startRef.current,
          preview.end,
          preview.points
        );
      }
    },
    [maskTool]
  );

  const setupCanvas = useCallback(
    (imageSrc: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        const container = containerRef.current;
        const maxW = container?.clientWidth ?? 600;
        const maxH = container?.clientHeight ?? 500;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const layer = document.createElement("canvas");
        layer.width = canvas.width;
        layer.height = canvas.height;
        maskLayerRef.current = layer;
        setHasMask(false);
        redrawDisplay();
      };
      img.src = imageSrc;
    },
    [redrawDisplay]
  );

  useEffect(() => {
    if (uploadedImage) setupCanvas(uploadedImage);
  }, [uploadedImage, setupCanvas]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      if (!t) return { x: 0, y: 0 };
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const pos = getPos(e);
    drawingRef.current = true;
    startRef.current = pos;
    currentRef.current = { end: pos, points: [pos] };
    redrawDisplay(currentRef.current);
  };

  const moveDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!drawingRef.current || !currentRef.current) return;
    const pos = getPos(e);
    const points =
      maskTool === "lasso" ? [...currentRef.current.points, pos] : currentRef.current.points;
    currentRef.current = { end: pos, points };
    redrawDisplay(currentRef.current);
  };

  const endDraw = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    const layer = maskLayerRef.current;
    const current = currentRef.current;
    currentRef.current = null;
    if (!canvas || !layer || !current) {
      redrawDisplay();
      return;
    }
    const ctx = layer.getContext("2d");
    if (!ctx) return;
    fillShape(ctx, maskTool, startRef.current, current.end, current.points, {
      erase,
      fillStyle: "rgba(255,255,255,1)",
    });
    setHasMask(layerHasPaint(layer));
    redrawDisplay();
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    moveDraw(e);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    startDraw(e);
  };

  const clearMask = () => {
    const canvas = canvasRef.current;
    const layer = maskLayerRef.current;
    if (!canvas || !layer) return;
    const ctx = layer.getContext("2d");
    ctx?.clearRect(0, 0, layer.width, layer.height);
    setHasMask(false);
    redrawDisplay();
  };

  const getMaskDataUrl = (): string => {
    const layer = maskLayerRef.current;
    if (!layer) return "";
    const offscreen = document.createElement("canvas");
    offscreen.width = layer.width;
    offscreen.height = layer.height;
    const ctx = offscreen.getContext("2d");
    const src = layer.getContext("2d")?.getImageData(0, 0, layer.width, layer.height);
    if (!ctx || !src) return "";
    const imgData = ctx.createImageData(layer.width, layer.height);
    for (let i = 0; i < src.data.length; i += 4) {
      const painted = src.data[i + 3] > 0;
      imgData.data[i] = 255;
      imgData.data[i + 1] = 255;
      imgData.data[i + 2] = 255;
      imgData.data[i + 3] = painted ? 0 : 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return offscreen.toDataURL("image/png");
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
      setHasMask(false);
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
      toast.error("画像をアップロードしてください");
      return;
    }
    if (!hasMask) {
      toast.error("編集したい部分を範囲で囲んでください");
      return;
    }
    if (!prompt.trim() && !referenceImage) {
      toast.error("変更内容を入力するか、参考素材を読み込んでください");
      return;
    }

    const mask = getMaskDataUrl();
    if (!mask) return;

    // OpenAI images.edit は PNG のみ対応のため、元画像をキャンバス経由で PNG に変換
    const cleanImagePng = (() => {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return uploadedImage;
      const off = document.createElement("canvas");
      off.width = canvas.width;
      off.height = canvas.height;
      off.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      return off.toDataURL("image/png");
    })();

    setStatus("generating");
    setResultImage(null);
    setCandidates([]);
    setSelectedCandidate(0);

    const editPrompt =
      prompt.trim() ||
      "apply the material and texture from the reference sample to the masked area";

    try {
      // OpenAI images.edit は PNG 必須。透過マスクも PNG。予算内になるまで長辺を下げる。
      const edgeSteps = [API_PRIMARY_MAX_EDGE, 1536, 1280, 1024];
      let body:
        | {
            image: string;
            mask: string;
            prompt: string;
            referenceImage?: string;
          }
        | undefined;

      for (const edge of edgeSteps) {
        const image = await preparePngForApi(cleanImagePng, edge);
        const maskPrepared = await preparePngForApi(mask, edge);
        const reference = referenceImage
          ? await prepareImageForApi(
              referenceImage,
              Math.min(edge, API_AUX_MAX_EDGE),
              0.85
            )
          : undefined;
        const candidate = {
          image,
          mask: maskPrepared,
          prompt: editPrompt,
          referenceImage: reference,
        };
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

      const data = await readApiJson<{ output: string; outputs?: string[] }>(res);
      const outputs = outputsFromResponse(data);
      const output = outputs[0];
      if (!output) throw new Error("画像生成に失敗しました");
      setCandidates(outputs);
      setSelectedCandidate(0);
      setResultImage(output);
      setStatus("done");
      const beforeUrl = await resizeDataUrl(uploadedImage);
      addEntry(output, { prompt: editPrompt }, beforeUrl);
      await saveToActiveProjectIfSelected({
        mode: "edit",
        afterUrl: output,
        beforeUrl: uploadedImage,
        params: { prompt: editPrompt },
      });
      toast.success("画像の編集が完了しました");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  return (
    <ToolLayout
      title="AI編集"
      description="変更したい箇所を範囲で囲んで → 何に変えるか入力するだけ"
      paramPanel={
        <>
          <ActiveProjectSelect />

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              使い方
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
              <li>画像をアップロード</li>
              <li>変更したい箇所を範囲で囲む</li>
              <li>変更内容を入力</li>
              <li>生成ボタンを押す</li>
            </ol>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              ツール
            </p>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {MASK_SHAPE_TOOLS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setMaskTool(item.value)}
                  className={`rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                    maskTool === item.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              <button
                onClick={() => setErase(false)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  !erase
                    ? "bg-red-500 text-white"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                追加
              </button>
              <button
                onClick={() => setErase(true)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  erase
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                削除
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clearMask}
              disabled={!uploadedImage}
              className="w-full"
            >
              範囲を消す
            </Button>
          </div>

          <Separator />

          <MaterialReferencePicker
            value={referenceImage}
            onChange={setReferenceImage}
            hint="囲んだ範囲に、この素材の質感を適用します"
          />

          <Separator />

          <PromptRefineField
            mode="edit"
            label="変更内容"
            value={prompt}
            onChange={setPrompt}
            placeholder={"例: 白い大理石の壁\n例: 木製フローリング\n例: 大きな観葉植物"}
            hint="囲んだ部分をどう変えるか日本語で入力"
            textareaClassName="text-sm resize-none h-24"
            context={{
              hasBaseImage: Boolean(uploadedImage),
              hasMask,
              hasMaterialRefs: Boolean(referenceImage),
            }}
            disabled={status === "generating"}
          />

          <Button
            onClick={handleGenerate}
            disabled={
              status === "generating" ||
              !uploadedImage ||
              !hasMask ||
              (!prompt.trim() && !referenceImage)
            }
            className="w-full"
            size="lg"
          >
            {status === "generating" ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">↻</span> 生成中...
              </span>
            ) : (
              "編集する"
            )}
          </Button>
        </>
      }
      historyPanel={
        <HistoryPanel
          history={history}
          onSelect={(item) => {
            setResultImage(item.url);
            setCandidates([item.url]);
            setSelectedCandidate(0);
            if (item.beforeUrl) setUploadedImage(item.beforeUrl);
            setStatus("done");
          }}
          onClear={clearHistory}
          renderLabel={(params) => <>{params.prompt}</>}
        />
      }
      materialAssistant={
        <MaterialSearchAssistant
          mode="建築画像の部分編集"
          onUseMaterial={setReferenceImage}
        />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {/* キャンバス (マスク描画) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              編集エリア
            </p>
            {hasMask && (
              <span className="text-xs text-red-500 font-medium">● マスク設定済み</span>
            )}
          </div>
          <div
            ref={containerRef}
            className={`relative flex-1 min-h-64 rounded-xl border-2 overflow-hidden bg-stone-50 dark:bg-card ${
              uploadedImage ? "border-border" : "border-dashed border-border"
            }`}
          >
            {uploadedImage ? (
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full touch-none cursor-crosshair"
                style={{ cursor: erase ? "cell" : "crosshair" }}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={endDraw}
              />
            ) : (
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragging ? "bg-primary/5" : ""
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="text-4xl mb-3 opacity-30">⬆</div>
                <p className="text-sm font-medium text-muted-foreground">画像をアップロード</p>
                <p className="text-xs mt-1 opacity-70 text-muted-foreground">PNG · JPG · WEBP</p>
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
          {uploadedImage && (
            <p className="text-xs text-muted-foreground text-center">
              {erase
                ? "囲んだ範囲のマスクを消します"
                : "変更したい部分を四角・丸・自由曲線で囲んでください"}
            </p>
          )}
        </div>

        {/* 結果 */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            編集結果
          </p>
          <div className="relative flex-1 min-h-64 rounded-xl border-2 border-border overflow-hidden bg-stone-50 dark:bg-card">
            <ResultViewer
              status={status}
              beforeSrc={uploadedImage}
              afterSrc={resultImage}
              candidates={candidates}
              selectedCandidate={selectedCandidate}
              onSelectCandidate={(index) => {
                const next = candidates[index];
                if (!next) return;
                setSelectedCandidate(index);
                setResultImage(next);
              }}
              placeholderIcon="◌"
              emptyHint="編集結果がここに表示されます"
              generatingLabel="編集中..."
              generatingHint="候補を3枚生成します。1〜2分かかることがあります"
              downloadFileNamePrefix="edited"
            />
          </div>
        </div>
      </div>

      {/* ヒント */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3">
        <p className="text-xs text-blue-800 dark:text-blue-300 font-medium mb-1">💡 変更内容の入力例</p>
        <div className="flex flex-wrap gap-2">
          {["白い大理石の壁", "天然木のフローリング", "コンクリート打ち放し", "大きな窓", "観葉植物"].map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="text-xs bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </ToolLayout>
  );
}
