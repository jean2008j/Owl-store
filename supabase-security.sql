-- OWL STORE: مستخدمو الإدارة
-- شغّله مرة وحدة: Supabase > SQL Editor > New query > الصق > Run  (آمن لو شغّلته أكثر من مرة)

-- 1) القسم السري القديم انحذف: نحذف جدوله ودالة فتحه، ونرجّع قراءة المنتجات للجميع
drop function if exists public.get_secret_products(text);
drop table if exists public.secret_section;
delete from public.products where coalesce((data->>'secret')::boolean, false) = true;
drop policy if exists "products read" on public.products;
create policy "products read" on public.products for select using (true);
-- (سياسة "products write" الموجودة للأدمن بتبقى كما هي)

-- 2) كلمة سر المتجر للزبائن: supabase-store-gate.sql (شغّله بعد supabase-offers.sql)

-- 3) كلمات سر مستخدمي الإدارة (لعرضها بصفحة الأمان) — مقفول بالكامل، فقط دالة admin-users تقرأه
create table if not exists public.admin_credentials (
  user_id  uuid primary key,
  password text not null
);
alter table public.admin_credentials enable row level security;
-- (بدون سياسات عن قصد: المتصفح ما بيقدر يوصل للجدول)

notify pgrst, 'reload schema';
