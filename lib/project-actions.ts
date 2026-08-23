"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import {
  actionFail,
  actionOk,
  errorMessage,
  type ActionResult,
} from "@/lib/action-result";

export type ProjectMode =
  | "render"
  | "redesign"
  | "staging"
  | "edit"
  | "enhance";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  myRole?: "owner" | "member";
}

export interface ProjectAsset {
  id: string;
  projectId: string;
  mode: ProjectMode;
  afterUrl: string;
  beforeUrl?: string;
  afterPath: string;
  beforePath?: string;
  params: unknown;
  createdAt: string;
  createdBy: string;
}

export interface ProjectMember {
  userId: string;
  email: string;
  displayName: string | null;
  role: "owner" | "member";
  createdAt: string;
}

const BUCKET = "project-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

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

export async function listProjects(): Promise<ActionResult<Project[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionOk([]);

    const { data: memberships, error: memErr } = await supabase
      .from("project_members")
      .select("project_id, role")
      .eq("user_id", user.id);
    if (memErr) return actionFail(memErr.message);

    const roleByProject = new Map(
      (memberships ?? []).map((m) => [
        m.project_id,
        m.role as "owner" | "member",
      ])
    );
    const ids = [...roleByProject.keys()];
    if (ids.length === 0) return actionOk([]);

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, owner_id, created_at, updated_at")
      .in("id", ids)
      .order("updated_at", { ascending: false });
    if (error) return actionFail(error.message);

    return actionOk(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ownerId: row.owner_id,
        myRole: roleByProject.get(row.id),
      }))
    );
  } catch (err) {
    return actionFail(errorMessage(err, "Projectsの取得に失敗しました"));
  }
}

export async function createProject(
  name: string
): Promise<ActionResult<Project>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionFail("ログインが必要です");

    // getUser() で身元確認済みのため、サービスロールで RLS をバイパスして INSERT
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("projects")
      .insert({
        name: name.trim() || "無題のProject",
        owner_id: user.id,
      })
      .select("id, name, owner_id, created_at, updated_at")
      .single();

    if (error || !data) {
      return actionFail(error?.message ?? "Projectの作成に失敗しました");
    }

    // Trigger が未設定の場合に備え、オーナーを project_members に追加
    await admin
      .from("project_members")
      .upsert(
        { project_id: data.id, user_id: user.id, role: "owner" },
        { onConflict: "project_id,user_id" }
      );

    return actionOk({
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      ownerId: data.owner_id,
      myRole: "owner",
    });
  } catch (err) {
    return actionFail(errorMessage(err, "Projectの作成に失敗しました"));
  }
}

export async function createProjectWithLocalId(
  name: string,
  localId: string
): Promise<ActionResult<Project>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionFail("ログインが必要です");

    const { data: existing } = await supabase
      .from("projects")
      .select("id, name, owner_id, created_at, updated_at")
      .eq("local_id", localId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (existing) {
      return actionOk({
        id: existing.id,
        name: existing.name,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
        ownerId: existing.owner_id,
        myRole: "owner",
      });
    }

    const admin = createServiceClient();
    const { data, error } = await admin
      .from("projects")
      .insert({
        name: name.trim() || "無題のProject",
        owner_id: user.id,
        local_id: localId,
      })
      .select("id, name, owner_id, created_at, updated_at")
      .single();

    if (error || !data) {
      return actionFail(error?.message ?? "Projectの作成に失敗しました");
    }

    await admin
      .from("project_members")
      .upsert(
        { project_id: data.id, user_id: user.id, role: "owner" },
        { onConflict: "project_id,user_id" }
      );

    return actionOk({
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      ownerId: data.owner_id,
      myRole: "owner",
    });
  } catch (err) {
    return actionFail(errorMessage(err, "Projectの作成に失敗しました"));
  }
}

export async function renameProject(
  id: string,
  name: string
): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: name.trim() || "無題のProject",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name, owner_id, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    ownerId: data.owner_id,
    myRole: "owner",
  };
}

export async function touchProject(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient();

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
    await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, owner_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  let myRole: "owner" | "member" | undefined;
  if (user) {
    const { data: mem } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    myRole = mem?.role as "owner" | "member" | undefined;
  }

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    ownerId: data.owner_id,
    myRole,
  };
}

