begin;
create type public.question_type as enum ('mcq_single','mcq_multi','true_false');
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  time_limit_minutes int not null check (time_limit_minutes between 1 and 1440),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null check (position >= 0),
  type public.question_type not null,
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  marks numeric(5,2) not null default 1 check (marks > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, position) deferrable initially immediate
);
-- Deliberately separate from questions; no student SELECT policy.
create table public.quiz_answers (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_option_ids text[] not null check (cardinality(correct_option_ids) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  score numeric(6,2) check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, student_id),
  check (submitted_at is null or submitted_at >= started_at),
  check (score is null or submitted_at is not null)
);
create index quiz_attempts_quiz_idx on public.quiz_attempts(quiz_id);
create index quiz_attempts_student_idx on public.quiz_attempts(student_id);
create index quizzes_course_idx on public.quizzes(course_id, opens_at);
create trigger quizzes_updated before update on public.quizzes
for each row execute function public.touch_updated_at();
create trigger quiz_questions_updated before update on public.quiz_questions
for each row execute function public.touch_updated_at();
create trigger quiz_answers_updated before update on public.quiz_answers
for each row execute function public.touch_updated_at();
create trigger quiz_attempts_updated before update on public.quiz_attempts
for each row execute function public.touch_updated_at();

-- security_invoker is essential: a view must not bypass the base tables' RLS.
create view public.v_student_marks with (security_invoker = true) as
select s.student_id, a.course_id, 'assignment'::text as kind, a.id as item_id,
  a.title, s.marks_obtained as obtained, a.max_marks as max, s.graded_at
from public.submissions s join public.assignments a on a.id = s.assignment_id
union all
select t.student_id, q.course_id, 'quiz'::text as kind, q.id as item_id,
  q.title, t.score as obtained,
  (select coalesce(sum(marks), 0) from public.quiz_questions where quiz_id = q.id) as max,
  t.submitted_at as graded_at
from public.quiz_attempts t join public.quizzes q on q.id = t.quiz_id;
commit;
