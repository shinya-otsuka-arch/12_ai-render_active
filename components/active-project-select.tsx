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
          <SelectValue placeholder="未選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>未選択（Projectに保存しない）</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
        選択中のProjectに生成結果を自動保存します。{" "}
        <Link href="/projects" className="underline hover:text-foreground">
          Projects
        </Link>
      </p>
    </div>
  );
}
