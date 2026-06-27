"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type DrawMode = "brush" | "eraser";

export default function EditPage() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>("brush");
  const [brushSize, setBrushSize] = useState([24]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [hasMask, setHasMask] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const setupCanvas = useCallback((imageSrc: string) => {
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
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageSrc;
  }, []);

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
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const { x, y } = getPos(e);

    if (drawMode === "eraser") {
      // 消しゴム: 元の画像を復元
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const img = imageRef.current;
      if (img) {
        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;
        const r = brushSize[0];
        ctx.drawImage(
          img,
          (x - r) / scaleX,
          (y - r) / scaleY,
          (r * 2) / scaleX,
          (r * 2) / scaleY,
          x - r,
          y - r,
          r * 2,
          r * 2
        );
      }
      ctx.restore();
    } else {
      // ブラシ: 半透明の赤で塗る
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(239, 68, 68, 0.5)";
      ctx.beginPath();
      ctx.arc(x, y, brushSize[0], 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      setHasMask(true);
    }
  };

  const stopDraw = () => setIsDrawing(false);

  const clearMask = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || !imageRef.current) return;
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    setHasMask(false);
  };

  const getMaskDataUrl = (): string => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return "";

    // マスクキャンバス生成: 赤い部分 → 白、それ以外 → 黒
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return "";

    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return "";

    const displayData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
    const imgData = ctx.createImageData(canvas.width, canvas.height);

    // 元画像ピクセル取得
    const offImg = document.createElement("canvas");
    offImg.width = canvas.width;
    offImg.height = canvas.height;
    const offImgCtx = offImg.getContext("2d");
    offImgCtx?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const origData = offImgCtx?.getImageData(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < displayData.data.length; i += 4) {
      const dispR = displayData.data[i];
      const dispG = displayData.data[i + 1];
      const origR = origData?.data[i] ?? 0;
      const origG = origData?.data[i + 1] ?? 0;

      // 赤チャンネルが増加 & 緑が元と差がある = 塗られた部分
      const painted = dispR > origR + 30 && dispG < origG - 10;

      const v = painted ? 255 : 0;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
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
      toast.error("編集したい部分をブラシで塗ってください");
      return;
    }
    if (!prompt.trim()) {
      toast.error("変更内容を入力してください");
      return;
    }

    const mask = getMaskDataUrl();
    if (!mask) return;

    setIsGenerating(true);
    setResultImage(null);

    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadedImage, mask, prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "生成に失敗しました");
      }

      const data = await res.json();
      setResultImage(data.output);
      toast.success("画像の編集が完了しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement("a");
    a.href = resultImage;
    a.download = `edited-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Nav />

      <div className="flex flex-1 overflow-hidden">
        {/* 左パネル */}
        <aside className="w-64 shrink-0 border-r bg-white overflow-y-auto">
          <div className="p-4 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                使い方
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                <li>画像をアップロード</li>
                <li>変更したい箇所をブラシで塗る</li>
                <li>変更内容を入力</li>
                <li>生成ボタンを押す</li>
              </ol>
            </div>

            <Separator />

            {/* ブラシ設定 */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                ツール
              </p>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <button
                  onClick={() => setDrawMode("brush")}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    drawMode === "brush"
                      ? "bg-red-500 text-white"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  🖌 ブラシ
                </button>
                <button
                  onClick={() => setDrawMode("eraser")}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    drawMode === "eraser"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  ✕ 消しゴム
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">ブラシサイズ</Label>
                  <span className="text-xs text-muted-foreground">{brushSize[0]}px</span>
                </div>
                <Slider
                  value={brushSize}
                  onValueChange={(val) => {
                    if (Array.isArray(val)) setBrushSize(val as number[]);
                    else setBrushSize([val as number]);
                  }}
                  min={8}
                  max={80}
                  step={4}
                  className="w-full"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={clearMask}
                disabled={!uploadedImage}
                className="w-full mt-3"
              >
                マスクをリセット
              </Button>
            </div>

            <Separator />

            {/* 変更内容 */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                変更内容
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例: 白い大理石の壁&#10;例: 木製フローリング&#10;例: 大きな観葉植物"
                className="mt-2 text-sm resize-none h-24"
              />
              <p className="text-xs text-muted-foreground mt-1">
                塗った部分をどう変えるか日本語で入力
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !uploadedImage || !hasMask || !prompt.trim()}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">↻</span> 生成中...
                </span>
              ) : (
                "AI編集 →"
              )}
            </Button>
          </div>
        </aside>

        {/* メインコンテンツ */}
        <main className="flex-1 p-6 flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">AI画像編集</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                変更したい箇所を赤で塗って → 何に変えるか入力するだけ
              </p>
            </div>
            {resultImage && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                ダウンロード
              </Button>
            )}
          </div>

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
                className={`relative flex-1 min-h-64 rounded-xl border-2 overflow-hidden bg-stone-50 ${
                  uploadedImage ? "border-border" : "border-dashed border-border"
                }`}
              >
                {uploadedImage ? (
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full cursor-crosshair"
                    style={{ cursor: drawMode === "eraser" ? "cell" : "crosshair" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
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
                  {drawMode === "brush" ? "🖌 ブラシで変更したい部分を塗ってください" : "✕ 消しゴムでマスクを消去"}
                </p>
              )}
            </div>

            {/* 結果 */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                編集結果
              </p>
              <div className="relative flex-1 min-h-64 rounded-xl border-2 border-border overflow-hidden bg-stone-50">
                {isGenerating ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                    <p className="text-sm font-medium">AI編集中...</p>
                    <p className="text-xs mt-1 opacity-70">約20〜40秒かかります</p>
                  </div>
                ) : resultImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resultImage} alt="編集結果" className="w-full h-full object-contain" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <div className="text-4xl mb-3 opacity-20">◌</div>
                    <p className="text-sm opacity-50">編集結果がここに表示されます</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ヒント */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs text-blue-800 font-medium mb-1">💡 変更内容の入力例</p>
            <div className="flex flex-wrap gap-2">
              {["白い大理石の壁", "天然木のフローリング", "コンクリート打ち放し", "大きな窓", "観葉植物"].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-full transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
