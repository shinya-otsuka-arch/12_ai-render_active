"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addAssetToProject,
  deleteAsset,
  getActiveProjectId,
  listAssetsByMode,
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
const PERSONAL_SCOPE = "__personal__";
/** 署名 URL の寿命は 7 日。タブ切替のたびに再署名しないよう長めに取る */
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

type CacheBucket<TParams> = {
  projectId: string;
  entries: HistoryEntry<TParams>[];
  isPersonal: boolean;
  cachedAt: number;
};

/** key = `${scope}:${mode}` — scope は activeId または個人履歴 */
const historyCache = new Map<string, CacheBucket<unknown>>();

function scopeFromActiveId(activeId: string | null) {
  return activeId ?? PERSONAL_SCOPE;
}

function cacheKey(scope: string, mode: ProjectMode) {
  return `${scope}:${mode}`;
}

function readCache<TParams>(
  scope: string,
  mode: ProjectMode
): CacheBucket<TParams> | undefined {
  return historyCache.get(cacheKey(scope, mode)) as
    | CacheBucket<TParams>
    | undefined;
}

function writeCache<TParams>(
  scope: string,
  mode: ProjectMode,
  projectId: string,
  entries: HistoryEntry<TParams>[],
  isPersonal: boolean
) {
  historyCache.set(cacheKey(scope, mode), {
    projectId,
    entries,
    isPersonal,
    cachedAt: Date.now(),
  });
}

function assetsToEntries<TParams>(
  assets: Awaited<ReturnType<typeof listAssetsByMode>>
): HistoryEntry<TParams>[] {
  return assets.map((a) => ({
    id: a.id,
    url: a.afterUrl,
    beforeUrl: a.beforeUrl,
    params: a.params as TParams,
    createdAt: a.createdAt,
  }));
}

/** 同じ資産は既存の署名 URL を残し、ブラウザキャッシュを壊さない */
function reuseSignedUrls<TParams>(
  incoming: HistoryEntry<TParams>[],
  previous: HistoryEntry<TParams>[] | undefined
): HistoryEntry<TParams>[] {
  if (!previous?.length) return incoming;
  const prevById = new Map(previous.map((e) => [e.id, e]));
  return incoming.map((entry) => {
    const prev = prevById.get(entry.id);
    if (!prev) return entry;
    return { ...entry, url: prev.url, beforeUrl: prev.beforeUrl };
  });
}

function historyFingerprint<TParams>(entries: HistoryEntry<TParams>[]) {
  return entries
    .map(
      (e) =>
        `${e.id}\0${e.url}\0${e.beforeUrl ?? ""}\0${e.createdAt}\0${JSON.stringify(e.params)}`
    )
    .join("\n");
}

/**
 * サーバー（Supabase project_assets）に紐づく生成履歴。
 * 作業中 Project があればそこ、なければユーザー専用の個人履歴へ保存する。
 * キャッシュがあれば即表示し、裏で再取得する。
 */
export function useHistory<TParams>(mode: ProjectMode) {
  const initialScope =
    typeof window !== "undefined"
      ? scopeFromActiveId(getActiveProjectId())
      : PERSONAL_SCOPE;
  const initialCache =
    typeof window !== "undefined"
      ? readCache<TParams>(initialScope, mode)
      : undefined;

  const [history, setHistory] = useState<HistoryEntry<TParams>[]>(
    () => initialCache?.entries ?? []
  );
  const [canClear, setCanClear] = useState(
    () => initialCache?.isPersonal ?? false
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const projectIdRef = useRef<string | null>(initialCache?.projectId ?? null);
  const loadGenRef = useRef(0);
  const historyRef = useRef(history);
  historyRef.current = history;

  const applyHistory = useCallback(
    (entries: HistoryEntry<TParams>[], isPersonal: boolean) => {
      setCanClear(isPersonal);
      if (historyFingerprint(entries) === historyFingerprint(historyRef.current)) {
        return;
      }
      setHistory(entries);
    },
    []
  );

  useEffect(() => {
    setActiveId(getActiveProjectId());
    setReady(true);
    return subscribeActiveProjectId(setActiveId);
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const scope = scopeFromActiveId(getActiveProjectId());
    const cached = readCache<TParams>(scope, mode);
    if (cached) {
      projectIdRef.current = cached.projectId;
      applyHistory(cached.entries, cached.isPersonal);
      if (Date.now() - cached.cachedAt < STALE_THRESHOLD_MS) return;
    }

    try {
      const { project, isPersonal } = await resolveHistoryProject();
      if (gen !== loadGenRef.current) return;

      projectIdRef.current = project.id;
      const assets = await listAssetsByMode(project.id, mode, MAX_ITEMS);
      if (gen !== loadGenRef.current) return;

      const previous = cached?.entries ?? historyRef.current;
      const entries = reuseSignedUrls(
        assetsToEntries<TParams>(assets),
        previous
      );
      writeCache(scope, mode, project.id, entries, isPersonal);
      applyHistory(entries, isPersonal);
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      console.error(err);
      if (!cached) {
        setHistory([]);
        setCanClear(false);
      }
    }
  }, [mode, applyHistory]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, activeId, load]);

  const addEntry = useCallback(
    async (url: string, params: TParams, beforeUrl?: string) => {
      const scope = scopeFromActiveId(getActiveProjectId());
      const tempId = crypto.randomUUID();
      const optimistic: HistoryEntry<TParams> = {
        id: tempId,
        url,
        beforeUrl,
        params,
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => {
        const next = [optimistic, ...prev].slice(0, MAX_ITEMS);
        const pid = projectIdRef.current;
        if (pid) writeCache(scope, mode, pid, next, canClear);
        return next;
      });

      try {
        const { project, isPersonal } = await resolveHistoryProject();
        projectIdRef.current = project.id;
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
          const next = replaced.slice(0, MAX_ITEMS);
          writeCache(scope, mode, project.id, next, isPersonal);
          return next;
        });

        if (isPersonal) {
          const assets = await listAssetsByMode(
            project.id,
            mode,
            MAX_ITEMS + 10
          );
          const extras = assets.slice(MAX_ITEMS);
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
    [mode, canClear]
  );

  const clearHistory = useCallback(async () => {
    if (!canClear) return;
    const scope = scopeFromActiveId(getActiveProjectId());
    const ids = history.map((h) => h.id);
    setHistory([]);
    const pid = projectIdRef.current;
    if (pid) writeCache(scope, mode, pid, [], true);
    for (const id of ids) {
      try {
        await deleteAsset(id);
      } catch (err) {
        console.error(err);
      }
    }
  }, [canClear, history, mode]);

  return {
    history,
    addEntry,
    clearHistory: canClear ? clearHistory : undefined,
  };
}
