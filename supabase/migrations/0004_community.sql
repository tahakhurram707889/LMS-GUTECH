begin;
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.announcement_reads (
  user_id uuid references public.profiles(id) on delete cascade,
  announcement_id uuid references public.announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create type public.complaint_status as enum ('open','in_review','resolved','rejected');
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references public.profiles(id),
  course_id uuid references public.courses(id),
  category text not null check (category in ('academic','technical','facility','conduct','other')),
  subject text not null,
  description text not null,
  attachment_path text,
  status public.complaint_status not null default 'open',
  admin_response text,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('resolved','rejected') or
    (nullif(trim(admin_response),'') is not null and resolved_by is not null))
);
create index announcements_course_date_idx on public.announcements(course_id, created_at desc);
create index announcements_pinned_idx on public.announcements(is_pinned desc, created_at desc);
create index chat_messages_course_date_idx on public.chat_messages(course_id, created_at desc, id);
create index complaints_status_date_idx on public.complaints(status, created_at desc);
create index complaints_owner_date_idx on public.complaints(raised_by, created_at desc);
create trigger announcements_updated before update on public.announcements
for each row execute function public.touch_updated_at();
create trigger chat_messages_updated before update on public.chat_messages
for each row execute function public.touch_updated_at();
create trigger complaints_updated before update on public.complaints
for each row execute function public.touch_updated_at();
commit;
