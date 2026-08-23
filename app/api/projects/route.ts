import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/require-user";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  const { data: memberships, error: memErr } = await supabase
    .from("project_members")
    .select("project_id, role")
    .eq("user_id", user.id);

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  const ids = (memberships ?? []).map((m) => m.project_id);
  if (ids.length === 0) return NextResponse.json({ projects: [] });

  const roleByProject = new Map(
    (memberships ?? []).map((m) => [m.project_id, m.role as "owner" | "member"])
  );

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, owner_id, created_at, updated_at")
    .in("id", ids)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projects = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.owner_id,
    myRole: roleByProject.get(row.id),
  }));

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  let body: { name?: string; localId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const name = (body.name ?? "").trim() || "無題のProject";
  const localId = body.localId ?? null;

  if (localId) {
    const { data: existing } = await supabase
      .from("projects")
      .select("id, name, owner_id, created_at, updated_at")
      .eq("local_id", localId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        project: {
          id: existing.id,
          name: existing.name,
          createdAt: existing.created_at,
          updatedAt: existing.updated_at,
          ownerId: existing.owner_id,
          myRole: "owner",
        },
      });
    }
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, owner_id: user.id, local_id: localId })
    .select("id, name, owner_id, created_at, updated_at")
    .single();

  if (error || !data)
    return NextResponse.json(
      { error: error?.message ?? "Projectの作成に失敗しました" },
      { status: 500 }
    );

  return NextResponse.json({
    project: {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      ownerId: data.owner_id,
      myRole: "owner",
    },
  });
}
