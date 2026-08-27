"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DownloadIcon, MoveHorizontalIcon } from "lucide-react";

export type ResultStatus = "idle" | "generating" | "done" | "error";

interface ResultViewerProps {
  status: ResultStatus;
  beforeSrc?: string | null;
  afterSrc?: string | null;
  candidates?: string[];
  selectedCandidate?: number;
  onSelectCandidate?: (index: number) => void;
  placeholderIcon?: React.ReactNode;
  emptyHint?: string;
  generatingLabel?: string;
  generatingHint?: string;
  errorMessage?: string;
  downloadFileNamePrefix?: string;
}

function BeforeAfterSlider({ beforeSrc, afterSrc }: { beforeSrc: string; afterSrc: string }) {
  const [pos, setPos] = useState(50);

  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterSrc} alt="生成結果" className="absolute inset-0 h-full w-full object-contain" />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeSrc} alt="元画像" className="absolute inset-0 h-full w-full object-contain" />
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 flex items-center"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
      >
        <div className="h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
        <div className="absolute flex size-7 items-center justify-center rounded-full bg-white shadow-md">
          <MoveHorizontalIcon className="size-4 text-foreground" />
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="ビフォーアフター比較スライダー"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />

      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
        Before
      </span>
      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
        After
      </span>
    </div>
  );
}

function CandidateStrip({
  candidates,
  selectedCandidate,
  onSelectCandidate,
}: {
  candidates: string[];
  selectedCandidate: number;
  onSelectCandidate?: (index: number) => void;
}) {
  if (candidates.length < 2) return null;
  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto border-t bg-background/80 px-2 py-2">
      {candidates.map((src, index) => (
        <button
          key={`${index}-${src.slice(0, 24)}`}
          type="button"
          onClick={() => onSelectCandidate?.(index)}
          className={`relative size-14 shrink-0 overflow-hidden rounded-md border-2 ${
            index === selectedCandidate
              ? "border-primary"
              : "border-transparent hover:border-border"
          }`}
          aria-label={`候補${index + 1}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`候補${index + 1}`} className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

export function ResultViewer({
  status,
  beforeSrc,
  afterSrc,
  candidates,
  selectedCandidate = 0,
  onSelectCandidate,
  placeholderIcon,
  emptyHint = "ここに生成結果が表示されます",
  generatingLabel = "生成中...",
  generatingHint = "約30〜60秒かかります",
  errorMessage = "生成に失敗しました",
  downloadFileNamePrefix = "result",
}: ResultViewerProps) {
  const handleDownload = () => {
    if (!afterSrc) return;
    const a = document.createElement("a");
    a.href = afterSrc;
    a.download = `${downloadFileNamePrefix}-${Date.now()}.png`;
    a.click();
  };

  if (status === "generating") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
        <div className="mb-4 size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-medium">{generatingLabel}</p>
        <p className="mt-1 text-xs opacity-70">{generatingHint}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
        <div className="mb-3 text-4xl opacity-30">!</div>
        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
      </div>
    );
  }

  if (status === "done" && afterSrc) {
    if (beforeSrc) {
      return (
        <Tabs defaultValue="compare" className="absolute inset-0 flex flex-col gap-0">
          <div className="flex items-center justify-between border-b bg-background/80 px-2 py-1.5">
            <TabsList>
              <TabsTrigger value="compare">比較</TabsTrigger>
              <TabsTrigger value="after">結果のみ</TabsTrigger>
              <TabsTrigger value="before">元画像</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <DownloadIcon />
              ダウンロード
            </Button>
          </div>
          <TabsContent value="compare" className="relative flex-1">
            <BeforeAfterSlider beforeSrc={beforeSrc} afterSrc={afterSrc} />
          </TabsContent>
          <TabsContent value="after" className="relative flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={afterSrc} alt="生成結果" className="absolute inset-0 h-full w-full object-contain" />
          </TabsContent>
          <TabsContent value="before" className="relative flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={beforeSrc} alt="元画像" className="absolute inset-0 h-full w-full object-contain" />
          </TabsContent>
          <CandidateStrip
            candidates={candidates ?? [afterSrc]}
            selectedCandidate={selectedCandidate}
            onSelectCandidate={onSelectCandidate}
          />
        </Tabs>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col">
        <div className="flex items-center justify-end border-b bg-background/80 px-2 py-1.5">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <DownloadIcon />
            ダウンロード
          </Button>
        </div>
        <div className="relative flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterSrc} alt="生成結果" className="absolute inset-0 h-full w-full object-contain" />
        </div>
        <CandidateStrip
          candidates={candidates ?? [afterSrc]}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={onSelectCandidate}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
      <div className="mb-3 text-4xl opacity-20">{placeholderIcon ?? "◈"}</div>
      <p className="text-sm opacity-50">{emptyHint}</p>
    </div>
  );
}
