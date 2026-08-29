"use client";

import { useRef, useState } from "react";
import { ActiveProjectSelect } from "@/components/active-project-select";
import { HistoryPanel } from "@/components/history-panel";
import { ResultViewer, type ResultStatus } from "@/components/result-viewer";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PromptRefineField } from "@/components/prompt-refine-field";
import { useHistory } from "@/hooks/use-history";
import { readApiJson } from "@/lib/api-client";
import {
  API_AUX_MAX_EDGE,
  prepareImageForApi,
} from "@/lib/resize-image";
import type { OriginalImageAspectRatio } from "@/lib/gemini-image";
import { toast } from "sonner";

interface ImageEntry {
  id: string;
  dataUrl: string;
  name: string;
}

interface HistoryParams {
  prompt: string;
  aspectRatio: OriginalImageAspectRatio;
}

const ASPECT_RATIOS: OriginalImageAspectRatio[] = [
  "1:1",
  "4:3",
  "3:2",
  "16:9",
  "9:16",
  "21:9",
];

export default function OriginalImagePage() {
  const [prompt, setPrompt] = useState("");
  const [baseImage, setBaseImage] = useState<ImageEntry | null>(null);
  const [refImages, setRefImages] = useState<ImageEntry[]>([]);
  const [aspectRatio, setAspectRatio] = useState<OriginalImageAspectRatio>("16:9");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [previousImageDataUrl, setPreviousImageDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ResultStatus>("idle");
  const baseInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const { history, addEntry, clearHistory } = useHistory<HistoryParams>("gemini");

  const addBaseImage = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBaseImage({ id: crypto.randomUUID(), dataUrl: reader.result as string, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const addRefImages = (files: FileList | null) => {
    if (!files) return;
    const available = Math.max(0, 4 - refImages.length);
    const selected = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, available);
    if (selected.length < files.length) {
      toast.info("参考画像は最大4枚です");
    }
    for (const file of selected) {
      const reader = new FileReader();
      reader.onload = () => {
        setRefImages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), dataUrl: reader.result as string, name: file.name },
        ].slice(0, 4));
      };
      reader.readAsDataURL(file);
    }
  };

  const isEditing = Boolean(previousImageDataUrl);

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("生成または修正の指示を入力してください");
      return;
    }
    setStatus("generating");
    try {
      const preparedBase = baseImage && !isEditing
        ? { dataUrl: await prepareImageForApi(baseImage.dataUrl, API_AUX_MAX_EDGE, 0.9), label: baseImage.name }
        : undefined;

      const preparedRefs = !isEditing
        ? await Promise.all(
            refImages.map(async (img) => ({
              dataUrl: await prepareImageForApi(img.dataUrl, API_AUX_MAX_EDGE, 0.9),
              label: img.name,
            }))
          )
        : undefined;

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          baseImage: preparedBase,
          referenceImages: preparedRefs,
          aspectRatio,
          previousImageDataUrl: previousImageDataUrl ?? undefined,
        }),
      });
      const data = await readApiJson<{ output: string }>(res);

      setResultImage(data.output);
      setPreviousImageDataUrl(data.output);
      setStatus("done");

      const beforeSrc = baseImage?.dataUrl;
      await addEntry(
        data.output,
        { prompt: prompt.trim(), aspectRatio },
        beforeSrc
      );
      toast.success(isEditing ? "画像を再編集しました" : "画像を生成しました");
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "画像生成に失敗しました");
    }
  };

  const startNew = () => {
    setPreviousImageDataUrl(null);
    setResultImage(null);
    setPrompt("");
    setStatus("idle");
  };

  return (
    <ToolLayout
      title="オリジナル画像生成"
      description="自由な画像生成・元画像をベースにした編集・会話による再編集"
      paramPanel={
        <>
          <ActiveProjectSelect />
          <Separator />
          <PromptRefineField
            mode="gemini"
            label="生成指示"
            value={prompt}
            onChange={setPrompt}
            placeholder={
              isEditing
                ? "例: 構図は変えず、夕方の暖かい光にしてください"
                : "例: 自然素材を使った現代的な住宅の外観パース"
            }
            hint={isEditing ? "前回の画像を引き継いで再編集します" : undefined}
            textareaClassName="h-28 resize-none"
            context={{
              hasBaseImage: Boolean(baseImage) || isEditing,
              hasMaterialRefs: refImages.length > 0,
            }}
            disabled={status === "generating"}
          />
          <Separator />
          {/* 元画像 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                元画像
              </p>
              <span className="text-xs text-muted-foreground">任意・1枚</span>
            </div>
            {baseImage ? (
              <div className="relative overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={baseImage.dataUrl} alt={baseImage.name} className="h-28 w-full object-cover" />
                {!isEditing && (
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-black/65 px-1.5 text-xs text-white"
                    onClick={() => setBaseImage(null)}
                  >
                    ×
                  </button>
                )}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => baseInputRef.current?.click()}
                disabled={isEditing}
              >
                元画像を追加
              </Button>
            )}
            <input
              ref={baseInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => addBaseImage(e.target.files)}
            />
          </div>
          <Separator />
          {/* 参考画像 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                参考画像
              </p>
              <span className="text-xs text-muted-foreground">{refImages.length}/4</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => refInputRef.current?.click()}
              disabled={refImages.length >= 4 || isEditing}
            >
              画像を追加
            </Button>
            <input
              ref={refInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addRefImages(e.target.files)}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {refImages.map((img) => (
                <div key={img.id} className="relative overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.dataUrl} alt={img.name} className="h-20 w-full object-cover" />
                  {!isEditing && (
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded bg-black/65 px-1.5 text-xs text-white"
                      onClick={() => setRefImages((prev) => prev.filter((i) => i.id !== img.id))}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <Separator />
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            縦横比
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as OriginalImageAspectRatio)}
              className="mt-2 h-9 w-full rounded-md border bg-background px-2 text-sm font-normal text-foreground"
            >
              {ASPECT_RATIOS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <Button onClick={generate} disabled={status === "generating"} className="w-full">
            {status === "generating"
              ? "生成中..."
              : isEditing
                ? "指示を反映"
                : "画像を生成"}
          </Button>
          {isEditing && (
            <Button variant="outline" onClick={startNew} className="w-full">
              新しい生成を開始
            </Button>
          )}
        </>
      }
      historyPanel={
        <HistoryPanel
          history={history}
          onSelect={(item) => {
            setResultImage(item.url);
            setStatus("done");
            setPreviousImageDataUrl(item.url);
            if (item.beforeUrl) {
              setBaseImage({ id: crypto.randomUUID(), dataUrl: item.beforeUrl, name: "復元画像" });
            } else {
              setBaseImage(null);
            }
          }}
          onClear={clearHistory}
          renderLabel={(params) => <>{params.aspectRatio}</>}
        />
      }
    >
      <div className="relative min-h-[32rem] flex-1 overflow-hidden rounded-xl border bg-stone-50">
        <ResultViewer
          status={status}
          beforeSrc={baseImage?.dataUrl}
          afterSrc={resultImage}
          placeholderIcon="✦"
          emptyHint="指示を入力すると、ここにオリジナル画像の生成結果が表示されます"
          generatingLabel="オリジナル画像を生成中..."
          generatingHint="生成には数十秒かかる場合があります"
          downloadFileNamePrefix="original"
        />
      </div>
    </ToolLayout>
  );
}
