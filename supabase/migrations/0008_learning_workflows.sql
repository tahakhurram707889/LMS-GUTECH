begin;
create function public.learning_write(p_action text,p_id uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c uuid; a public.assignments; s public.submissions; q public.quizzes; t public.quiz_attempts;
  item jsonb; opt jsonb; question_id uuid; result_id uuid; expires timestamptz; score_total numeric:=0;
  key_ids text[]; selected_ids text[]; learner boolean; question public.quiz_questions;
begin
  if not public.ready_user() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select role='student' into learner from public.profiles where id=auth.uid();

  if p_action='teachers.replace' then
    if not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    perform 1 from public.courses where id=p_id for update;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    delete from public.course_teachers where course_id=p_id;
    insert into public.course_teachers(course_id,teacher_id) select p_id,value::uuid from jsonb_array_elements_text(p_data->'teacherIds');
    perform public.record_audit('replace','course_teachers',p_id); return '{}'::jsonb;
  end if;

  if p_action='assignment.create' then
    c:=(p_data->>'courseId')::uuid;
    if not public.can_manage_course(c) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if p_data->>'attachmentPath' is not null and p_data->>'attachmentPath' not like c::text||'/'||auth.uid()::text||'/%' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    insert into public.assignments(course_id,created_by,title,instructions,max_marks,due_at,allow_late,attachment_path)
    values(c,auth.uid(),p_data->>'title',p_data->>'instructions',(p_data->>'maxMarks')::numeric,
      (p_data->>'dueAt')::timestamptz,coalesce((p_data->>'allowLate')::boolean,false),p_data->>'attachmentPath') returning id into result_id;
  elsif p_action in ('assignment.update','assignment.delete','submission.put') then
    select * into a from public.assignments where id=p_id for update;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    c:=a.course_id;
    if p_action='submission.put' then
      if not learner or not public.is_enrolled(c) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
      if now()>a.due_at and not a.allow_late then raise exception 'Deadline has passed' using errcode='P0001'; end if;
      if p_data->>'filePath' is not null and p_data->>'filePath' not like c::text||'/'||auth.uid()::text||'/%' then
        raise exception 'FORBIDDEN' using errcode='42501'; end if;
      insert into public.submissions(assignment_id,student_id,text_answer,file_path,is_late)
      values(p_id,auth.uid(),p_data->>'textAnswer',p_data->>'filePath',now()>a.due_at)
      on conflict(assignment_id,student_id) do update set text_answer=excluded.text_answer,file_path=excluded.file_path,
        submitted_at=now(),is_late=excluded.is_late,marks_obtained=null,feedback=null,graded_by=null,graded_at=null returning id into result_id;
    else
      if not public.can_manage_course(c) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
      if p_data->>'attachmentPath' is not null and p_data->>'attachmentPath' is distinct from a.attachment_path
        and p_data->>'attachmentPath' not like c::text||'/'||auth.uid()::text||'/%' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
      if p_action='assignment.delete' then delete from public.assignments where id=p_id; result_id:=p_id;
      else
        if exists(select 1 from public.submissions where assignment_id=p_id and marks_obtained>(p_data->>'maxMarks')::numeric) then
          raise exception 'Maximum is below an existing grade' using errcode='23514'; end if;
        update public.assignments set title=p_data->>'title',instructions=p_data->>'instructions',
          max_marks=(p_data->>'maxMarks')::numeric,due_at=(p_data->>'dueAt')::timestamptz,
          allow_late=coalesce((p_data->>'allowLate')::boolean,false),attachment_path=coalesce(p_data->>'attachmentPath',attachment_path) where id=p_id returning id into result_id;
      end if;
    end if;
  elsif p_action='submission.grade' then
    select * into s from public.submissions where id=p_id;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    select * into a from public.assignments where id=s.assignment_id for update;
    -- Match the submission path's assignment -> submission lock order.
    select * into s from public.submissions where id=p_id for update;
    if not public.can_manage_course(a.course_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if (p_data->>'marks')::numeric not between 0 and a.max_marks then raise exception 'Marks outside allowed range' using errcode='23514'; end if;
    update public.submissions set marks_obtained=(p_data->>'marks')::numeric,feedback=p_data->>'feedback',
      graded_by=auth.uid(),graded_at=now() where id=p_id returning id into result_id;
  elsif p_action in ('quiz.create','quiz.update') then
    if p_action='quiz.update' then
      select * into q from public.quizzes where id=p_id for update;
      if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
      c:=q.course_id;
    else c:=(p_data->>'courseId')::uuid; end if;
    if not public.can_manage_course(c) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if p_action='quiz.update' and exists(select 1 from public.quiz_attempts where quiz_id=p_id) then raise exception 'Quiz has attempts and cannot be edited' using errcode='P0001'; end if;
    if jsonb_array_length(p_data->'questions') not between 1 and 100 then raise exception 'One to 100 questions required' using errcode='23514'; end if;
    if p_action='quiz.create' then
      insert into public.quizzes(course_id,created_by,title,description,time_limit_minutes,opens_at,closes_at,is_published)
      values(c,auth.uid(),p_data->>'title',p_data->>'description',(p_data->>'timeLimitMinutes')::int,
        (p_data->>'opensAt')::timestamptz,(p_data->>'closesAt')::timestamptz,coalesce((p_data->>'isPublished')::boolean,false)) returning id into result_id;
    else
      update public.quizzes set title=p_data->>'title',description=p_data->>'description',time_limit_minutes=(p_data->>'timeLimitMinutes')::int,
        opens_at=(p_data->>'opensAt')::timestamptz,closes_at=(p_data->>'closesAt')::timestamptz,is_published=(p_data->>'isPublished')::boolean
        where id=p_id returning id into result_id;
      delete from public.quiz_questions where quiz_id=p_id;
    end if;
    for item in select value from jsonb_array_elements(p_data->'questions') loop
      select array_agg(value) into key_ids from jsonb_array_elements_text(item->'correctOptionIds');
      if cardinality(key_ids)<1 or (item->>'type'<>'mcq_multi' and cardinality(key_ids)<>1)
        or exists(select 1 from unnest(key_ids) k where not exists(select 1 from jsonb_array_elements(item->'options') o where o->>'id'=k))
        or (select count(*) from jsonb_array_elements(item->'options'))<>(select count(distinct o->>'id') from jsonb_array_elements(item->'options') o)
      then raise exception 'Invalid answer key' using errcode='23514'; end if;
      insert into public.quiz_questions(quiz_id,position,type,prompt,options,marks)
      values(result_id,(item->>'position')::int,(item->>'type')::public.question_type,item->>'prompt',item->'options',(item->>'marks')::numeric) returning id into question_id;
      insert into public.quiz_answers(question_id,correct_option_ids) values(question_id,key_ids);
    end loop;
  elsif p_action='attempt.start' then
    select * into q from public.quizzes where id=p_id for update;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    if not learner or not public.is_enrolled(q.course_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if not q.is_published or now()<q.opens_at or now()>=q.closes_at then raise exception 'Quiz is not open' using errcode='P0001'; end if;
    if exists(select 1 from public.quiz_attempts where quiz_id=p_id and student_id=auth.uid()) then raise exception 'Only one attempt is allowed' using errcode='P0001'; end if;
    insert into public.quiz_attempts(quiz_id,student_id) values(p_id,auth.uid()) returning * into t;
    return jsonb_build_object('id',t.id,'started_at',t.started_at,'expires_at',least(q.closes_at,t.started_at+make_interval(mins=>q.time_limit_minutes)),
      'questions',(select jsonb_agg(to_jsonb(qq) order by qq.position) from public.quiz_questions qq where qq.quiz_id=p_id));
  elsif p_action='attempt.submit' then
    select * into t from public.quiz_attempts where quiz_id=p_id and student_id=auth.uid() for update;
    if not found then raise exception 'Start the quiz first' using errcode='P0002'; end if;
    select * into q from public.quizzes where id=p_id;
    if not learner or not public.is_enrolled(q.course_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if t.submitted_at is not null then raise exception 'Attempt already submitted' using errcode='P0001'; end if;
    expires:=least(q.closes_at,t.started_at+make_interval(mins=>q.time_limit_minutes));
    if now()>expires+interval '10 seconds' then raise exception 'Attempt has expired' using errcode='P0001'; end if;
    if jsonb_typeof(p_data->'answers')<>'object' then raise exception 'Invalid answers' using errcode='23514'; end if;
    for question in select * from public.quiz_questions where quiz_id=p_id loop
      select array_agg(distinct value order by value) into selected_ids from jsonb_array_elements_text(coalesce(p_data->'answers'->question.id::text,'[]'));
      select array_agg(distinct k order by k) into key_ids from public.quiz_answers qa,unnest(qa.correct_option_ids) k where qa.question_id=question.id;
      if selected_ids=key_ids then score_total:=score_total+question.marks; end if;
    end loop;
    update public.quiz_attempts set answers=p_data->'answers',score=score_total,submitted_at=now() where id=t.id;
    perform public.record_audit('quiz.auto_grade','quiz_attempts',t.id);
    return jsonb_build_object('id',t.id,'score',score_total,'submitted_at',now());
  else raise exception 'Unknown learning operation' using errcode='23514';
  end if;
  perform public.record_audit(p_action,'learning',result_id);
  return jsonb_build_object('id',result_id);
end $$;
revoke all on function public.learning_write(text,uuid,jsonb) from public,anon;
grant execute on function public.learning_write(text,uuid,jsonb) to authenticated;
commit;
