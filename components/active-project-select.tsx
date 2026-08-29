"use client";

import Link from "next/link";
import { useProjects, useActiveProject } from "@/hooks/use-projects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export function ActiveProjectSelect() {
  const { projects, ready: projectsReady } = useProjects();
  const { activeId, setActiveId, ready: activeReady } = useActiveProject();

  if (!projectsReady || !activeReady) return null;

  const activeName = projects.find((p) => p.id === activeId)?.name;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        作業中Project
      </p>
      <Select
        value={activeId ?? NONE}
        onValueChange={(v) => setActiveId(!v || v === NONE ? null : String(v))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="未選択">
            {activeId ? (activeName ?? "（不明なProject）") : "未選択"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>未選択（個人履歴に保存）</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
        選択中のProject、未選択時は個人履歴に生成結果を自動保存します。{" "}
        <Link href="/projects" className="underline hover:text-foreground">
          Projects
        </Link>
      </p>
    </div>
  );
}
