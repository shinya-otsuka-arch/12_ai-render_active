"use client";

import { useCallback, useState } from "react";
import { resizeDataUrl } from "@/lib/resize-image";

export interface HistoryEntry<TParams> {
  id: string;
  url: string;
  /** アップロード元画像（Before）。旧データには無い場合あり */
  beforeUrl?: string;
  params: TParams;
  createdAt: string;
}

const MAX_ITEMS = 20;
/** localStorage 保存用サムネイルの長辺上限（容量対策） */
const STORAGE_THUMB_EDGE = 480;

function toThumb(src: string): Promise<string> {
  return src.startsWith("data:") ? resizeDataUrl(src, STORAGE_THUMB_EDGE) : Promise.resolve(src);
}

function readStored<T>(key: string): T[] {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T[]) : [];
  } catch {
    return [];
  }
}

function trySet(key: string, items: unknown[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

/**
 * localStorage に紐づく生成履歴を管理する共通フック。
 * ページごとに異なる storageKey を渡すことでモード別に履歴を分離する。
 *
 * React state はフル品質 URL を保持し、localStorage にはサムネイル（480px）を非同期で保存。
 * 容量不足時は古いエントリを削除してから beforeUrl を除去する順で縮退する。
 */
export function useHistory<TParams>(storageKey: string) {
  const [history, setHistory] = useState<HistoryEntry<TParams>[]>(() => {
    if (typeof window === "undefined") return [];
    return readStored<HistoryEntry<TParams>>(storageKey);
  });

  const addEntry = useCallback(
    (url: string, params: TParams, beforeUrl?: string) => {
      const entry: HistoryEntry<TParams> = {
        id: crypto.randomUUID(),
        url,
        beforeUrl,
        params,
        createdAt: new Date().toISOString(),
      };

      // React state を即時フル品質で更新（現セッション内は高品質表示）
      setHistory((prev) => [entry, ...prev].slice(0, MAX_ITEMS));

      // localStorage にはサムネイルを非同期で保存
      void (async () => {
        try {
          const [thumbUrl, thumbBeforeUrl] = await Promise.all([
            toThumb(url),
            beforeUrl ? toThumb(beforeUrl) : Promise.resolve(undefined),
          ]);

          const storageEntry: HistoryEntry<TParams> = {
            ...entry,
            url: thumbUrl,
            beforeUrl: thumbBeforeUrl,
          };

          // 既存の保存済みリストへ新エントリを先頭に追加（重複除去）
          const existing = readStored<HistoryEntry<TParams>>(storageKey);
          const next = [storageEntry, ...existing.filter((e) => e.id !== entry.id)].slice(0, MAX_ITEMS);

          if (trySet(storageKey, next)) return;

          // 容量不足: 古いエントリを1件ずつ削除して再試行
          for (let i = next.length - 1; i >= 1; i--) {
            if (trySet(storageKey, next.slice(0, i))) return;
          }

          // 最終手段: beforeUrl を全除去してサイズを削減
          const slim = next.map(({ beforeUrl: _b, ...rest }) => rest);
          trySet(storageKey, slim);
        } catch {
          // resize 失敗等は無視
        }
      })();
    },
    [storageKey]
  );

  const clearHistory = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHistory([]);
  }, [storageKey]);

  return { history, addEntry, clearHistory };
}