export async function addAssetToProject(input: {
  projectId: string;
  mode: ProjectMode;
  afterDataUrl: string;
  beforeDataUrl?: string;
  params: unknown;
  localId?: string;
}): Promise<ProjectAsset> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  if (input.localId) {
    const { data: existing } = await supabase
      .from("project_assets")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("local_id", input.localId)
      .maybeSingle();
    if (existing) {
      const listed = await listAssets(input.projectId);
      const found = listed.find((a) => a.id === existing.id);
      if (found) return found;
    }
  }

  const assetId = crypto.randomUUID();

  const { buffer: afterBuffer } = dataUrlToBuffer(input.afterDataUrl);
  const afterPath = `${input.projectId}/${assetId}_after.jpg`;
  const { error: afterErr } = await supabase.storage
    .from(BUCKET)
    .upload(afterPath, afterBuffer, { contentType: "image/jpeg", upsert: true });
  if (afterErr) throw new Error(afterErr.message);

  let beforePath: string | null = null;
  if (input.beforeDataUrl) {
    const { buffer: beforeBuffer } = dataUrlToBuffer(input.beforeDataUrl);
    beforePath = `${input.projectId}/${assetId}_before.jpg`;
    const { error: beforeErr } = await supabase.storage
      .from(BUCKET)
      .upload(beforePath, beforeBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (beforeErr) {
      await supabase.storage.from(BUCKET).remove([afterPath]);
      throw new Error(beforeErr.message);
    }
  }

  const { data, error } = await supabase
    .from("project_assets")
    .insert({
      id: assetId,
      project_id: input.projectId,
      mode: input.mode,
      after_path: afterPath,
      before_path: beforePath,
      params: (input.params ?? null) as Json,
      created_by: user.id,
      local_id: input.localId ?? null,
    })
    .select(
      "id, project_id, mode, after_path, before_path, params, created_at, created_by"
    )
    .single();

  if (error || !data) {
    await supabase.storage
      .from(BUCKET)
      .remove([afterPath, beforePath].filter(Boolean) as string[]);
    throw new Error(error?.message ?? "成果物の保存に失敗しました");
  }

  await touchProject(input.projectId);

  const afterUrl = await makeSignedUrl(supabase, data.after_path);
  const beforeUrl = data.before_path
    ? await makeSignedUrl(supabase, data.before_path)
    : undefined;

  return {
    id: data.id,
    projectId: data.project_id,
    mode: data.mode as ProjectMode,
    afterUrl,
    beforeUrl,
    afterPath: data.after_path,
    beforePath: data.before_path ?? undefined,
    params: data.params,
    createdAt: data.created_at,
    createdBy: data.created_by,
  };
}

export async function listAssets(
  projectId: string
): Promise<ProjectAsset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_assets")
    .select(
      "id, project_id, mode, after_path, before_path, params, created_at, created_by"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const assets: ProjectAsset[] = [];
  for (const row of data ?? []) {
    const afterUrl = await makeSignedUrl(supabase, row.after_path);
    const beforeUrl = row.before_path
      ? await makeSignedUrl(supabase, row.before_path)
      : undefined;
    assets.push({
      id: row.id,
      projectId: row.project_id,
      mode: row.mode as ProjectMode,
      afterUrl,
      beforeUrl,
      afterPath: row.after_path,
      beforePath: row.before_path ?? undefined,
      params: row.params,
      createdAt: row.created_at,
      createdBy: row.created_by,
    });
  }
  return assets;
}

export async function countAssets(projectId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("project_assets")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function deleteAsset(assetId: string): Promise<void> {
  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("project_assets")
    .select("project_id, after_path, before_path")
    .eq("id", assetId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing) return;

  const paths = [existing.after_path];
  if (existing.before_path) paths.push(existing.before_path);
  await supabase.storage.from(BUCKET).remove(paths);

  const { error } = await supabase
    .from("project_assets")
    .delete()
    .eq("id", assetId);
  if (error) throw new Error(error.message);

  await touchProject(existing.project_id);
}

export async function listProjectMembers(
  projectId: string
): Promise<ProjectMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id, role, created_at, profiles(email, display_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      email: string;
      display_name: string | null;
    } | null;
    return {
      userId: row.user_id,
      email: profile?.email ?? "",
      displayName: profile?.display_name ?? null,
      role: row.role as "owner" | "member",
      createdAt: row.created_at,
    };
  });
}

export async function addProjectMemberByEmail(
  projectId: string,
  email: string
): Promise<void> {
  const supabase = await createClient();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("メールアドレスを入力してください");

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", normalized)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);
  if (!profile) {
    throw new Error(
      "このメールのユーザーはまだツールに招待されていません。管理者にアカウント招待を依頼してください。"
    );
  }

  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: profile.id,
    role: "member",
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("すでに共有されています");
    }
    throw new Error(error.message);
  }
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("role", "member");
  if (error) throw new Error(error.message);
}

export async function listOrgProfiles(): Promise<
  { id: string; email: string; displayName: string | null }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .order("email", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? null,
  }));
}
