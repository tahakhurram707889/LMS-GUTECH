begin;
create function public.member_labels(p_course uuid,p_ids uuid[])
returns table(id uuid,full_name text,role public.user_role) language plpgsql stable security definer set search_path='' as $$
begin
  if not public.ready_user() or not public.can_read_course(p_course) or cardinality(p_ids)>100 then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query select p.id,p.full_name,p.role from public.profiles p where p.id=any(p_ids) and (
    exists(select 1 from public.enrollments e where e.course_id=p_course and e.student_id=p.id)
    or exists(select 1 from public.course_teachers t where t.course_id=p_course and t.teacher_id=p.id)
    or exists(select 1 from public.chat_messages m where m.course_id=p_course and m.sender_id=p.id));
end $$;
revoke all on function public.member_labels(uuid,uuid[]) from public,anon;
grant execute on function public.member_labels(uuid,uuid[]) to authenticated;
commit;
