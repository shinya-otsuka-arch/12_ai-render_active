-- ArchiRender: run in Supabase SQL Editor
-- Also: Authentication → Providers → Email enabled
-- Authentication → Providers → Email → Disable "Enable sign ups" (invite-only)
-- Create first admin: Auth → Users → invite/create, then:
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create profile on signup / invite accept
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'user')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  local_id text
);

create unique index if not exists projects_owner_local_id_uidx
  on public.projects (owner_id, local_id)
  where local_id is not null;

create index if not exists projects_owner_id_idx on public.projects (owner_id);

alter table public.projects enable row level security;

-- Project members
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx on public.project_members (user_id);

alter table public.project_members enable row level security;

-- Helpers (security definer to avoid RLS recursion)
create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-add owner membership
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

create policy "projects_select_member"
  on public.projects for select
  to authenticated
  using (public.is_project_member(id));

create policy "projects_insert_own"
  on public.projects for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "projects_update_owner"
  on public.projects for update
  to authenticated
  using (public.is_project_owner(id))
  with check (public.is_project_owner(id));

create policy "projects_delete_owner"
  on public.projects for delete
  to authenticated
  using (public.is_project_owner(id));

create policy "project_members_select"
  on public.project_members for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "project_members_insert_owner"
  on public.project_members for insert
  to authenticated
  with check (
    public.is_project_owner(project_id)
    and role = 'member'
  );

create policy "project_members_delete_owner"
  on public.project_members for delete
  to authenticated
  using (
    public.is_project_owner(project_id)
    and role = 'member'
  );

-- Project assets
create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  mode text not null check (mode in ('render', 'redesign', 'staging', 'edit', 'enhance')),
  after_path text not null,
  before_path text,
  params jsonb,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  local_id text
);

create unique index if not exists project_assets_project_local_id_uidx
  on public.project_assets (project_id, local_id)
  where local_id is not null;

create index if not exists project_assets_project_id_idx on public.project_assets (project_id);

alter table public.project_assets enable row level security;

create policy "project_assets_select"
  on public.project_assets for select
  to authenticated
  using (public.is_project_member(project_id));

create policy "project_assets_insert"
  on public.project_assets for insert
  to authenticated
  with check (
    public.is_project_member(project_id)
    and created_by = auth.uid()
  );

create policy "project_assets_delete"
  on public.project_assets for delete
  to authenticated
  using (
    public.is_project_owner(project_id)
    or created_by = auth.uid()
  );

-- Style library
create table if not exists public.style_library (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  style_brief text,
  label text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  local_id text
);

create unique index if not exists style_library_creator_local_id_uidx
  on public.style_library (created_by, local_id)
  where local_id is not null;

alter table public.style_library enable row level security;

create policy "style_library_select"
  on public.style_library for select
  to authenticated
  using (true);

create policy "style_library_insert"
  on public.style_library for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "style_library_update"
  on public.style_library for update
  to authenticated
  using (true)
  with check (true);

create policy "style_library_delete_own"
  on public.style_library for delete
  to authenticated
  using (created_by = auth.uid());

-- Storage buckets (private)
insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('style-library', 'style-library', false)
on conflict (id) do nothing;

-- Storage: project-assets path = {project_id}/{filename}
create policy "project_assets_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-assets'
    and public.is_project_member((storage.foldername(name))[1]::uuid)
  );

create policy "project_assets_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-assets'
    and public.is_project_member((storage.foldername(name))[1]::uuid)
  );

create policy "project_assets_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-assets'
    and (
      public.is_project_owner((storage.foldername(name))[1]::uuid)
      or owner = auth.uid()
    )
  );

-- Storage: style-library — any authenticated can read/upload; delete own objects
create policy "style_library_storage_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'style-library');

create policy "style_library_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'style-library');

create policy "style_library_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'style-library'
    and owner = auth.uid()
  );
