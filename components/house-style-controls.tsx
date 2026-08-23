"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  getApplyHouseStyle,
  getOrBuildLibraryStyleBrief,
  listStyleLibrary,
  setApplyHouseStyle,
} from "@/lib/style-library-store";
import { MaterialReferencePicker } from "@/components/material-reference-picker";

export interface HouseStyleSelection {
  houseStyleBrief?: string;
  styleImages: string[];
  styleStrength: number;
  applyHouseStyle: boolean;
}

interface HouseStyleControlsProps {
  value: HouseStyleSelection;
  onChange: (next: HouseStyleSelection) => void;
}

export function HouseStyleControls({ value, onChange }: HouseStyleControlsProps) {
  const [libraryCount, setLibraryCount] = useState(0);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const refreshCount = useCallback(async () => {
    const items = await listStyleLibrary();
    setLibraryCount(items.length);
  }, []);

  useEffect(() => {
    void refreshCount();
    const apply = getApplyHouseStyle();
    if (apply !== valueRef.current.applyHouseStyle) {
      onChange({ ...valueRef.current, applyHouseStyle: apply });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount sync only
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!value.applyHouseStyle || libraryCount === 0) {
        if (valueRef.current.houseStyleBrief) {
          onChange({ ...valueRef.current, houseStyleBrief: undefined });
        }
        return;
      }
      setLoadingBrief(true);
      try {
        const brief = await getOrBuildLibraryStyleBrief();
        if (!cancelled && brief !== valueRef.current.houseStyleBrief) {
          onChange({ ...valueRef.current, houseStyleBrief: brief ?? undefined });
        }
      } catch {
        /* Vision 失敗時は brief 無しで続行 */
      } finally {
        if (!cancelled) setLoadingBrief(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.applyHouseStyle, libraryCount]);

  const sessionStyle = value.styleImages[0] ?? null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          画像登録
        </p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={value.applyHouseStyle}
            onChange={(e) => {
              setApplyHouseStyle(e.target.checked);
              onChange({ ...value, applyHouseStyle: e.target.checked });
            }}
          />
          <span>
            画像登録を適用
            <span className="block text-xs text-muted-foreground mt-0.5">
              {libraryCount === 0
                ? "ライブラリに事例がありません"
                : loadingBrief
                  ? `解析中（${libraryCount}枚）…`
                  : `${libraryCount}枚の事例から作風を適用`}
            </span>
          </span>
        </label>
        <Link
          href="/style-library"
          className="mt-2 inline-block text-xs text-primary underline"
        >
          画像登録を管理
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            作風の強さ
          </p>
          <span className="text-xs text-muted-foreground">
            {value.styleStrength.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[value.styleStrength]}
          onValueChange={(val) => {
            const n = Array.isArray(val) ? val[0] : (val as number);
            onChange({ ...value, styleStrength: n });
          }}
          min={0.3}
          max={1}
          step={0.05}
          className="w-full"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">控えめ</span>
          <span className="text-xs text-muted-foreground">厳密</span>
        </div>
      </div>

      <Separator />

      <MaterialReferencePicker
        value={sessionStyle}
        onChange={(dataUrl) =>
          onChange({
            ...value,
            styleImages: dataUrl ? [dataUrl] : [],
          })
        }
        title="作風参考（今回のみ）"
        hint="施工事例・好みのパースなど。社内ライブラリと併用できます"
      />
    </div>
  );
}

export function emptyHouseStyleSelection(): HouseStyleSelection {
  return {
    styleImages: [],
    styleStrength: 0.75,
    applyHouseStyle: typeof window !== "undefined" ? getApplyHouseStyle() : true,
  };
}

export function houseStyleToApiFields(style: HouseStyleSelection): {
  styleImages?: string[];
  houseStyleBrief?: string;
  styleStrength: number;
} {
  return {
    styleImages: style.styleImages.length ? style.styleImages : undefined,
    houseStyleBrief:
      style.applyHouseStyle && style.houseStyleBrief
        ? style.houseStyleBrief
        : undefined,
    styleStrength: style.styleStrength,
  };
}
