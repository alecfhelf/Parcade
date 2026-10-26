-- Free access switch + admin-granted (comped) Club memberships.
-- app_flags.club_open = true treats every signed-in account as a Club Member (pre-launch feedback).
-- Turn it off with: update public.app_flags set enabled = false where key = 'club_open';
-- club_comps holds free memberships toggled on from the admin page (admin_set_comp).

create table if not exists public.app_flags (key text primary key, enabled boolean not null default false);
alter table public.app_flags enable row level security;
insert into public.app_flags (key, enabled) values ('club_open', true)
on conflict (key) do nothing;

create table if not exists public.club_comps (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid,
  created_at timestamptz not null default now()
);
alter table public.club_comps enable row level security;

create or replace function public.is_club_member(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from club_subscriptions
      where user_id = p_user and status in ('active', 'trialing') and current_period_end > now()
    )
    or exists (select 1 from club_comps where user_id = p_user)
    or (
      coalesce((select enabled from app_flags where key = 'club_open'), false)
      and exists (select 1 from auth.users u where u.id = p_user and u.email is not null and not coalesce(u.is_anonymous, false))
    );
$$;

create or replace function public.club_members(p_users uuid[]) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct id), '{}') from (
    select user_id as id from club_subscriptions
    where user_id = any(p_users[1:100]) and status in ('active', 'trialing') and current_period_end > now()
    union
    select user_id from club_comps where user_id = any(p_users[1:100])
  ) m;
$$;

create or replace function public.admin_set_comp(p_email text, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if not public.is_coin_admin() then raise exception 'not authorized'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'No account with that email'; end if;
  if p_on then
    insert into club_comps (user_id, granted_by) values (v_uid, auth.uid()) on conflict (user_id) do nothing;
  else
    delete from club_comps where user_id = v_uid;
  end if;
  return p_on;
end $$;
revoke all on function public.admin_set_comp(text, boolean) from public, anon;
grant execute on function public.admin_set_comp(text, boolean) to authenticated;

create or replace function public.admin_comp_emails() returns setof text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_coin_admin() then raise exception 'not authorized'; end if;
  return query select lower(u.email)::text from club_comps c join auth.users u on u.id = c.user_id;
end $$;
revoke all on function public.admin_comp_emails() from public, anon;
grant execute on function public.admin_comp_emails() to authenticated;
