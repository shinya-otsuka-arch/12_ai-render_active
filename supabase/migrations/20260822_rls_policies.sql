-- =====================================================================
-- RLS Policies & Trigger setup for ai-render
-- Apply once in Supabase Dashboard → SQL Editor
-- =====================================================================

-- -------------------------------------------------------
-- profiles
-- -------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- -------------------------------------------------------
-- projects
-- -------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_insert_own"   ON public.projects;
DROP POLICY IF EXISTS "projects_select_member" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own"   ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own"   ON public.projects;

CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "projects_select_member"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id    = auth.uid()
    )
  );

CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- -------------------------------------------------------
-- project_members
-- -------------------------------------------------------
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_members_select_self"    ON public.project_members;
DROP POLICY IF EXISTS "project_members_insert_owner"   ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete_owner"   ON public.project_members;

-- 自分が所属するメンバーシップを参照できる
CREATE POLICY "project_members_select_self"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- プロジェクトオーナーがメンバー追加できる
CREATE POLICY "project_members_insert_owner"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- プロジェクトオーナーがメンバー削除できる
CREATE POLICY "project_members_delete_owner"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- project_assets
-- -------------------------------------------------------
ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_assets_select_member" ON public.project_assets;
DROP POLICY IF EXISTS "project_assets_insert_member" ON public.project_assets;
DROP POLICY IF EXISTS "project_assets_delete_any"    ON public.project_assets;

CREATE POLICY "project_assets_select_member"
  ON public.project_assets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_assets.project_id
        AND pm.user_id    = auth.uid()
    )
  );

CREATE POLICY "project_assets_insert_member"
  ON public.project_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_assets.project_id
        AND pm.user_id    = auth.uid()
    )
  );

CREATE POLICY "project_assets_delete_any"
  ON public.project_assets FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id        = project_assets.project_id
        AND p.owner_id  = auth.uid()
    )
  );

-- -------------------------------------------------------
-- Trigger: projects INSERT → project_members に owner を自動追加
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_project_owner_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_owner_member ON public.projects;
CREATE TRIGGER trg_project_owner_member
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_create_project_owner_member();
