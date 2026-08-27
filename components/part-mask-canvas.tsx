"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { PART_OVERLAY, type FinishPart } from "@/lib/finish-catalog";
import {
  fillShape,
  strokeShapePreview,
  type MaskPoint,
  type MaskShapeTool,
} from "@/lib/mask-shapes";

export interface PartMaskCanvasHandle {
  getMasks: () => Partial<Record<FinishPart, string>>;
  getSize: () => { width: number; height: number };
  clearActive: () => void;
}

interface PartMaskCanvasProps {
  imageSrc: string;
  activePart: FinishPart;
  tool: MaskShapeTool;
  erase: boolean;
}

function makeLayer(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function layerHasPaint(layer: HTMLCanvasElement | undefined): boolean {
  if (!layer) return false;
  const ctx = layer.getContext("2d");
  if (!ctx) return false;
  const data = ctx.getImageData(0, 0, layer.width, layer.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }
  return false;
}

function layerToOpenAiMask(layer: HTMLCanvasElement): string {
  const off = document.createElement("canvas");
  off.width = layer.width;
  off.height = layer.height;
  const ctx = off.getContext("2d");
  if (!ctx) return "";
  const src = layer.getContext("2d")?.getImageData(0, 0, layer.width, layer.height);
  if (!src) return "";
  const out = ctx.createImageData(layer.width, layer.height);
  for (let i = 0; i < src.data.length; i += 4) {
    const painted = src.data[i + 3] > 0;
    out.data[i] = 255;
    out.data[i + 1] = 255;
    out.data[i + 2] = 255;
    out.data[i + 3] = painted ? 0 : 255;
  }
  ctx.putImageData(out, 0, 0);
  return off.toDataURL("image/png");
}

export const PartMaskCanvas = forwardRef<PartMaskCanvasHandle, PartMaskCanvasProps>(
  function PartMaskCanvas({ imageSrc, activePart, tool, erase }, ref) {
    const displayRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const layersRef = useRef<Partial<Record<FinishPart, HTMLCanvasElement>>>({});
    const drawingRef = useRef(false);
    const startRef = useRef<MaskPoint>({ x: 0, y: 0 });
    const pointsRef = useRef<MaskPoint[]>([]);
    const currentRef = useRef<{ end: MaskPoint; points: MaskPoint[] } | null>(null);
    const [ready, setReady] = useState(false);

    const redraw = useCallback(
      (previewShape?: { end: MaskPoint; points: MaskPoint[] } | null) => {
        const canvas = displayRef.current;
        const img = imageRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const [part, layer] of Object.entries(layersRef.current) as [
          FinishPart,
          HTMLCanvasElement,
        ][]) {
          if (!layerHasPaint(layer)) continue;
          const tint = document.createElement("canvas");
          tint.width = canvas.width;
          tint.height = canvas.height;
          const tctx = tint.getContext("2d");
          if (!tctx) continue;
          tctx.drawImage(layer, 0, 0);
          tctx.globalCompositeOperation = "source-in";
          tctx.fillStyle = PART_OVERLAY[part];
          tctx.fillRect(0, 0, tint.width, tint.height);
          ctx.drawImage(tint, 0, 0);
        }
        if (previewShape) {
          strokeShapePreview(
            ctx,
            tool,
            startRef.current,
            previewShape.end,
            previewShape.points
          );
        }
      },
      [tool]
    );

    const setup = useCallback(
      (src: string) => {
        const canvas = displayRef.current;
        const container = containerRef.current;
        if (!canvas) return;
        const img = new Image();
        img.onload = () => {
          imageRef.current = img;
          const maxW = container?.clientWidth || 600;
          const maxH = Math.max(container?.clientHeight || 400, 256);
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          layersRef.current = {};
          setReady(true);
          redraw();
        };
        img.src = src;
      },
      [redraw]
    );

    useEffect(() => {
      setup(imageSrc);
    }, [imageSrc, setup]);

    const posFromEvent = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
      const canvas = displayRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ("touches" in e) {
        const t = e.touches[0];
        if (!t) return { x: 0, y: 0 };
        return {
          x: (t.clientX - rect.left) * scaleX,
          y: (t.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const commitShape = (end: MaskPoint, points: MaskPoint[]) => {
      const canvas = displayRef.current;
      if (!canvas) return;
      let layer = layersRef.current[activePart];
      if (!layer) {
        layer = makeLayer(canvas.width, canvas.height);
        layersRef.current[activePart] = layer;
      }
      const ctx = layer.getContext("2d");
      if (!ctx) return;
      fillShape(ctx, tool, startRef.current, end, points, {
        erase,
        fillStyle: "rgba(255,255,255,1)",
      });
      currentRef.current = null;
      redraw();
    };

    const startDraw = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
      const pos = posFromEvent(e);
      drawingRef.current = true;
      startRef.current = pos;
      pointsRef.current = [pos];
      currentRef.current = { end: pos, points: [pos] };
      redraw(currentRef.current);
    };

    const moveDraw = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
      if (!drawingRef.current) return;
      const pos = posFromEvent(e);
      if (tool === "lasso") pointsRef.current = [...pointsRef.current, pos];
      currentRef.current = { end: pos, points: pointsRef.current };
      redraw(currentRef.current);
    };

    const endDraw = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const current = currentRef.current;
      commitShape(current?.end ?? startRef.current, current?.points ?? pointsRef.current);
    };

    useImperativeHandle(ref, () => ({
      getMasks: () => {
        const out: Partial<Record<FinishPart, string>> = {};
        for (const [part, layer] of Object.entries(layersRef.current) as [
          FinishPart,
          HTMLCanvasElement,
        ][]) {
          if (layerHasPaint(layer)) out[part] = layerToOpenAiMask(layer);
        }
        return out;
      },
      getSize: () => {
        const canvas = displayRef.current;
        return {
          width: canvas?.width ?? 0,
          height: canvas?.height ?? 0,
        };
      },
      clearActive: () => {
        const canvas = displayRef.current;
        if (!canvas) return;
        layersRef.current[activePart] = makeLayer(canvas.width, canvas.height);
        redraw();
      },
    }));

    return (
      <div ref={containerRef} className="relative flex-1 min-h-64">
        <canvas
          ref={displayRef}
          className={`h-full w-full object-contain ${erase ? "cursor-cell" : "cursor-crosshair"}`}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={(e) => {
            e.preventDefault();
            startDraw(e);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            moveDraw(e);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            endDraw();
          }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            読み込み中...
          </div>
        )}
      </div>
    );
  }
);
