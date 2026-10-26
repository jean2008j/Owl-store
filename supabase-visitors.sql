-- ============================================================
-- عدّاد زوار الموقع (للوحة التحكم > الإحصائيات)
-- شغّل هذا الملف مرة وحدة في Supabase > SQL Editor
-- (بعد supabase-offers.sql، لأنه بيستخدم دوال الحماية من الإغراق الموجودة فيه).
--
-- كيف بيشتغل؟
--  • كل متصفح بياخد رقم عشوائي (UUID) بيتخزّن عنده، وبيتسجّل مرة وحدة باليوم بس.
--  • ما منخزّن IP ولا أي معلومة شخصية، فقط (اليوم + الرقم العشوائي).
--  • الزائر ما بيقدر يقرأ الجدول؛ بس يقدر يسجّل زيارة عبر الدالة track_visit.
--  • الأدمن (المسجّل دخول) بس بيقدر يقرأ الأرقام عبر الدالة visitor_stats.
--  • "اليوم" محسوب بتوقيت دمشق.
-- ============================================================

create table if not exists public.site_visits (
  day        date        not null,
  visitor_id uuid        not null,
  created_at timestamptz not null default now(),
  primary key (day, visitor_id)
);

alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
-- (بدون سياسات عن قصد: ما أحد من المتصفح بيوصل للجدول مباشرة)

-- تسجيل زيارة (بيناديها كل زائر، بدون تسجيل دخول)
create or replace function public.track_visit(p_visitor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Damascus')::date;
begin
  if p_visitor is null then return; end if;
  -- حماية من الإغراق: حد واسع لأن كثير ناس ممكن يشاركوا نفس الـ IP (شبكات الموبايل)
  if public.rate_limited('visit', 300, interval '1 hour') then return; end if;
  perform public.rate_hit('visit');
  insert into public.site_visits (day, visitor_id) values (d, p_visitor)
  on conflict do nothing;
end $$;

-- أرقام الزوار للأدمن فقط
create or replace function public.visitor_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Asia/Damascus')::date;
  res jsonb;
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception 'not authorized';
  end if;
  select jsonb_build_object(
    'today',     count(*) filter (where day = d),
    'yesterday', count(*) filter (where day = d - 1),
    'month',     count(*) filter (where day >= date_trunc('month', d)::date),
    'since',     min(day)
  ) into res
  from public.site_visits;
  return res;
end $$;

revoke all on function public.track_visit(uuid) from public;
revoke all on function public.visitor_stats() from public;
grant execute on function public.track_visit(uuid) to anon, authenticated;
grant execute on function public.visitor_stats() to authenticated;
