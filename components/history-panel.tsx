"use client";

import { Trash2Icon } from "lucide-react";
import type { HistoryEntry } from "@/hooks/use-history";

interface HistoryPanelProps<TParams> {
  history: HistoryEntry<TParams>[];
  onSelect: (entry: HistoryEntry<TParams>) => void;
  renderLabel: (params: TParams) => React.ReactNode;
  onClear?: () => void;
  emptyText?: string;
}

export function HistoryPanel<TParams>({
  history,
  onSelect,
  renderLabel,
  onClear,
  emptyText = "生成履歴がありません",
}: HistoryPanelProps<TParams>) {
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          履歴
        </p>
        {history.length > 0 && onClear && (
          <button
            onClick={onClear}
            aria-label="履歴をクリア"
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="mt-8 text-center text-xs text-muted-foreground opacity-60">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="group w-full overflow-hidden rounded-lg border border-border transition-colors hover:border-primary"
            >
              {item.beforeUrl ? (
                <div className="flex aspect-video w-full transition-opacity group-hover:opacity-90">
                  <div className="relative w-1/2 overflow-hidden border-r border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.beforeUrl} alt="変更前" className="h-full w-full object-cover" />
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/50 px-1 text-[10px] text-white">前</span>
                  </div>
                  <div className="relative w-1/2 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="変更後" className="h-full w-full object-cover" />
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/50 px-1 text-[10px] text-white">後</span>
                  </div>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt="履歴"
                  className="aspect-video w-full object-cover transition-opacity group-hover:opacity-90"
                />
              )}
              <div className="p-1.5 text-left">
                <p className="truncate text-xs text-muted-foreground">
                  {renderLabel(item.params)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
