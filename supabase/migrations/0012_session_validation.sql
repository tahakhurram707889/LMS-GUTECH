begin;
-- Access JWTs can outlive logout. The API verifies their session still exists so
-- global logout / password reset also revoke API access before JWT expiry.
create function public.session_is_valid() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.sessions s
    where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
    and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function public.session_is_valid() from public,anon;
grant execute on function public.session_is_valid() to authenticated;
-- The same revocation check also protects direct PostgREST/Storage/Realtime
-- access, not only the Express API.
create or replace function public.active_user() returns boolean
language sql stable security definer set search_path='' as $$
  select public.session_is_valid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active);
$$;
create or replace function public.ready_user() returns boolean
language sql stable security definer set search_path='' as $$
  select public.session_is_valid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and not p.must_change_password);
$$;
commit;
