alter table public.project_assets
  drop constraint if exists project_assets_mode_check;

alter table public.project_assets
  add constraint project_assets_mode_check
  check (mode in ('render', 'redesign', 'staging', 'edit', 'enhance', 'gemini'));

insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', false)
on conflict (id) do nothing;

drop policy if exists "generated_images_storage_select" on storage.objects;
create policy "generated_images_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
