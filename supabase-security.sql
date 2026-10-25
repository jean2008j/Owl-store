-- OWL STORE: القسم السري + مستخدمو الإدارة
-- شغّله مرة وحدة: Supabase > SQL Editor > New query > الصق > Run  (آمن لو شغّلته أكثر من مرة)

-- 1) رمز القسم السري (الأدمن فقط يقرأ ويعدّل؛ الزبون يتحقق منه عبر الدالة تحت)
create table if not exists public.secret_section (
  id   text primary key default 'main',
  code text not null
);
alter table public.secret_section enable row level security;
drop policy if exists "secret_section admin" on public.secret_section;
create policy "secret_section admin" on public.secret_section
  for all to authenticated using (true) with check (true);
insert into public.secret_section (id, code) values ('main', '1234') on conflict (id) do nothing;

-- 2) المنتجات السرية ما تظهر للزوار أبداً (حتى من واجهة API) — الأدمن المسجّل يشوفها
drop policy if exists "products read" on public.products;
create policy "products read" on public.products
  for select using (coalesce((data->>'secret')::boolean, false) = false);
-- (سياسة "products write" الموجودة للأدمن بتبقى وبتسمح له بقراءة وتعديل كل المنتجات)

-- 3) فتح القسم السري (get_secret_products) انتقل إلى supabase-offers.sql (فيه حد محاولات ضد تخمين الرمز).
--    ما نعرّفه هون حتى لا ترجع النسخة القديمة (بدون حد) عند إعادة تشغيل هذا الملف. شغّل supabase-offers.sql بعده.

-- 4) كلمات سر مستخدمي الإدارة (لعرضها بصفحة الأمان) — مقفول بالكامل، فقط دالة admin-users تقرأه
create table if not exists public.admin_credentials (
  user_id  uuid primary key,
  password text not null
);
alter table public.admin_credentials enable row level security;
-- (بدون سياسات عن قصد: المتصفح ما بيقدر يوصل للجدول)

notify pgrst, 'reload schema';
