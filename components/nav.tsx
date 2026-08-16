"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/projects", label: "案件" },
  { href: "/style-library", label: "作風" },
  { href: "/render", label: "パース" },
  { href: "/redesign", label: "リデザイン" },
  { href: "/staging", label: "ステージング" },
  { href: "/edit", label: "編集" },
  { href: "/enhance", label: "高品質化" },
];

export function Nav() {
  const pathname = usePathname();
  const { email, isAdmin, ready, signOut } = useAuthUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-lg font-bold tracking-tight text-primary">
              ArchiRender
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              社内AIレンダリング
            </span>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  pathname === link.href ||
                    (link.href !== "/" && pathname.startsWith(link.href + "/"))
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            {mounted && ready && isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  pathname === "/admin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                管理
              </Link>
            )}
          </nav>

          {mounted && ready && email && (
            <div className="hidden items-center gap-2 md:flex">
              <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                {email}
              </span>
              <Button size="sm" variant="outline" onClick={() => void signOut()}>
                ログアウト
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
