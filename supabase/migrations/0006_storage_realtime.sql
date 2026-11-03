begin;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
 ('resources','resources',false,26214400,array[
   'application/pdf',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'application/vnd.openxmlformats-officedocument.presentationml.presentation',
   'image/jpeg','image/png','image/webp','application/zip']),
 ('submissions','submissions',false,26214400,array[
   'application/pdf',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'application/vnd.openxmlformats-officedocument.presentationml.presentation',
   'image/jpeg','image/png','image/webp','application/zip']),
 ('complaint-attachments','complaint-attachments',false,10485760,array[
   'application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- SELECT also permits createSignedUrl with a caller JWT. No browser upload policy:
-- Phase 2 adds API-controlled uploads after checking actual magic bytes, not headers.
create policy resource_objects_read on storage.objects for select to authenticated
using (bucket_id = 'resources' and exists(select 1 from public.resources r
  where r.file_path = name and public.can_read_course(r.course_id)));
create policy assignment_attachment_read on storage.objects for select to authenticated
using (bucket_id = 'resources' and exists(select 1 from public.assignments a
  where a.attachment_path = name and public.can_read_course(a.course_id)));
create policy submission_objects_read on storage.objects for select to authenticated
using (bucket_id = 'submissions' and exists(select 1 from public.submissions s
  where s.file_path = name));
create policy complaint_objects_read on storage.objects for select to authenticated
using (bucket_id = 'complaint-attachments' and exists(select 1 from public.complaints c
  where c.attachment_path = name));

alter table public.chat_messages replica identity full;
alter table public.announcements replica identity full;
do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists(select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements') then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;
commit;
