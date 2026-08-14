"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { countAssets } from "@/lib/project-store";
import { toast } from "sonner";

export default function ProjectsPage() {
  const { projects, create, rename, remove, refresh } = useProjects();
  const [newName, setNewName] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number> = {};
      for (const p of projects) {
        next[p.id] = await countAssets(p.id);
      }
      if (!cancelled) setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  const sorted = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [projects]
  );

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("案件名を入力してください");
      return;
    }
    const p = create(newName);
    setNewName("");
    toast.success(`「${p.name}」を作成しました`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`案件「${name}」と成果物をすべて削除しますか？`)) return;
    await remove(id);
    toast.success("案件を削除しました");
    refresh();
  };

  return (
    <main className="flex min-h-screen flex-col">
      <Nav />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">案件</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          生成結果を案件単位でまとめ、ZIP で書き出せます。各モードで「作業中案件」を選ぶと自動保存されます。
        </p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="例: 〇〇邸 改修"
            className="h-9 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button onClick={handleCreate}>案件を作成</Button>
        </div>

        <ul className="mt-8 space-y-2">
          {sorted.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              まだ案件がありません
            </li>
          ) : (
            sorted.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  {editingId === p.id ? (
                    <div className="flex gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 flex-1 rounded-md border border-input px-2 text-sm"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          rename(p.id, editName);
                          setEditingId(null);
                          toast.success("名称を更新しました");
                        }}
                      >
                        保存
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {p.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        成果物 {counts[p.id] ?? "…"} 件 · 更新{" "}
                        {new Date(p.updatedAt).toLocaleString("ja-JP")}
                      </p>
                    </>
                  )}
                </div>
                {editingId !== p.id && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(p.id);
                        setEditName(p.name);
                      }}
                    >
                      名称変更
                    </Button>
                    <Link
                      href={`/projects/${p.id}`}
                      className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                    >
                      開く
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(p.id, p.name)}
                    >
                      削除
                    </Button>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </main>
  );
}
