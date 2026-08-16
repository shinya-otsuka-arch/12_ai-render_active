"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { hasLegacyLocalData } from "@/lib/local-legacy-store";
import { importLegacyLocalData } from "@/lib/cloud-import";
import { toast } from "sonner";

export function LocalImportBanner({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("archirender-import-skip") === "1") return;
    void hasLegacyLocalData().then(setVisible);
  }, []);

  if (!visible) return null;

  const handleImport = async () => {
    setBusy(true);
    try {
      const result = await importLegacyLocalData(setProgress);
      toast.success(
        `取り込み完了: 案件 ${result.projectCount}・成果物 ${result.assetCount}・作風 ${result.styleCount}`
      );
      setVisible(false);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "取り込みに失敗しました");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const handleSkip = () => {
    sessionStorage.setItem("archirender-import-skip", "1");
    setVisible(false);
  };

  return (
    <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-sm font-medium">この端末にローカルデータがあります</p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
        以前ブラウザに保存した案件・作風をクラウドへ取り込めます。重複はスキップします。
      </p>
      {progress && (
        <p className="mt-2 text-xs text-muted-foreground">{progress}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void handleImport()} disabled={busy}>
          {busy ? "取り込み中..." : "クラウドに取り込む"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleSkip} disabled={busy}>
          後で
        </Button>
      </div>
    </div>
  );
}
