begin;
create extension if not exists pgcrypto with schema extensions;
create type public.user_role as enum ('admin', 'teacher', 'student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null unique,
  role public.user_role not null,
  roll_no text unique,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role = 'student' or roll_no is null)
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.course_teachers (
  course_id uuid references public.courses(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, teacher_id)
);
create table public.enrollments (
  course_id uuid references public.courses(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (course_id, student_id)
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index enrollments_student_idx on public.enrollments(student_id);
create index course_teachers_teacher_idx on public.course_teachers(teacher_id);
create index profiles_role_idx on public.profiles(role, is_active);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger courses_updated before update on public.courses
for each row execute function public.touch_updated_at();

-- Fixed search paths, no caller-supplied user IDs; avoids recursive profile RLS.
create function public.active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin');
$$;
create function public.is_enrolled(course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.active_user() and exists(
    select 1 from public.enrollments e join public.courses c on c.id = e.course_id
    join public.profiles p on p.id = e.student_id
    where e.student_id = auth.uid() and e.course_id = $1
      and p.role = 'student' and not c.is_archived);
$$;
create function public.teaches(course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.active_user() and exists(
    select 1 from public.course_teachers t join public.courses c on c.id = t.course_id
    join public.profiles p on p.id = t.teacher_id
    where t.teacher_id = auth.uid() and t.course_id = $1
      and p.role = 'teacher' and not c.is_archived);
$$;
create function public.can_read_course(course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.teaches($1) or public.is_enrolled($1);
$$;
create function public.can_manage_course(course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.teaches($1);
$$;

-- Integrity checks also protect privileged API membership changes.
create function public.check_membership_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'course_teachers' then
    if not exists(select 1 from public.profiles where id = new.teacher_id and role = 'teacher' and is_active) then
      raise exception 'An active teacher is required' using errcode = '23514';
    end if;
  else
    if not exists(select 1 from public.profiles where id = new.student_id and role = 'student' and is_active) then
      raise exception 'An active student is required' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger validate_teacher before insert or update on public.course_teachers
for each row execute function public.check_membership_role();
create trigger validate_student before insert or update on public.enrollments
for each row execute function public.check_membership_role();
commit;
