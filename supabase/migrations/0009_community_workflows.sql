begin;
create table public.notifications (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,body text not null,read_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index notifications_user_date on public.notifications(user_id,created_at desc);
alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy notices_own on public.notifications for select to authenticated using(public.ready_user() and user_id=auth.uid());
create trigger notifications_updated before update on public.notifications for each row execute function public.touch_updated_at();

create function public.community_write(p_action text,p_id uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid; result_id uuid; msg public.chat_messages; note public.announcements; complaint public.complaints; r public.resources; staff boolean; new_status public.complaint_status;
begin
  if not public.ready_user() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select role in ('teacher','admin') into staff from public.profiles where id=auth.uid();
  if p_action='message.send' then
    c:=p_id;
    if not public.can_read_course(c) or public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
    if (select count(*) from public.chat_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then
      raise exception 'Message rate limit exceeded' using errcode='P0429'; end if;
    insert into public.chat_messages(course_id,sender_id,body) values(c,auth.uid(),p_data->>'body') returning id into result_id;
  elsif p_action='message.delete' then
    select * into msg from public.chat_messages where id=p_id for update;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    if not public.can_read_course(msg.course_id) or not (public.can_manage_course(msg.course_id)
      or (msg.sender_id=auth.uid() and now()<=msg.created_at+interval '5 minutes')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    update public.chat_messages set body='[Message deleted]',deleted_at=now() where id=p_id; result_id:=p_id;
  elsif p_action in ('announcement.create','announcement.update','announcement.delete') then
    if p_action<>'announcement.create' then
      select * into note from public.announcements where id=p_id for update;
      if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
      if not public.is_admin() and (note.author_id<>auth.uid() or not public.teaches(note.course_id)) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
      c:=note.course_id;
    else c:=(p_data->>'courseId')::uuid; end if;
    if not staff or (c is null and not public.is_admin()) or (c is not null and not public.can_manage_course(c)) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if p_action='announcement.delete' then delete from public.announcements where id=p_id; result_id:=p_id;
    elsif p_action='announcement.update' then update public.announcements set title=p_data->>'title',body=p_data->>'body',is_pinned=coalesce((p_data->>'isPinned')::boolean,false) where id=p_id returning id into result_id;
    else insert into public.announcements(course_id,author_id,title,body,is_pinned) values(c,auth.uid(),p_data->>'title',p_data->>'body',coalesce((p_data->>'isPinned')::boolean,false)) returning id into result_id; end if;
  elsif p_action='announcement.read' then
    insert into public.announcement_reads(user_id,announcement_id)
    select auth.uid(),id from public.announcements where created_at<=least(now(),(p_data->>'before')::timestamptz)
      and (course_id is null or public.can_read_course(course_id)) on conflict do nothing;
    return '{}'::jsonb;
  elsif p_action='complaint.create' then
    if public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    c:=(p_data->>'courseId')::uuid;
    if c is not null and not public.can_read_course(c) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if p_data->>'attachmentPath' is not null and p_data->>'attachmentPath' not like auth.uid()::text||'/%' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    insert into public.complaints(raised_by,course_id,category,subject,description,attachment_path)
    values(auth.uid(),c,p_data->>'category',p_data->>'subject',p_data->>'description',p_data->>'attachmentPath') returning id into result_id;
  elsif p_action='complaint.review' then
    if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    select * into complaint from public.complaints where id=p_id for update;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    new_status:=(p_data->>'status')::public.complaint_status;
    if not ((complaint.status='open' and new_status='in_review') or (complaint.status='in_review' and new_status in ('resolved','rejected'))) then raise exception 'Invalid complaint status transition' using errcode='P0001'; end if;
    update public.complaints set status=new_status,admin_response=p_data->>'adminResponse',resolved_by=auth.uid() where id=p_id;
    insert into public.notifications(user_id,title,body) values(complaint.raised_by,'Complaint status updated',complaint.subject||': '||new_status::text);
    result_id:=p_id;
  elsif p_action='notification.read' then
    update public.notifications set read_at=now() where user_id=auth.uid() and read_at is null; return '{}'::jsonb;
  elsif p_action='resource.create' then
    c:=(p_data->>'courseId')::uuid;
    if not public.can_manage_course(c) or p_data->>'filePath' not like c::text||'/'||auth.uid()::text||'/%' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    insert into public.resources(course_id,uploaded_by,title,description,file_path,file_name,mime_type,size_bytes)
    values(c,auth.uid(),p_data->>'title',p_data->>'description',p_data->>'filePath',p_data->>'fileName',p_data->>'mimeType',(p_data->>'sizeBytes')::bigint) returning id into result_id;
  elsif p_action='resource.delete' then
    select * into r from public.resources where id=p_id for update;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    if not public.is_admin() and (r.uploaded_by<>auth.uid() or not public.teaches(r.course_id)) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    delete from public.resources where id=p_id; result_id:=p_id;
  else raise exception 'Unknown community operation' using errcode='23514'; end if;
  perform public.record_audit(p_action,'community',result_id);
  return jsonb_build_object('id',result_id);
end $$;
revoke all on function public.community_write(text,uuid,jsonb) from public,anon;
grant execute on function public.community_write(text,uuid,jsonb) to authenticated;

-- API validates magic bytes before uploading. Paths bind course and owner; bucket
-- limits/MIME lists independently constrain direct Storage calls.
create policy resource_upload on storage.objects for insert to authenticated with check (
  bucket_id='resources' and public.ready_user() and public.can_manage_course((storage.foldername(name))[1]::uuid)
  and (storage.foldername(name))[2]=auth.uid()::text);
create policy submission_upload on storage.objects for insert to authenticated with check (
  bucket_id='submissions' and public.ready_user() and public.is_enrolled((storage.foldername(name))[1]::uuid)
  and (storage.foldername(name))[2]=auth.uid()::text);
create policy complaint_upload on storage.objects for insert to authenticated with check (
  bucket_id='complaint-attachments' and public.ready_user() and not public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
create policy own_upload_delete on storage.objects for delete to authenticated using (
  public.ready_user() and bucket_id in ('resources','submissions','complaint-attachments')
  and (public.is_admin() or (owner_id=auth.uid()::text and (
    (bucket_id='resources' and public.can_manage_course((storage.foldername(name))[1]::uuid))
    or (bucket_id='submissions' and public.is_enrolled((storage.foldername(name))[1]::uuid)
      and not exists(select 1 from public.submissions s where s.file_path=name))
    or (bucket_id='complaint-attachments' and not exists(select 1 from public.complaints c where c.attachment_path=name))
  ))));
-- Let an uploader read its object before its metadata transaction completes.
create policy own_upload_read on storage.objects for select to authenticated using (
  public.ready_user() and bucket_id in ('resources','submissions','complaint-attachments') and owner_id=auth.uid()::text
  and (bucket_id='complaint-attachments' or public.can_read_course((storage.foldername(name))[1]::uuid)));
alter publication supabase_realtime add table public.notifications;
commit;
