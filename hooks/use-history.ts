"use client";

import { useCallback, useState } from "react";

export interface HistoryEntry<TParams> {
  id: string;
  url: string;
  params: TParams;
  createdAt: string;
}

const MAX_ITEMS = 20;

/**
 * localStorage に紐づく生成履歴を管理する共通フック。
 * ページごとに異なる storageKey を渡すことで render/staging/edit で履歴を分離する。
 */
export function useHistory<TParams>(storageKey: string) {
  const [history, setHistory] = useState<HistoryEntry<TParams>[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addEntry = useCallback(
    (url: string, params: TParams) => {
      const entry: HistoryEntry<TParams> = {
        id: crypto.randomUUID(),
        url,
        params,
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_ITEMS);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const clearHistory = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHistory([]);
  }, [storageKey]);

  return { history, addEntry, clearHistory };
}
