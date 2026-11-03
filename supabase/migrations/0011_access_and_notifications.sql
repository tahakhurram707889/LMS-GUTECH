begin;
create function public.unread_counts() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.ready_user() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('announcements',(select count(*) from public.announcements a
    where (a.course_id is null or public.can_read_course(a.course_id))
    and not exists(select 1 from public.announcement_reads r where r.user_id=auth.uid() and r.announcement_id=a.id)),
    'notifications',(select count(*) from public.notifications where user_id=auth.uid() and read_at is null));
end $$;
create function public.course_member_count(p_course uuid) returns bigint language plpgsql stable security definer set search_path='' as $$
begin
  if not public.ready_user() or not public.can_read_course(p_course) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return (select count(*) from public.profiles p where p.is_active and (
    exists(select 1 from public.enrollments e where e.student_id=p.id and e.course_id=p_course)
    or exists(select 1 from public.course_teachers t where t.teacher_id=p.id and t.course_id=p_course)));
end $$;
create function public.protect_last_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.role='admin' and old.is_active and (new.role<>'admin' or not new.is_active) then
    perform pg_advisory_xact_lock(946381);
    if not exists(select 1 from public.profiles where role='admin' and is_active and id<>old.id) then
      raise exception 'Keep at least one active administrator' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger last_admin before update on public.profiles for each row execute function public.protect_last_admin();
create function public.audit_membership_changes() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then
    insert into public.audit_log(actor_id,action,entity,entity_id)
    values(auth.uid(),lower(tg_op),tg_table_name,case when tg_op='DELETE' then old.course_id else new.course_id end);
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger audit_enrollments after insert or delete on public.enrollments for each row execute function public.audit_membership_changes();
create trigger audit_teachers after insert or delete on public.course_teachers for each row execute function public.audit_membership_changes();
revoke all on function public.unread_counts(),public.course_member_count(uuid),public.protect_last_admin(),public.audit_membership_changes() from public,anon,authenticated;
grant execute on function public.unread_counts(),public.course_member_count(uuid) to authenticated;
commit;
