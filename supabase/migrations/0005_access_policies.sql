begin;
-- Explicit grants: workflow writes remain denied until their transactional API/RPC
-- implementation lands in its feature phase. RLS alone cannot protect grade columns.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles, public.courses, public.course_teachers,
  public.enrollments, public.resources, public.assignments, public.submissions,
  public.quizzes, public.quiz_questions, public.quiz_answers, public.quiz_attempts,
  public.announcements, public.announcement_reads, public.audit_log,
  public.chat_messages, public.complaints, public.v_student_marks to authenticated;
grant update(full_name) on public.profiles to authenticated;
grant insert, update on public.courses to authenticated;
grant insert, update, delete on public.course_teachers, public.enrollments to authenticated;
-- Make backend service privileges explicit (this role is never sent to a browser).
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_teachers enable row level security;
alter table public.enrollments enable row level security;
alter table public.resources enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.audit_log enable row level security;
alter table public.chat_messages enable row level security;
alter table public.complaints enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (public.active_user() and (id = auth.uid() or public.is_admin()));
create policy profiles_name_update on public.profiles for update to authenticated
using (public.active_user() and id = auth.uid())
with check (public.active_user() and id = auth.uid());
create policy courses_read on public.courses for select to authenticated
using (public.can_read_course(id));
create policy courses_admin on public.courses for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy teachers_read on public.course_teachers for select to authenticated
using (public.can_read_course(course_id));
create policy teachers_admin on public.course_teachers for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy enrollments_read on public.enrollments for select to authenticated
using (public.is_admin() or public.teaches(course_id)
  or (public.is_enrolled(course_id) and student_id = auth.uid()));
create policy enrollments_admin on public.enrollments for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy resources_read on public.resources for select to authenticated
using (public.can_read_course(course_id));
create policy assignments_read on public.assignments for select to authenticated
using (public.can_read_course(course_id));
create policy submissions_read on public.submissions for select to authenticated
using (public.active_user() and exists(select 1 from public.assignments a
  where a.id = assignment_id and (public.can_manage_course(a.course_id)
    or (student_id = auth.uid() and public.is_enrolled(a.course_id)))));
create policy quizzes_read on public.quizzes for select to authenticated
using (public.can_manage_course(course_id) or (is_published and public.is_enrolled(course_id)));
create policy questions_read on public.quiz_questions for select to authenticated
using (exists(select 1 from public.quizzes q where q.id = quiz_id
  and (public.can_manage_course(q.course_id)
    or (public.is_enrolled(q.course_id) and q.is_published and now() >= q.opens_at))));
create policy answers_staff_only on public.quiz_answers for select to authenticated
using (exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
  where qq.id = question_id and public.can_manage_course(q.course_id)));
create policy attempts_read on public.quiz_attempts for select to authenticated
using (public.active_user() and exists(select 1 from public.quizzes q
  where q.id = quiz_id and (public.can_manage_course(q.course_id)
    or (student_id = auth.uid() and public.is_enrolled(q.course_id)))));
create policy announcements_read on public.announcements for select to authenticated
using (public.active_user() and (course_id is null or public.can_read_course(course_id)));
create policy reads_own on public.announcement_reads for select to authenticated
using (public.active_user() and user_id = auth.uid());
create policy audit_admin on public.audit_log for select to authenticated
using (public.is_admin());
create policy messages_read on public.chat_messages for select to authenticated
using (public.can_read_course(course_id));
create policy complaints_read on public.complaints for select to authenticated
using (public.active_user() and (raised_by = auth.uid() or public.is_admin()));

-- Functions default to PUBLIC execute in Postgres; revoke before selective grants.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.active_user(), public.is_admin(),
  public.is_enrolled(uuid), public.teaches(uuid), public.can_read_course(uuid),
  public.can_manage_course(uuid) to authenticated, service_role;

-- Future objects must not silently inherit broad Supabase browser grants.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public;
commit;
