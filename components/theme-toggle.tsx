"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const noopSubscribe = () => () => {};

// サーバーは実際のテーマを知らないため、ハイドレーション完了後にのみ resolvedTheme に基づくアイコンへ切り替える。
// useEffect + setState ではなく useSyncExternalStore を使うことで、クライアント側の「マウント済みか」を
// レンダー中に純粋に読み取り、余分な再レンダーの連鎖を避ける。
function useHasMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hasMounted = useHasMounted();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="ダークモード切り替え"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {hasMounted && resolvedTheme === "dark" ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </Button>
  );
}
