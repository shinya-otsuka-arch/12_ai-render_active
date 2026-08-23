"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { readApiJson } from "@/lib/api-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const { isAdmin, ready } = useAuthUser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !isAdmin) {
      router.replace("/projects");
    }
  }, [ready, isAdmin, router]);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("メールアドレスを入力してください");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      await readApiJson<{ ok: boolean }>(res);
      toast.success(`${email.trim()} を招待しました`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "招待に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !isAdmin) {
    return (
      <main className="flex min-h-screen flex-col">
        <Nav />
        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
          読み込み中...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <Nav />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">メンバー招待</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          ツールへのログイン権を付与します。Projectの共有は各Projectのオーナーが別途行います。
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleInvite()}
            placeholder="colleague@example.com"
            className="h-9 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button onClick={() => void handleInvite()} disabled={busy}>
            {busy ? "送信中..." : "招待メールを送る"}
          </Button>
        </div>
      </div>
    </main>
  );
}
