"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addAssetToProject,
  deleteAsset,
  getActiveProjectId,
  listAssets,
  resolveHistoryProject,
  subscribeActiveProjectId,
  type ProjectMode,
} from "@/lib/project-store";
import { toast } from "sonner";

export interface HistoryEntry<TParams> {
  id: string;
  url: string;
  /** アップロード元画像（Before）。旧データには無い場合あり */
  beforeUrl?: string;
  params: TParams;
  createdAt: string;
}

const MAX_ITEMS = 20;

/**
 * サーバー（Supabase project_assets）に紐づく生成履歴。
 * 作業中 Project があればそこ、なければユーザー専用の個人履歴へ保存する。
 */
export function useHistory<TParams>(mode: ProjectMode) {
  const [history, setHistory] = useState<HistoryEntry<TParams>[]>([]);
  const [canClear, setCanClear] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setActiveId(getActiveProjectId());
    setReady(true);
    return subscribeActiveProjectId(setActiveId);
  }, []);

  const load = useCallback(async () => {
    try {
      const { project, isPersonal } = await resolveHistoryProject();
      setCanClear(isPersonal);
      const assets = await listAssets(project.id);
      const entries = assets
        .filter((a) => a.mode === mode)
        .slice(0, MAX_ITEMS)
        .map(
          (a): HistoryEntry<TParams> => ({
            id: a.id,
            url: a.afterUrl,
            beforeUrl: a.beforeUrl,
            params: a.params as TParams,
            createdAt: a.createdAt,
          })
        );
      setHistory(entries);
    } catch (err) {
      console.error(err);
      setHistory([]);
      setCanClear(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, activeId, load]);

  const addEntry = useCallback(
    async (url: string, params: TParams, beforeUrl?: string) => {
      const tempId = crypto.randomUUID();
      const optimistic: HistoryEntry<TParams> = {
        id: tempId,
        url,
        beforeUrl,
        params,
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => [optimistic, ...prev].slice(0, MAX_ITEMS));

      try {
        const { project, isPersonal } = await resolveHistoryProject();
        setCanClear(isPersonal);
        const saved = await addAssetToProject({
          projectId: project.id,
          mode,
          afterUrl: url,
          beforeUrl,
          params,
        });

        setHistory((prev) => {
          const replaced = prev.map((e) =>
            e.id === tempId
              ? {
                  id: saved.id,
                  url: saved.afterUrl,
                  beforeUrl: saved.beforeUrl,
                  params: (saved.params as TParams) ?? params,
                  createdAt: saved.createdAt,
                }
              : e
          );
          return replaced.slice(0, MAX_ITEMS);
        });

        if (isPersonal) {
          const assets = await listAssets(project.id);
          const extras = assets
            .filter((a) => a.mode === mode)
            .slice(MAX_ITEMS);
          for (const asset of extras) {
            try {
              await deleteAsset(asset.id);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "履歴の保存に失敗しました"
        );
      }
    },
    [mode]
  );

  const clearHistory = useCallback(async () => {
    if (!canClear) return;
    const ids = history.map((h) => h.id);
    setHistory([]);
    for (const id of ids) {
      try {
        await deleteAsset(id);
      } catch (err) {
        console.error(err);
      }
    }
  }, [canClear, history]);

  return {
    history,
    addEntry,
    clearHistory: canClear ? clearHistory : undefined,
  };
}
