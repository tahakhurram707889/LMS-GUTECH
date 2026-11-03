begin;
create function public.marks_summary(p_course uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.ready_user() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object('obtained',coalesce(sum(obtained),0),'maximum',coalesce(sum(max),0),
    'percentage',coalesce(round(100*sum(obtained)/nullif(sum(max),0),2),0)) into result
  from public.v_student_marks where student_id=auth.uid() and obtained is not null and (p_course is null or course_id=p_course);
  return result;
end $$;
create function public.my_metrics() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.ready_user() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object(
    'courses',(select count(*) from public.courses c where not c.is_archived and public.can_read_course(c.id)),
    'submissions',(select count(*) from public.submissions where student_id=auth.uid()),
    'quizzesCompleted',(select count(*) from public.quiz_attempts where student_id=auth.uid() and submitted_at is not null),
    'marks',public.marks_summary(null));
end $$;
create function public.gradebook_page(p_course uuid,p_page int default 1,p_size int default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb; students jsonb;
begin
  if not public.ready_user() or not public.can_manage_course(p_course) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select coalesce(jsonb_agg(x),'[]') into items from (
    select id,title,'assignment'::text as kind,max_marks as maximum from public.assignments where course_id=p_course
    union all select q.id,q.title,'quiz',coalesce(sum(qq.marks),0) from public.quizzes q left join public.quiz_questions qq on qq.quiz_id=q.id where q.course_id=p_course group by q.id
  ) x;
  select coalesce(jsonb_agg(row_data),'[]') into students from (
    select jsonb_build_object('id',p.id,'name',p.full_name,'roll_no',p.roll_no,
      'marks',coalesce((select jsonb_agg(to_jsonb(m)) from public.v_student_marks m where m.course_id=p_course and m.student_id=p.id),'[]'),
      'obtained',coalesce((select sum(m.obtained) from public.v_student_marks m where m.course_id=p_course and m.student_id=p.id and m.obtained is not null),0),
      'maximum',coalesce((select sum(m.max) from public.v_student_marks m where m.course_id=p_course and m.student_id=p.id and m.obtained is not null),0)) as row_data
    from public.profiles p join public.enrollments e on e.student_id=p.id where e.course_id=p_course
    order by p.full_name,p.id limit least(greatest(p_size,1),100) offset (greatest(p_page,1)-1)*least(greatest(p_size,1),100)
  ) rows;
  return jsonb_build_object('items',items,'students',students,'total',(select count(*) from public.enrollments where course_id=p_course));
end $$;
revoke all on function public.marks_summary(uuid),public.my_metrics(),public.gradebook_page(uuid,int,int) from public,anon;
grant execute on function public.marks_summary(uuid),public.my_metrics(),public.gradebook_page(uuid,int,int) to authenticated;
create function public.audit_core_changes() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then
    insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),lower(tg_op),tg_table_name,new.id);
  end if;
  return new;
end $$;
revoke all on function public.audit_core_changes() from public,anon,authenticated;
create trigger audit_course after insert or update on public.courses for each row execute function public.audit_core_changes();
commit;
