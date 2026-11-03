begin;
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  instructions text not null,
  max_marks numeric(6,2) not null check (max_marks > 0),
  due_at timestamptz not null,
  allow_late boolean not null default false,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  text_answer text,
  file_path text,
  submitted_at timestamptz not null default now(),
  is_late boolean not null default false,
  marks_obtained numeric(6,2) check (marks_obtained >= 0),
  feedback text,
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id),
  check (nullif(trim(text_answer), '') is not null or file_path is not null),
  check ((marks_obtained is null and graded_at is null and graded_by is null)
    or (marks_obtained is not null and graded_at is not null and graded_by is not null))
);
create index resources_course_date_idx on public.resources(course_id, created_at desc);
create index assignments_course_due_idx on public.assignments(course_id, due_at);
create index submissions_assignment_idx on public.submissions(assignment_id);
create index submissions_student_idx on public.submissions(student_id);
create trigger resources_updated before update on public.resources
for each row execute function public.touch_updated_at();
create trigger assignments_updated before update on public.assignments
for each row execute function public.touch_updated_at();
create trigger submissions_updated before update on public.submissions
for each row execute function public.touch_updated_at();

-- No submission writes are granted to browser roles. Phase 3 must add narrowly
-- scoped transactional RPCs for submit/grade, enforcing deadlines and audit records.
create function public.check_submission_marks() returns trigger
language plpgsql set search_path = '' as $$
declare maximum numeric;
begin
  select max_marks into maximum from public.assignments where id = new.assignment_id;
  if new.marks_obtained > maximum then
    raise exception 'Marks exceed assignment maximum' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger submission_marks before insert or update on public.submissions
for each row execute function public.check_submission_marks();
commit;
