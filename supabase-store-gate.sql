-- OWL STORE: كلمة سر المتجر للزبائن (بوابة تظهر أول ما يفتح الزبون الموقع)
-- شغّله مرة وحدة: Supabase > SQL Editor > New query > الصق > Run  (آمن لو شغّلته أكثر من مرة)
-- الترتيب: supabase-setup.sql ← supabase-fix.sql ← supabase-security.sql ← supabase-offers.sql ← هذا الملف.
-- (يعتمد على دالتي rate_limited و rate_hit الموجودتين بـ supabase-offers.sql)
-- الأدمن بيفعّل/بيوقف/بيغيّر الكلمة من لوحة التحكم > الأمان > كلمة سر المتجر.

-- 1) الإعداد (الأدمن المسجّل فقط يقرأ ويعدّل؛ الزبون ما بيوصل للجدول أبداً)
create table if not exists public.store_gate (
  id         text primary key default 'main',
  enabled    boolean     not null default false,
  password   text        not null default '',
  updated_at timestamptz not null default now()
);
alter table public.store_gate enable row level security;
revoke all on public.store_gate from anon;
drop policy if exists "store_gate admin" on public.store_gate;
create policy "store_gate admin" on public.store_gate
  for all to authenticated using (true) with check (true);
insert into public.store_gate (id, enabled, password) values ('main', false, '') on conflict (id) do nothing;

-- 2) الزبون بيعرف فقط هل البوابة مفعّلة (بدون ما يشوف الكلمة)
create or replace function public.get_store_gate()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enabled', coalesce((select enabled and password <> '' from public.store_gate where id = 'main'), false)
  );
$$;
revoke all on function public.get_store_gate() from public;
grant execute on function public.get_store_gate() to anon, authenticated;

-- 3) التحقق من الكلمة (10 محاولات خاطئة كل 10 دقائق لكل عميل، ضد التخمين)
create or replace function public.check_store_gate(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare ok boolean;
begin
  if public.rate_limited('store_gate', 10, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  end if;
  select exists (
    select 1 from public.store_gate
     where id = 'main' and enabled and password <> '' and password = btrim(coalesce(p_code, ''))
  ) into ok;
  if not ok then
    -- إذا البوابة موقوفة فالدخول مسموح أصلاً، ما بنحسب محاولة
    if coalesce((select enabled from public.store_gate where id = 'main'), false) then
      perform public.rate_hit('store_gate');
    else
      return jsonb_build_object('ok', true);
    end if;
  end if;
  return jsonb_build_object('ok', ok);
end $$;
revoke all on function public.check_store_gate(text) from public;
grant execute on function public.check_store_gate(text) to anon, authenticated;
