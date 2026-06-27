export type ProjectType = "interior" | "exterior";
export type Style = "realistic" | "modern" | "japanese" | "minimalist" | "industrial" | "nordic";
export type Lighting = "daytime" | "sunset" | "night" | "overcast" | "dramatic";
export type Material = "concrete" | "wood" | "tile" | "brick" | "glass" | "marble";

export interface RenderParams {
  projectType: ProjectType;
  style: Style;
  lighting: Lighting;
  materials: Material[];
  strength?: number;
}

const projectTypeMap: Record<ProjectType, string> = {
  interior: "architectural interior",
  exterior: "architectural exterior",
};

const styleMap: Record<Style, string> = {
  realistic: "photorealistic, professional architectural photography",
  modern: "contemporary modern architecture, clean lines, minimalist",
  japanese: "Japanese architecture, wabi-sabi, zen aesthetic, natural materials",
  minimalist: "ultra minimalist, neutral palette, clean space",
  industrial: "industrial style, exposed structure, raw materials",
  nordic: "Scandinavian design, warm wood tones, hygge, light interiors",
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
  const { projectType, style, lighting, materials } = params;

  const materialStr =
    materials.length > 0
      ? materials.map((m) => materialMap[m]).join(", ")
      : "";

  const parts = [
    `photorealistic ${projectTypeMap[projectType]} render`,
    styleMap[style],
    lightingMap[lighting],
    materialStr,
    "8k resolution, ultra detailed, professional visualization, award winning architecture",
  ].filter(Boolean);

  return parts.join(", ");
}

export function buildNegativePrompt(): string {
  return "blurry, low quality, distorted, ugly, deformed, unrealistic, cartoon, anime, sketch, drawing, painting, watermark, text, signature";
}
