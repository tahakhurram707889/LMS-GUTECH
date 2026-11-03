begin;
-- Preserve every Auth ID, role, membership and academic foreign key.
alter table public.profiles add column username text;
update public.profiles set username =
  coalesce(nullif(left(trim(both '-' from regexp_replace(lower(split_part(email,'@',1)), '[^a-z0-9]+', '-', 'g')),24),''),'user')
  || '-' || replace(id::text,'-','');
alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format check (
  username = lower(username) and char_length(username) between 3 and 64 and username ~ '^[a-z0-9][a-z0-9._-]*$'
);
create unique index profiles_username_unique on public.profiles(lower(username));
-- Existing grants permit only full_name updates, never username/role.
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null check(char_length(code) between 1 and 30),
  name text not null check(char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index departments_code_unique on public.departments(lower(code));
alter table public.departments enable row level security;
grant select,insert,update on public.departments to authenticated;
grant all on public.departments to service_role;
create policy departments_read on public.departments for select to authenticated using(public.ready_user());
create policy departments_admin_insert on public.departments for insert to authenticated with check(public.ready_user() and public.is_admin());
create policy departments_admin_update on public.departments for update to authenticated using(public.ready_user() and public.is_admin()) with check(public.ready_user() and public.is_admin());
create trigger departments_updated before update on public.departments for each row execute function public.touch_updated_at();
alter table public.courses add column department_id uuid references public.departments(id) on delete restrict;
create index courses_department_idx on public.courses(department_id);
create function public.dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.user_role; stats jsonb; upcoming jsonb; activity jsonb;
begin
  if not public.ready_user() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select role into r from public.profiles where id=auth.uid();
  if r='admin' then
    stats:=jsonb_build_object(
      'students',(select count(*) from public.profiles where role='student'),
      'teachers',(select count(*) from public.profiles where role='teacher'),
      'courses',(select count(*) from public.courses),
      'enrollments',(select count(*) from public.enrollments));
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into activity from
      (select id,action,entity,at from public.audit_log order by at desc,id desc limit 8) x;
  elsif r='teacher' then
    stats:=jsonb_build_object(
      'courses',(select count(*) from public.courses c where public.teaches(c.id)),
      'students',(select count(distinct e.student_id) from public.enrollments e where public.teaches(e.course_id)),
      'assignments',(select count(*) from public.assignments a where public.teaches(a.course_id)),
      'pendingGrading',(select count(*) from public.submissions s join public.assignments a on a.id=s.assignment_id where public.teaches(a.course_id) and s.marks_obtained is null));
  else
    stats:=jsonb_build_object(
      'courses',(select count(*) from public.courses c where public.is_enrolled(c.id)),
      'submissions',(select count(*) from public.submissions s join public.assignments a on a.id=s.assignment_id where s.student_id=auth.uid() and public.is_enrolled(a.course_id)),
      'quizzesCompleted',(select count(*) from public.quiz_attempts t join public.quizzes q on q.id=t.quiz_id where t.student_id=auth.uid() and t.submitted_at is not null and public.is_enrolled(q.course_id)),
      'marks',public.marks_summary(null));
  end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into upcoming from (
    select a.id,a.course_id,a.title,a.due_at,c.code as course_code from public.assignments a join public.courses c on c.id=a.course_id
    where a.due_at>=now() and not c.is_archived and
      ((r='teacher' and public.teaches(c.id)) or (r='student' and public.is_enrolled(c.id)) or r='admin')
    order by a.due_at,a.id limit 8
  ) x;
  return jsonb_build_object('role',r,'stats',stats,'upcoming',upcoming,'activity',coalesce(activity,'[]'::jsonb));
end $$;
revoke all on function public.dashboard_summary() from public,anon;
grant execute on function public.dashboard_summary() to authenticated;
commit;
