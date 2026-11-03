begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(23);

-- The seed intentionally forces password changes. These tests exercise data
-- isolation after that independent account gate has been satisfied.
update public.profiles set must_change_password=false;
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,now(),now() from public.profiles on conflict(id) do nothing;

select is((select count(*)::int from public.profiles),8,'seed has eight profiles');
select is((select count(*)::int from public.courses),3,'seed has three courses');
select is((select count(*)::int from pg_tables where schemaname='public' and not rowsecurity),0,
 'every public table has RLS');
select is((select count(*)::int from storage.buckets where id in
 ('resources','submissions','complaint-attachments') and not public),3,'buckets are private');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","session_id":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.courses),2,'student sees two enrolled courses');
select is((select count(*)::int from public.quiz_answers),0,'student cannot read answer key');
select is((select count(*)::int from public.profiles),1,'student cannot read peer profiles');
select is((select count(*)::int from public.complaints),0,'student cannot read another complaint');
select is((select count(*)::int from public.v_student_marks),2,'student sees own marks');
select is((select sum(obtained)/sum(max)*100 from public.v_student_marks),84::numeric,'seeded percentage is 84');
select throws_ok($$update public.profiles set role='admin' where id=auth.uid()$$,
 '42501',null,'student cannot promote self');
select throws_ok($$update public.submissions set marks_obtained=20$$,
 '42501',null,'student cannot change marks');
select is((select count(*)::int from public.audit_log),0,'student cannot read audit log');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006","session_id":"10000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select is((select count(*)::int from public.submissions),0,'unrelated student cannot read submissions');
select is((select count(*)::int from public.v_student_marks),0,'unrelated student cannot read marks');
select is((select count(*)::int from public.chat_messages),0,'nonmember cannot read classroom chat');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from public.quiz_answers),0,'unrelated teacher cannot read answer key');
select is((select count(*)::int from public.submissions),0,'unrelated teacher cannot read submissions');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.quiz_answers),1,'assigned teacher can read key');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::int from public.courses),3,'admin sees all courses');
select is((select count(*)::int from public.complaints),1,'admin sees complaints');

reset role;
update public.profiles set is_active=false where id='10000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","session_id":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::int from public.courses),0,'inactive user loses course access with old JWT');
select is((select count(*)::int from public.v_student_marks),0,'inactive user loses marks access');
select * from finish();
rollback;
