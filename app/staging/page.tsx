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
import { MaterialReferencePicker } from "@/components/material-reference-picker";
import { ActiveProjectSelect } from "@/components/active-project-select";
import { saveToActiveProjectIfSelected } from "@/lib/project-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const ROOM_TYPES = [
  { value: "living room", label: "リビング" },
  { value: "bedroom", label: "寝室" },
  { value: "kitchen", label: "キッチン" },
  { value: "dining room", label: "ダイニング" },
  { value: "office", label: "書斎・オフィス" },
  { value: "bathroom", label: "バスルーム" },
];

const STYLES = [
  { value: "modern", label: "モダン", desc: "シンプル・直線" },
  { value: "scandinavian", label: "北欧", desc: "ナチュラル・温かみ" },
  { value: "japanese", label: "和モダン", desc: "侘び寂び" },
  { value: "luxury", label: "ラグジュアリー", desc: "高級感" },
  { value: "industrial", label: "インダストリアル", desc: "素地感" },
];

interface StagingHistoryParams {
  roomType: string;
  style: string;
}

export default function StagingPage() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ResultStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [roomType, setRoomType] = useState("living room");
  const [style, setStyle] = useState("modern");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const { history, addEntry, clearHistory } = useHistory<StagingHistoryParams>(
    "archirender-history-staging"
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast.error("空室の写真をアップロードしてください");
      return;
    }
    setStatus("generating");
    setResultImage(null);

    try {
      const res = await fetch("/api/staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: uploadedImage,
          style,
          roomType,
          referenceImage: referenceImage || undefined,
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
      addEntry(data.output, { roomType, style }, beforeUrl);
      await saveToActiveProjectIfSelected({
        mode: "staging",
        afterUrl: data.output,
        beforeUrl: uploadedImage,
        params: { roomType, style },
      });
      toast.success("ステージングが完成しました");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  return (
    <ToolLayout
      title="AIステージング"
      description="空室写真 → 部屋タイプ・スタイルを選択 → 家具を自動配置"
      paramPanel={
        <>
          <ActiveProjectSelect />

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              AIステージングとは
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              空室の写真に家具・インテリアを自動配置します。不動産・インテリアの提案資料を瞬時に作成。
            </p>
          </div>

          <Separator />

          {/* 部屋タイプ */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              部屋タイプ
            </p>
            <Select value={roomType} onValueChange={(v) => setRoomType(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* スタイル */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              インテリアスタイル
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

          <MaterialReferencePicker
            value={referenceImage}
            onChange={setReferenceImage}
            hint="家具・ファブリック・床材などの雰囲気サンプル。部屋全体の質感に反映します"
          />

          <Separator />

          {/* 現在の設定 */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              設定サマリー
            </p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">
                {ROOM_TYPES.find((r) => r.value === roomType)?.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {STYLES.find((s) => s.value === style)?.label}
              </Badge>
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
                <span className="animate-spin">↻</span> 生成中...
              </span>
            ) : (
              "ステージングする"
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
              {ROOM_TYPES.find((r) => r.value === params.roomType)?.label} ·{" "}
              {STYLES.find((s) => s.value === params.style)?.label}
            </>
          )}
        />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {/* アップロード */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            空室の写真
          </p>
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
              <img src={uploadedImage} alt="アップロード" className="w-full h-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <div className="text-4xl mb-3 opacity-30">⬆</div>
                <p className="text-sm font-medium">空室の写真をアップロード</p>
                <p className="text-xs mt-1 opacity-70">PNG · JPG · WEBP</p>
                <div className="mt-4 text-xs text-center opacity-50 max-w-40 leading-relaxed">
                  家具のない室内写真を使うと効果的です
                </div>
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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            ステージング結果
          </p>
          <div className="relative flex-1 min-h-64 rounded-xl border-2 border-border overflow-hidden bg-stone-50 dark:bg-card">
            <ResultViewer
              status={status}
              beforeSrc={uploadedImage}
              afterSrc={resultImage}
              placeholderIcon="◉"
              emptyHint="家具が自動配置されたビジュアルが表示されます"
              generatingLabel="家具を配置中..."
              downloadFileNamePrefix="staging"
            />
          </div>
        </div>
      </div>

      {/* ヒント */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-1">💡 効果的な使い方</p>
        <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside">
          <li>家具のない空室・空きオフィスの写真を使うとより効果的です</li>
          <li>明るく撮影した写真（昼間・照明あり）が最適です</li>
          <li>正面から撮影した写真でより自然な結果が得られます</li>
        </ul>
      </div>
    </ToolLayout>
  );
}
