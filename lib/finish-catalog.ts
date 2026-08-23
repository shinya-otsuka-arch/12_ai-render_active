export type FinishPart = "roof" | "facade" | "ceiling" | "wall" | "floor";

export const EXTERIOR_PARTS: FinishPart[] = ["roof", "facade"];
export const INTERIOR_PARTS: FinishPart[] = ["ceiling", "wall", "floor"];

export const PART_LABELS: Record<FinishPart, string> = {
  roof: "屋根",
  facade: "外壁",
  ceiling: "天井",
  wall: "壁",
  floor: "床",
};

export const PART_OVERLAY: Record<FinishPart, string> = {
  roof: "rgba(239, 68, 68, 0.45)",
  facade: "rgba(37, 99, 235, 0.45)",
  ceiling: "rgba(147, 51, 234, 0.45)",
  wall: "rgba(37, 99, 235, 0.45)",
  floor: "rgba(22, 163, 74, 0.45)",
};

export interface FinishOption {
  id: string;
  label: string;
  prompt: string;
}

export const FINISHES: Record<FinishPart, FinishOption[]> = {
  roof: [
    {
      id: "galvalume",
      label: "ガルバリウム鋼板",
      prompt:
        "galvalume standing-seam metal roof, zinc-aluminum coated steel roofing",
    },
    {
      id: "kawara",
      label: "瓦",
      prompt: "traditional Japanese clay kawara roof tiles",
    },
    {
      id: "slate",
      label: "スレート",
      prompt: "fiber-cement slate roof tiles",
    },
  ],
  facade: [
    {
      id: "plaster",
      label: "左官仕上",
      prompt:
        "Japanese shakan plaster wall finish, smooth cement render on exterior walls",
    },
    {
      id: "galvalume-vertical",
      label: "ガルバリウム鋼板縦ハゼ",
      prompt: "vertical standing-seam galvalume metal siding on exterior walls",
    },
    {
      id: "galvalume-horizontal",
      label: "ガルバリウム鋼板横張",
      prompt: "horizontal galvalume metal siding on exterior walls",
    },
    {
      id: "yakisugi",
      label: "焼き杉板張り",
      prompt: "charred cedar yakisugi board siding, burned sugi wood cladding",
    },
  ],
  ceiling: [
    {
      id: "wallpaper",
      label: "クロス",
      prompt: "ceiling covered with vinyl wallpaper",
    },
    {
      id: "paint",
      label: "塗装",
      prompt: "smooth painted ceiling",
    },
    {
      id: "planks",
      label: "板張り",
      prompt: "wood plank boarded timber ceiling",
    },
  ],
  wall: [
    {
      id: "wallpaper",
      label: "クロス",
      prompt: "vinyl wallpaper on interior walls",
    },
    {
      id: "paint",
      label: "塗装",
      prompt: "smooth painted interior walls",
    },
    {
      id: "planks",
      label: "板張り",
      prompt: "interior wood plank wall cladding",
    },
  ],
  floor: [
    {
      id: "flooring",
      label: "フローリング",
      prompt: "wood strip flooring",
    },
    {
      id: "tile",
      label: "タイル張り",
      prompt: "ceramic tiled floor",
    },
  ],
};

export type PartFinishSelection = Partial<Record<FinishPart, string>>;

export function partsForProjectType(
  type: "interior" | "exterior"
): FinishPart[] {
  return type === "exterior" ? EXTERIOR_PARTS : INTERIOR_PARTS;
}

export function buildPartFinishPrompt(
  selection: PartFinishSelection,
  type: "interior" | "exterior"
): string {
  const phrases: string[] = [];
  for (const part of partsForProjectType(type)) {
    const id = selection[part];
    if (!id) continue;
    const opt = FINISHES[part].find((o) => o.id === id);
    if (opt) phrases.push(`${opt.prompt}`);
  }
  return phrases.join(", ");
}

export function buildPartInpaintPrompt(
  part: FinishPart,
  finishId: string
): string {
  const opt = FINISHES[part].find((o) => o.id === finishId);
  const finish = opt?.prompt ?? "the selected finish";
  return `change only the ${part} to ${finish}, keep architecture, openings, and all other surfaces unchanged`;
}

export function finishLabel(
  part: FinishPart,
  id: string | undefined
): string | undefined {
  if (!id) return undefined;
  return FINISHES[part].find((o) => o.id === id)?.label;
}
