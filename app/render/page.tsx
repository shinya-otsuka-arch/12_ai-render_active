"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import type { ProjectType, Style, Lighting, Material } from "@/lib/prompt-builder";

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "interior", label: "内観" },
  { value: "exterior", label: "外観" },
];

const STYLES: { value: Style; label: string; desc: string }[] = [
  { value: "realistic", label: "フォトリアル", desc: "写真品質" },
  { value: "modern", label: "モダン", desc: "直線・ミニマル" },
  { value: "japanese", label: "和風", desc: "侘び寂び" },
  { value: "minimalist", label: "ミニマリスト", desc: "余白重視" },
  { value: "industrial", label: "インダストリアル", desc: "素地感" },
  { value: "nordic", label: "北欧", desc: "ナチュラル" },
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

interface HistoryItem {
  id: string;
  url: string;
  params: {
    projectType: ProjectType;
    style: Style;
    lighting: Lighting;
    materials: Material[];
  };
  createdAt: string;
}

export default function RenderPage() {
  const [projectType, setProjectType] = useState<ProjectType>("interior");
  const [style, setStyle] = useState<Style>("realistic");
  const [lighting, setLighting] = useState<Lighting>("daytime");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [strength, setStrength] = useState([0.8]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("archirender-history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const saveToHistory = useCallback(
    (url: string) => {
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        url,
        params: { projectType, style, lighting, materials },
        createdAt: new Date().toISOString(),
      };
      const next = [item, ...history].slice(0, 20);
      setHistory(next);
      localStorage.setItem("archirender-history", JSON.stringify(next));
    },
    [projectType, style, lighting, materials, history]
  );

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
    reader.onload = (e) => setUploadedImage(e.target?.result as string);
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
    setIsGenerating(true);
    setResultImage(null);

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: uploadedImage,
          projectType,
          style,
          lighting,
          materials,
          strength: strength[0],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "生成に失敗しました");
      }

      const data = await res.json();
      setResultImage(data.output);
      saveToHistory(data.output);
      toast.success("レンダリングが完成しました");
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
    a.download = `archirender-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Nav />

      <div className="flex flex-1 overflow-hidden">
        {/* 左パネル: パラメータ */}
        <aside className="w-64 shrink-0 border-r bg-white overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Project Type */}
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

            {/* Style */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                スタイル
              </p>
              <div className="space-y-1">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                      style === s.value
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground"
                    }`}
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className={`text-xs ${style === s.value ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {s.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Lighting */}
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

            {/* Materials */}
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

            {/* Strength */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  変換強度
                </p>
                <span className="text-xs text-muted-foreground">{strength[0].toFixed(1)}</span>
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

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !uploadedImage}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">↻</span> 生成中...
                </span>
              ) : (
                "Generate →"
              )}
            </Button>
          </div>
        </aside>

        {/* 中央: 画像アップロード・結果 */}
        <main className="flex-1 flex flex-col min-w-0 p-6 gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">AIパース生成</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                画像をアップロードしてパラメータを選択するだけ
              </p>
            </div>
            {resultImage && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                ダウンロード
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
            {/* アップロードゾーン */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">入力画像</p>
              <div
                className={`relative flex-1 min-h-64 rounded-xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/30"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
                    <p className="text-sm font-medium">クリックまたはドラッグで画像をアップロード</p>
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

            {/* 結果 */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">生成結果</p>
              <div className="relative flex-1 min-h-64 rounded-xl border-2 border-border overflow-hidden bg-stone-50">
                {isGenerating ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                    <p className="text-sm font-medium">レンダリング中...</p>
                    <p className="text-xs mt-1 opacity-70">約30〜60秒かかります</p>
                  </div>
                ) : resultImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resultImage}
                    alt="生成結果"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <div className="text-4xl mb-3 opacity-20">◈</div>
                    <p className="text-sm opacity-50">ここに生成結果が表示されます</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 生成設定サマリー */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground">現在の設定:</span>
            <Badge variant="secondary" className="text-xs">
              {PROJECT_TYPES.find((t) => t.value === projectType)?.label}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {STYLES.find((s) => s.value === style)?.label}
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
        </main>

        {/* 右: 履歴 */}
        <aside className="w-48 shrink-0 border-l bg-white overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              履歴
            </p>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-8 opacity-60">
                生成履歴がありません
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setResultImage(item.url)}
                    className="w-full rounded-lg overflow-hidden border border-border hover:border-primary transition-colors group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt="履歴"
                      className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity"
                    />
                    <div className="p-1.5 text-left">
                      <p className="text-xs text-muted-foreground truncate">
                        {STYLES.find((s) => s.value === item.params.style)?.label} ·{" "}
                        {LIGHTINGS.find((l) => l.value === item.params.lighting)?.label}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
