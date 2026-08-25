"use client";

import { useState } from "react";
import { ExternalLinkIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readApiJson } from "@/lib/api-client";
import { toast } from "sonner";

interface MaterialSearchResult {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  source: string;
  width?: number;
  height?: number;
  reuseFiltered: boolean;
}

interface MaterialSearchAssistantProps {
  mode: string;
  onUseMaterial?: (dataUrl: string) => void;
  onUseStyle?: (dataUrl: string) => void;
}

export function MaterialSearchAssistant({
  mode,
  onUseMaterial,
  onUseStyle,
}: MaterialSearchAssistantProps) {
  const [query, setQuery] = useState("");
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [reuseOnly, setReuseOnly] = useState(true);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [results, setResults] = useState<MaterialSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) {
      toast.error("探したい素材を入力してください");
      return;
    }
    setLoading(true);
    setRightsConfirmed(false);
    try {
      const response = await fetch("/api/material-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), mode, reuseOnly }),
      });
      const data = await readApiJson<{
        query: string;
        results: MaterialSearchResult[];
      }>(response);
      setResolvedQuery(data.query);
      setResults(data.results);
      if (data.results.length === 0) toast.info("画像候補が見つかりませんでした");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "画像検索に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const importImage = async (
    result: MaterialSearchResult,
    target: "material" | "style"
  ) => {
    if (!rightsConfirmed) {
      toast.error("掲載元を開き、利用条件を確認してください");
      return;
    }
    setImportingId(result.id);
    try {
      const response = await fetch("/api/material-search/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: result.imageUrl,
          rightsConfirmed: true,
        }),
      });
      const data = await readApiJson<{ dataUrl: string }>(response);
      if (target === "material") onUseMaterial?.(data.dataUrl);
      else onUseStyle?.(data.dataUrl);
      toast.success(target === "material" ? "素材参考に設定しました" : "作風参考に設定しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "画像の取込に失敗しました");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold">AI素材検索</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          欲しい素材を日本語で相談すると、AIが画像検索向けの言葉に整理します。
        </p>
      </div>
      <Textarea
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="例: 節が少ない明るいオーク材の床、自然な艶消し"
        className="h-24 resize-none"
      />
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={reuseOnly}
          onChange={(event) => setReuseOnly(event.target.checked)}
          className="mt-0.5"
        />
        再利用・改変可能として検索サービスに分類された画像だけを表示
      </label>
      <Button onClick={search} disabled={loading} className="w-full">
        <SearchIcon className="mr-2 size-4" />
        {loading ? "検索中..." : "画像を検索"}
      </Button>
      {resolvedQuery && (
        <p className="rounded-md bg-muted p-2 text-xs">
          検索語: {resolvedQuery}
        </p>
      )}
      {results.length > 0 && (
        <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(event) => setRightsConfirmed(event.target.checked)}
            className="mt-0.5"
          />
          各画像の掲載元を開き、今回の参考利用が許可されていることを確認しました
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        {results.map((result) => (
          <article key={result.id} className="overflow-hidden rounded-lg border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.thumbnailUrl}
              alt={result.title}
              className="h-28 w-full bg-muted object-cover"
              loading="lazy"
            />
            <div className="space-y-2 p-2">
              <p className="line-clamp-2 text-xs font-medium">{result.title}</p>
              <a
                href={result.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 truncate text-xs text-primary underline"
              >
                {result.source}
                <ExternalLinkIcon className="size-3 shrink-0" />
              </a>
              {result.width && result.height && (
                <p className="text-[11px] text-muted-foreground">
                  {result.width} × {result.height}
                </p>
              )}
              <div className="space-y-1">
                {onUseMaterial && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-xs"
                    disabled={!rightsConfirmed || importingId === result.id}
                    onClick={() => importImage(result, "material")}
                  >
                    素材参考に使う
                  </Button>
                )}
                {onUseStyle && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-xs"
                    disabled={!rightsConfirmed || importingId === result.id}
                    onClick={() => importImage(result, "style")}
                  >
                    作風参考に使う
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
