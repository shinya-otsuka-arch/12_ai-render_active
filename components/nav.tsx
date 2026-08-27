"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/projects", label: "Projects" },
  { href: "/style-library", label: "画像登録" },
  { href: "/render", label: "パース" },
  { href: "/redesign", label: "Reデザイン" },
  { href: "/staging", label: "ステージング" },
  { href: "/edit", label: "編集" },
  { href: "/enhance", label: "高品質化" },
  { href: "/gemini", label: "オリジナル画像" },
];

const navLinkClass = (active: boolean) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  );

export function Nav() {
  const pathname = usePathname();
  const { email, isAdmin, ready, signOut } = useAuthUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-primary">
              AI Render
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              社内AIレンダリング
            </span>
          </Link>

          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={navLinkClass(
                  pathname === link.href ||
                    (link.href !== "/" && pathname.startsWith(link.href + "/"))
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden w-52 shrink-0 items-center justify-end gap-1 overflow-hidden md:flex">
            {ready && isAdmin && (
              <Link href="/admin" className={navLinkClass(pathname === "/admin")}>
                管理
              </Link>
            )}
            {ready && email ? (
              <>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {email}
                </span>
                <Button size="sm" variant="outline" onClick={() => void signOut()}>
                  ログアウト
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
