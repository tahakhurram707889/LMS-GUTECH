-- LOCAL DEVELOPMENT ONLY. Never run this seed against a production project.
-- Fixed IDs are test fixtures, not application credentials. All demo accounts must
-- change their password on first login. Password below is intentionally public.
begin;
do $$
declare
  u record;
  demo_password text := 'LocalDemo2027!';
begin
  for u in select * from (values
    ('10000000-0000-4000-8000-000000000001'::uuid,'Admin User','admin@demo.gutech.test','admin',null::text),
    ('10000000-0000-4000-8000-000000000002'::uuid,'Amina Rahman','amina@demo.gutech.test','teacher',null::text),
    ('10000000-0000-4000-8000-000000000003'::uuid,'Samir Khan','samir@demo.gutech.test','teacher',null::text),
    ('10000000-0000-4000-8000-000000000004'::uuid,'Noor Ahmed','noor@demo.gutech.test','student','ST001'),
    ('10000000-0000-4000-8000-000000000005'::uuid,'Sara Ali','sara@demo.gutech.test','student','ST002'),
    ('10000000-0000-4000-8000-000000000006'::uuid,'Omar Khan','omar@demo.gutech.test','student','ST003'),
    ('10000000-0000-4000-8000-000000000007'::uuid,'Hana Mir','hana@demo.gutech.test','student','ST004'),
    ('10000000-0000-4000-8000-000000000008'::uuid,'Zain Shah','zain@demo.gutech.test','student','ST005')
  ) as users(id,full_name,email,role,roll_no)
  loop
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',u.id,'authenticated','authenticated',u.email,
      extensions.crypt(demo_password,extensions.gen_salt('bf')),now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name',u.full_name),now(),now(),'','','','')
    on conflict (id) do nothing;
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values(u.id,u.id,u.id::text,jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),
      'email',now(),now(),now()) on conflict (provider_id,provider) do nothing;
    insert into public.profiles(id,username,full_name,email,role,roll_no)
    values (u.id,split_part(u.email,'@',1),u.full_name,u.email,u.role::public.user_role,u.roll_no)
    on conflict (id) do nothing;
  end loop;
end $$;
insert into public.courses(id,code,title,description) values
 ('20000000-0000-4000-8000-000000000001','CS101','Foundations of Computing','Algorithms, programming, and computational thinking.'),
 ('20000000-0000-4000-8000-000000000002','UX110','Human-Centered Design','Research, interaction design, and accessible experiences.'),
 ('20000000-0000-4000-8000-000000000003','MA230','Applied Linear Algebra','Matrices, vector spaces, and practical applications.')
on conflict (id) do nothing;
insert into public.course_teachers(course_id,teacher_id) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002')
on conflict do nothing;
insert into public.enrollments(course_id,student_id) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000007'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000008')
on conflict do nothing;
insert into public.assignments(id,course_id,created_by,title,instructions,max_marks,due_at) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002','Algorithm analysis','Explain the complexity of linear and binary search.',20,now()+interval '7 days')
on conflict (id) do nothing;
insert into public.submissions(assignment_id,student_id,text_answer,marks_obtained,graded_by,graded_at) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004',
  'Linear search O(n); binary search O(log n).',16,'10000000-0000-4000-8000-000000000002',now())
on conflict (assignment_id,student_id) do nothing;
insert into public.quizzes(id,course_id,created_by,title,time_limit_minutes,opens_at,closes_at,is_published) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002','Complexity check',10,now()-interval '1 day',now()+interval '7 days',true)
on conflict (id) do nothing;
insert into public.quiz_questions(id,quiz_id,position,type,prompt,options,marks) values
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',0,
  'mcq_single','What is binary search complexity?',
  '[{"id":"a","text":"O(n)"},{"id":"b","text":"O(log n)"}]',5)
on conflict (id) do nothing;
insert into public.quiz_answers(question_id,correct_option_ids) values
 ('50000000-0000-4000-8000-000000000001',array['b']) on conflict do nothing;
insert into public.quiz_attempts(quiz_id,student_id,started_at,submitted_at,answers,score) values
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004',
  now()-interval '5 minutes',now(),'{"50000000-0000-4000-8000-000000000001":["b"]}',5)
on conflict (quiz_id,student_id) do nothing;
insert into public.announcements(id,author_id,title,body,is_pinned) values
 ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 'Welcome to your learning workspace','Your courses, resources, and community in one place.',true)
on conflict (id) do nothing;
insert into public.chat_messages(id,course_id,sender_id,body) values
 ('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002','Welcome to CS101. Please keep our classroom discussion constructive.')
on conflict (id) do nothing;
insert into public.complaints(id,raised_by,category,subject,description) values
 ('80000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005',
  'technical','Classroom projector','The projector in room 204 needs maintenance.')
on conflict (id) do nothing;
commit;
