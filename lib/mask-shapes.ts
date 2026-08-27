export type MaskShapeTool = "rect" | "ellipse" | "lasso";

export interface MaskPoint {
  x: number;
  y: number;
}

export const MASK_SHAPE_TOOLS: { value: MaskShapeTool; label: string }[] = [
  { value: "rect", label: "四角" },
  { value: "ellipse", label: "丸" },
  { value: "lasso", label: "自由曲線" },
];

export function shapeIsLargeEnough(
  tool: MaskShapeTool,
  start: MaskPoint,
  end: MaskPoint,
  points: MaskPoint[]
): boolean {
  if (tool === "lasso") return points.length >= 3;
  return Math.abs(end.x - start.x) >= 4 && Math.abs(end.y - start.y) >= 4;
}

export function buildShapePath(
  ctx: CanvasRenderingContext2D,
  tool: MaskShapeTool,
  start: MaskPoint,
  end: MaskPoint,
  points: MaskPoint[]
) {
  ctx.beginPath();
  if (tool === "rect") {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    ctx.rect(x, y, Math.abs(end.x - start.x), Math.abs(end.y - start.y));
    return;
  }
  if (tool === "ellipse") {
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    if (rx < 0.5 || ry < 0.5) return;
    ctx.ellipse(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      rx,
      ry,
      0,
      0,
      Math.PI * 2
    );
    return;
  }
  if (points.length < 2) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

export function fillShape(
  ctx: CanvasRenderingContext2D,
  tool: MaskShapeTool,
  start: MaskPoint,
  end: MaskPoint,
  points: MaskPoint[],
  options: { erase: boolean; fillStyle: string }
) {
  if (!shapeIsLargeEnough(tool, start, end, points)) return;
  buildShapePath(ctx, tool, start, end, points);
  if (options.erase) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = options.fillStyle;
  ctx.fill();
}

export function strokeShapePreview(
  ctx: CanvasRenderingContext2D,
  tool: MaskShapeTool,
  start: MaskPoint,
  end: MaskPoint,
  points: MaskPoint[]
) {
  if (tool === "lasso" ? points.length < 2 : !shapeIsLargeEnough(tool, start, end, points)) {
    return;
  }
  buildShapePath(ctx, tool, start, end, points);
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(239, 68, 68, 0.95)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
  ctx.fill();
  ctx.restore();
}
