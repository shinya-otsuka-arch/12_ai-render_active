"use server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "style-library";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;
const MAX_ITEMS = 24;

export interface StyleLibraryItem {
  id: string;
  imageUrl: string;
  imagePath: string;
  styleBrief?: string;
  label?: string;
  createdAt: string;
  createdBy: string;
  canDelete?: boolean;
}

async function makeSignedUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) {
    throw new Error("署名付き URL の取得に失敗しました");
  }
  return data.signedUrl;
}

function dataUrlToBuffer(
  dataUrl: string
): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("不正な data URL です");
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function listStyleLibrary(): Promise<StyleLibraryItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("style_library")
    .select("id, image_path, style_brief, label, created_at, created_by")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const items: StyleLibraryItem[] = [];
  for (const row of data ?? []) {
    const imageUrl = await makeSignedUrl(supabase, row.image_path);
    items.push({
      id: row.id,
      imageUrl,
      imagePath: row.image_path,
      styleBrief: row.style_brief ?? undefined,
      label: row.label ?? undefined,
      createdAt: row.created_at,
      createdBy: row.created_by,
      canDelete: user?.id === row.created_by,
    });
  }
  return items;
}

export async function addStyleLibraryImage(input: {
  dataUrl: string;
  label?: string;
  localId?: string;
  styleBrief?: string;
}): Promise<StyleLibraryItem> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  if (input.localId) {
    const { data: existing } = await supabase
      .from("style_library")
      .select("id")
      .eq("local_id", input.localId)
      .eq("created_by", user.id)
      .maybeSingle();
    if (existing) {
      const all = await listStyleLibrary();
      const found = all.find((i) => i.id === existing.id);
      if (found) return found;
    }
  }

  const { count: currentCount } = await supabase
    .from("style_library")
    .select("id", { count: "exact", head: true });
  if ((currentCount ?? 0) >= MAX_ITEMS) {
    throw new Error(`画像登録は最大${MAX_ITEMS}枚までです`);
  }

  const { buffer, contentType } = dataUrlToBuffer(input.dataUrl);
  const id = crypto.randomUUID();
  const path = `${user.id}/${id}.jpg`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (uploadErr) throw new Error(uploadErr.message);

  const { data, error } = await supabase
    .from("style_library")
    .insert({
      id,
      image_path: path,
      label: input.label?.trim() || null,
      created_by: user.id,
      local_id: input.localId ?? null,
      style_brief: input.styleBrief ?? null,
    })
    .select("id, image_path, style_brief, label, created_at, created_by")
    .single();

  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error?.message ?? "画像登録の追加に失敗しました");
  }

  const imageUrl = await makeSignedUrl(supabase, data.image_path);
  return {
    id: data.id,
    imageUrl,
    imagePath: data.image_path,
    styleBrief: data.style_brief ?? undefined,
    label: data.label ?? undefined,
    createdAt: data.created_at,
    createdBy: data.created_by,
    canDelete: true,
  };
}

export async function deleteStyleLibraryItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("style_library")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing) return;

  const { error } = await supabase
    .from("style_library")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.storage.from(BUCKET).remove([existing.image_path]);
}

export async function updateStyleBrief(
  id: string,
  styleBrief: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("style_library")
    .update({ style_brief: styleBrief })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getStyleLibrarySignedUrls(
  paths: string[]
): Promise<string[]> {
  const supabase = await createClient();
  return Promise.all(paths.map((p) => makeSignedUrl(supabase, p)));
}
