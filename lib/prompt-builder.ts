export type ProjectType = "interior" | "exterior";
export type Lighting = "daytime" | "sunset" | "night" | "overcast" | "dramatic";
export type Material = "concrete" | "wood" | "tile" | "brick" | "glass" | "marble";

export interface RenderParams {
  projectType: ProjectType;
  lighting: Lighting;
  materials: Material[];
  strength?: number;
  customPrompt?: string;
  /** 参考素材を Vision 解析した英語フレーズ */
  materialReference?: string;
  /** 作風参考を Vision 解析した英語フレーズ */
  styleReference?: string;
  /** 作風寄せ強度 0〜1 */
  styleStrength?: number;
}

/** 建築設計事務所らしい落ち着いた本物感を促す共通ガードレール */
export const STYLE_GUARDRAIL_POSITIVE =
  "honest and refined use of materials, tasteful architectural material palette, understated elegant design, natural authentic textures";

export const STYLE_GUARDRAIL_NEGATIVE =
  "garish oversaturated colors, neon colors, kitsch, outdated 1990s interior design, cheap fake imitation material texture, printed faux wood grain, plastic laminate imitation, gaudy ornate gold decoration, chandelier, palace-like opulence, tacky bling";

const STRUCTURE_PRESERVE_POSITIVE =
  "preserve original architecture and layout, keep wall positions, window openings, and camera perspective unchanged";

const STRUCTURE_PRESERVE_NEGATIVE =
  "changed layout, warped walls, shifted windows, distorted perspective, altered floor plan, moved structural elements";

const projectTypeMap: Record<ProjectType, string> = {
  interior: "architectural interior",
  exterior: "architectural exterior",
};

const lightingMap: Record<Lighting, string> = {
  daytime: "bright natural daylight, soft shadows, blue sky",
  sunset: "golden hour, warm amber light, dramatic sky, long shadows",
  night: "artificial lighting, warm interior glow, dramatic night atmosphere",
  overcast: "soft diffused light, cloudy sky, no harsh shadows",
  dramatic: "high contrast chiaroscuro lighting, architectural drama",
};

const materialMap: Record<Material, string> = {
  concrete: "exposed concrete",
  wood: "natural wood",
  tile: "ceramic tile",
  brick: "exposed brick",
  glass: "floor-to-ceiling glass",
  marble: "polished marble",
};

export function buildPrompt(params: RenderParams): string {
  const {
    projectType,
    lighting,
    materials,
    customPrompt,
    materialReference,
    styleReference,
    styleStrength = 0.75,
  } = params;

  const materialStr =
    materials.length > 0
      ? materials.map((m) => materialMap[m]).join(", ")
      : "";

  const referenceStr = materialReference?.trim()
    ? `use materials and finishes matching this reference sample: ${materialReference.trim()}`
    : "";

  let styleStr = "";
  if (styleReference?.trim()) {
    const weight =
      styleStrength >= 0.85
        ? "strictly follow this house style"
        : styleStrength >= 0.55
          ? "strongly match this house style"
          : "subtly lean toward this house style";
    styleStr = `${weight}: ${styleReference.trim()}, avoid anything that clashes with this aesthetic`;
  }

  const parts = [
    `photorealistic ${projectTypeMap[projectType]} render`,
    lightingMap[lighting],
    materialStr,
    referenceStr,
    styleStr,
    STYLE_GUARDRAIL_POSITIVE,
    STRUCTURE_PRESERVE_POSITIVE,
    customPrompt?.trim(),
    "8k resolution, ultra detailed, professional visualization, award winning architecture",
  ].filter(Boolean);

  return parts.join(", ");
}

export function buildNegativePrompt(styleStrength = 0): string {
  const base = [
    "blurry, low quality, distorted, ugly, deformed, unrealistic, cartoon, anime, sketch, drawing, painting, watermark, text, signature",
    STYLE_GUARDRAIL_NEGATIVE,
    STRUCTURE_PRESERVE_NEGATIVE,
  ];
  if (styleStrength >= 0.4) {
    base.push(
      "style mismatch, conflicting design language, trendy AI look, overprocessed HDR, plastic CGI sheen, theme-park architecture"
    );
  }
  return base.join(", ");
}
