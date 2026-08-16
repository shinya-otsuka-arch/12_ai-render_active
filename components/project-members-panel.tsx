"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  addProjectMemberByEmail,
  listProjectMembers,
  removeProjectMember,
  type ProjectMember,
} from "@/lib/project-store";
import { toast } from "sonner";

export function ProjectMembersPanel({
  projectId,
  isOwner,
}: {
  projectId: string;
  isOwner: boolean;
}) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setMembers(await listProjectMembers(projectId));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    void refresh();
  }, [projectId]);

  const handleAdd = async () => {
    setBusy(true);
    try {
      await addProjectMemberByEmail(projectId, email);
      setEmail("");
      await refresh();
      toast.success("メンバーを追加しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("このメンバーの共有を解除しますか？")) return;
    try {
      await removeProjectMember(projectId, userId);
      await refresh();
      toast.success("共有を解除しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "解除に失敗しました");
    }
  };

  return (
    <section className="mt-8 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">共有メンバー</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        オーナーが招待したメンバーだけがこの案件を閲覧・追加できます。
      </p>

      <ul className="mt-4 space-y-2">
        {members.map((m) => (
          <li
            key={m.userId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{m.email || m.userId}</p>
              <p className="text-xs text-muted-foreground">
                {m.role === "owner" ? "オーナー" : "メンバー"}
              </p>
            </div>
            {isOwner && m.role === "member" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRemove(m.userId)}
              >
                解除
              </Button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="共有するメール（ツール招待済み）"
            className="h-9 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button size="sm" onClick={() => void handleAdd()} disabled={busy}>
            追加
          </Button>
        </div>
      )}
    </section>
  );
}
