begin;
-- Only a real Auth password-hash change clears the first-login gate. A browser
-- cannot call a public RPC to set must_change_password=false itself.
create function public.on_auth_password_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.encrypted_password is distinct from new.encrypted_password then
    update public.profiles set must_change_password=false where id=new.id;
  end if;
  return new;
end $$;
create trigger lms_password_changed after update of encrypted_password on auth.users
for each row execute function public.on_auth_password_change();

create or replace function public.active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active);
$$;
create function public.ready_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and not p.must_change_password);
$$;
create function public.record_audit(p_action text,p_entity text,p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ready_user() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),p_action,p_entity,p_id);
end $$;
-- This function is private to other SQL functions, not a browser audit-forgery API.
revoke all on function public.record_audit(text,text,uuid) from public,anon,authenticated;
revoke all on function public.ready_user(), public.on_auth_password_change() from public,anon,authenticated;
grant execute on function public.ready_user() to authenticated;

-- Restrictive policies combine with existing scoped policies: forced-password
-- accounts may read their profile for login but cannot access LMS data directly.
do $$
declare t text;
begin
  foreach t in array array['courses','course_teachers','enrollments','resources','assignments','submissions',
    'quizzes','quiz_questions','quiz_answers','quiz_attempts','announcements','announcement_reads','audit_log','chat_messages','complaints'] loop
    execute format('create policy password_gate on public.%I as restrictive for all to authenticated using (public.ready_user()) with check (public.ready_user())',t);
  end loop;
end $$;

create function public.course_members(p_course uuid,p_page int default 1,p_size int default 20)
returns table(id uuid,full_name text,role public.user_role) language plpgsql stable security definer set search_path='' as $$
begin
  if not public.ready_user() or not public.can_read_course(p_course) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query select p.id,p.full_name,p.role from public.profiles p
    where p.is_active and (exists(select 1 from public.enrollments e where e.course_id=p_course and e.student_id=p.id)
      or exists(select 1 from public.course_teachers t where t.course_id=p_course and t.teacher_id=p.id))
    order by p.full_name,p.id limit least(greatest(p_size,1),100) offset (greatest(p_page,1)-1)*least(greatest(p_size,1),100);
end $$;
revoke all on function public.course_members(uuid,int,int) from public,anon;
grant execute on function public.course_members(uuid,int,int) to authenticated;
commit;
