"use client";

import { Nav } from "@/components/nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { HistoryIcon, SlidersHorizontalIcon } from "lucide-react";

interface ToolLayoutProps {
  title: string;
  description: string;
  paramPanel: React.ReactNode;
  historyPanel?: React.ReactNode;
  children: React.ReactNode;
}

const mobileTriggerClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden";

export function ToolLayout({
  title,
  description,
  paramPanel,
  historyPanel,
  children,
}: ToolLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <div className="flex flex-1 overflow-hidden">
        {/* 左パネル: パラメータ（lg以上は常時表示） */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r bg-background p-4 lg:block">
          <div className="space-y-5">{paramPanel}</div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Sheet>
                <SheetTrigger className={mobileTriggerClass} aria-label="設定を開く">
                  <SlidersHorizontalIcon className="size-4" />
                </SheetTrigger>
                <SheetContent side="left" className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>設定</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-5">{paramPanel}</div>
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">{title}</h1>
                <p className="truncate text-sm text-muted-foreground mt-0.5">
                  {description}
                </p>
              </div>
            </div>

            {historyPanel && (
              <Sheet>
                <SheetTrigger
                  className={mobileTriggerClass}
                  aria-label="履歴を開く"
                >
                  <HistoryIcon className="size-4" />
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>履歴</SheetTitle>
                  </SheetHeader>
                  {historyPanel}
                </SheetContent>
              </Sheet>
            )}
          </div>

          {children}
        </main>

        {/* 右パネル: 履歴（lg以上は常時表示） */}
        {historyPanel && (
          <aside className="hidden w-56 shrink-0 overflow-y-auto border-l bg-background lg:block">
            {historyPanel}
          </aside>
        )}
      </div>
    </div>
  );
}
