"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readApiJson } from "@/lib/api-client";
import type { PromptRefineContext, PromptRefineMode } from "@/lib/prompt-refine";
import { toast } from "sonner";

interface PromptRefineFieldProps {
  mode: PromptRefineMode;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  hint?: string;
  textareaClassName?: string;
  context: PromptRefineContext;
  disabled?: boolean;
}

export function PromptRefineField({
  mode,
  value,
  onChange,
  label,
  placeholder,
  hint,
  textareaClassName = "text-sm resize-none h-20",
  context,
  disabled = false,
}: PromptRefineFieldProps) {
  const [refining, setRefining] = useState(false);

  const handleRefine = async () => {
    setRefining(true);
    try {
      const res = await fetch("/api/prompt-refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          draft: value,
          context,
        }),
      });
      const data = await readApiJson<{ prompt: string }>(res);
      onChange(data.prompt);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "プロンプトの作成に失敗しました"
      );
    } finally {
      setRefining(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={textareaClassName}
        disabled={disabled || refining}
      />
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="mt-2 w-full"
        onClick={() => void handleRefine()}
        disabled={disabled || refining}
      >
        {refining ? "作成中..." : "プロンプトを作成"}
      </Button>
    </div>
  );
}
