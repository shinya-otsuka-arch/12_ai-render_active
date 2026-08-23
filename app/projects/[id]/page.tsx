"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectMembersPanel } from "@/components/project-members-panel";
import {
  deleteAsset,
  getProject,
  listAssets,
  MODE_LABELS,
  type Project,
  type ProjectAsset,
  type ProjectMode,
} from "@/lib/project-store";
import { exportProjectZip } from "@/lib/export-project-zip";
import { useAuthUser } from "@/hooks/use-auth-user";
import { toast } from "sonner";

const FILTERS: { value: "all" | ProjectMode; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "render", label: "パース" },
  { value: "redesign", label: "リデザイン" },
  { value: "staging", label: "ステージング" },
  { value: "edit", label: "編集" },
  { value: "enhance", label: "高品質化" },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { userId } = useAuthUser();
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [filter, setFilter] = useState<"all" | ProjectMode>("all");
  const [exporting, setExporting] = useState(false);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const p = await getProject(id);
      if (!p) {
        setMissing(true);
        setProject(null);
        setAssets([]);
        return;
      }
      setMissing(false);
      setProject(p);
      setAssets(await listAssets(id));
    } catch {
      setMissing(true);
      setProject(null);
      setAssets([]);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(
    () =>
      filter === "all" ? assets : assets.filter((a) => a.mode === filter),
    [assets, filter]
  );

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);
    try {
      await exportProjectZip(project);
      toast.success("ZIP をダウンロードしました");
    } catch (err) {
      console.error(err);
      toast.error("書き出しに失敗しました");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAsset = async (asset: ProjectAsset) => {
    const canDelete =
      project?.myRole === "owner" || asset.createdBy === userId;
    if (!canDelete) {
      toast.error("削除権限がありません");
      return;
    }
    if (!confirm("この成果物を削除しますか？")) return;
    try {
      await deleteAsset(asset.id);
      await refresh();
      toast.success("削除しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  if (missing) {
    return (
      <main className="flex min-h-screen flex-col">
        <Nav />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-muted-foreground">Projectが見つかりません</p>
          <Link
            href="/projects"
            className="mt-4 inline-block text-sm text-primary underline"
          >
            Projectsへ
          </Link>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex min-h-screen flex-col">
        <Nav />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">
          読み込み中...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <Nav />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/projects"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Projects
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              成果物 {assets.length} 件 ·{" "}
              {project.myRole === "owner" ? "オーナー" : "メンバー"} · 更新{" "}
              {new Date(project.updatedAt).toLocaleString("ja-JP")}
            </p>
          </div>
          <Button
            onClick={() => void handleExport()}
            disabled={exporting || assets.length === 0}
          >
            {exporting ? "書き出し中..." : "ZIP で書き出す"}
          </Button>
        </div>

        <ProjectMembersPanel
          projectId={project.id}
          isOwner={project.myRole === "owner"}
        />

        <div className="mt-6 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            成果物がありません。各モードで作業中Projectを選んで生成してください。
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((asset) => {
              const canDelete =
                project.myRole === "owner" || asset.createdBy === userId;
              return (
                <article
                  key={asset.id}
                  className="overflow-hidden rounded-xl border border-border bg-background"
                >
                  <div className="space-y-1 p-2">
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Before
                        </p>
                        <div className="aspect-video overflow-hidden rounded-md bg-stone-50">
                          {asset.beforeUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={asset.beforeUrl}
                              alt="Before"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              なし
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          After
                        </p>
                        <div className="aspect-video overflow-hidden rounded-md bg-stone-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.afterUrl}
                            alt="After"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border p-3">
                    <div className="min-w-0">
                      <Badge variant="secondary" className="text-xs">
                        {MODE_LABELS[asset.mode]}
                      </Badge>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {new Date(asset.createdAt).toLocaleString("ja-JP")}
                      </p>
                    </div>
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDeleteAsset(asset)}
                      >
                        削除
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
