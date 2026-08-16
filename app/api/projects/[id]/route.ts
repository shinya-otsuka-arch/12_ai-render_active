import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { id } = await params;
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const name = (body.name ?? "").trim() || "無題の案件";

  const { data, error } = await supabase
    .from("projects")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, owner_id, created_at, updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });

  return NextResponse.json({
    project: {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      ownerId: data.owner_id,
    },
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const { id } = await params;

  const { data: assets } = await supabase
    .from("project_assets")
    .select("after_path, before_path")
    .eq("project_id", id);

  const paths: string[] = [];
  for (const a of assets ?? []) {
    paths.push(a.after_path);
    if (a.before_path) paths.push(a.before_path);
  }
  if (paths.length > 0) {
    await supabase.storage.from("project-assets").remove(paths);
  }

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
