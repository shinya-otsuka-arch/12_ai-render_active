"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function LoginContent() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get("error") === "auth";
  const hasConfigError =
    searchParams.get("error") === "config" || !isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("メールアドレスを入力してください");
      return;
    }
    setSending(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("ログイン用メールを送信しました");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "送信に失敗しました。招待済みのメールか確認してください。"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          AI Render
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          招待されたメールアドレスでマジックリンクログインします。
        </p>

        {hasConfigError && (
          <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            サーバーの Supabase 設定が不足しています。管理者に環境変数の設定を依頼してください。
          </p>
        )}

        {hasError && (
          <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            リンクが無効か期限切れです。新しいログインリンクを送ってください。
          </p>
        )}

        {hasConfigError ? null : sent ? (
          <p className="mt-8 rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed">
            <strong>{email}</strong> 宛にログインリンクを送りました。メール内のリンクからアクセスしてください。
          </p>
        ) : (
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              required
            />
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? "送信中..." : "ログインリンクを送る"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
