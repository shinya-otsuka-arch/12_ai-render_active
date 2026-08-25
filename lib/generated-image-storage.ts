import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "generated-images";
const SIGNED_URL_TTL = 60 * 60 * 24 * 30;

export async function storeGeneratedImage(input: {
  userId: string;
  base64: string;
  mimeType: string;
}): Promise<string> {
  const extension = input.mimeType === "image/png" ? "png" : "jpg";
  const path = `${input.userId}/${crypto.randomUUID()}.${extension}`;
  const supabase = createServiceClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(input.base64, "base64"), {
      contentType: input.mimeType,
      upsert: false,
    });
  if (error) throw new Error(`生成画像の保存に失敗しました: ${error.message}`);

  const { data, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signedError || !data?.signedUrl) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error("生成画像URLの作成に失敗しました");
  }
  return data.signedUrl;
}
