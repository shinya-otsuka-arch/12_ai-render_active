"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { LocalImportBanner } from "@/components/local-import-banner";
import {
  addStyleLibraryImage,
  deleteStyleLibraryItem,
  listStyleLibrary,
  type StyleLibraryItem,
  updateStyleBrief,
} from "@/lib/style-library-store";
import { toResizedJpegDataUrl } from "@/lib/storage-image";
import { readApiJson } from "@/lib/api-client";
import { assertPayloadUnderLimit } from "@/lib/resize-image";
import { toast } from "sonner";

export default function StyleLibraryPage() {
  const [items, setItems] = useState<StyleLibraryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setItems(await listStyleLibrary());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });
        await addStyleLibraryImage(dataUrl, file.name);
      }
      await refresh();
      toast.success("画像登録に追加しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (items.length === 0) {
      toast.error("事例画像を追加してください");
      return;
    }
    setBusy(true);
    try {
      const dataUrls: string[] = [];
      for (const item of items) {
        dataUrls.push(await toResizedJpegDataUrl(item.imageUrl, 1024));
      }
      const body = { images: dataUrls };
      assertPayloadUnderLimit(body);
      const res = await fetch("/api/style-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiJson<{ styleBrief: string }>(res);
      await Promise.all(items.map((i) => updateStyleBrief(i.id, data.styleBrief)));
      await refresh();
      toast.success("登録画像を解析してキャッシュしました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "解析に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: StyleLibraryItem) => {
    if (!item.canDelete) {
      toast.error("自分が追加した事例のみ削除できます");
      return;
    }
    if (!confirm("この事例を削除しますか？")) return;
    try {
      await deleteStyleLibraryItem(item.id);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  return (
    <main className="flex min-h-screen flex-col">
      <Nav />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Link
          href="/projects"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Projects
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          画像登録
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          ログイン全員で共有する参考画像です。削除は追加した本人のみ可能です。
        </p>

        <div className="mt-6">
          <LocalImportBanner onDone={() => void refresh()} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            事例画像を追加
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleAnalyze()}
            disabled={busy || items.length === 0}
          >
            {busy ? "処理中..." : "登録画像を再解析"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>

        {items.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            まだ事例がありません。自社の良いパースを数枚〜十数枚追加してください。
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-lg border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.label || "登録画像"}
                  className="aspect-square w-full object-cover"
                />
                <div className="flex items-center justify-between gap-1 p-2">
                  <p className="truncate text-[10px] text-muted-foreground">
                    {item.styleBrief ? "解析済" : "未解析"}
                  </p>
                  {item.canDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDelete(item)}
                    >
                      削除
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {items.some((i) => i.styleBrief) && (
          <div className="mt-8 rounded-lg border border-border bg-muted/40 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              キャッシュ中の作風要約（英語）
            </p>
            <p className="text-xs leading-relaxed text-foreground/80">
              {items.find((i) => i.styleBrief)?.styleBrief}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
