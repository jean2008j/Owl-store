-- J-STORE: admin dashboard login
-- Run ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
-- BEFORE running: replace CHANGE-THIS-ADMIN-PASSWORD below with the password you want.
-- (You can change it later from the admin page, "Private & Security" tab.)
-- Run this BEFORE you deploy the new admin page, otherwise you will be locked out.

create table if not exists public.store_settings (
  key text primary key,
  value text not null
);
alter table public.store_settings enable row level security;
-- (no policies on purpose: the browser cannot read this table directly)

insert into public.store_settings (key, value)
values ('admin_password', '12345')
on conflict (key) do nothing;

create or replace function public.verify_admin_password(p text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  select exists (
    select 1 from public.store_settings
    where key = 'admin_password' and value = p
  ) into ok;

  if not ok then
    perform pg_sleep(1);  -- slows down password guessing
  end if;

  return ok;
end;
$$;

create or replace function public.change_admin_password(old_pw text, new_pw text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_pw is null or length(new_pw) < 4 then
    return false;
  end if;

  update public.store_settings
     set value = new_pw
   where key = 'admin_password' and value = old_pw;

  return found;
end;
$$;

grant execute on function public.verify_admin_password(text) to anon, authenticated;
grant execute on function public.change_admin_password(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
