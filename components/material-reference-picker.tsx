"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MaterialReferencePickerProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /** 編集モードなど、場所指定と組み合わせる説明 */
  hint?: string;
}

export function MaterialReferencePicker({
  value,
  onChange,
  hint = "床・壁・ファブリックなどの質感サンプルを指定できます",
}: MaterialReferencePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      onChange(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        参考素材
      </p>
      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{hint}</p>

      {value ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-border bg-stone-50 aspect-video">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="参考素材"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => inputRef.current?.click()}
            >
              差し替え
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onChange(null)}
            >
              クリア
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`w-full rounded-lg border-2 border-dashed px-3 py-4 text-sm transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-accent/30"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <span className="font-medium text-foreground">参考素材を読み込む</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            クリックまたはドラッグ
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
