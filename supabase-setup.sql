-- شغّله مرة وحدة: Supabase > SQL Editor > New query > الصق > Run
-- آمن لو شغّلته أكثر من مرة. الترتيب: supabase-setup.sql ← supabase-fix.sql ← supabase-offers.sql

-- 1) أعمدة إضافية
alter table public.products add column if not exists pid text unique;
alter table public.products add column if not exists data jsonb;
alter table public.orders   add column if not exists ref  text unique;
alter table public.orders   add column if not exists data jsonb;

-- 2) تفعيل RLS
alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- 3) المنتجات: الكل يقرأ، الأدمن (مسجّل دخول) فقط يكتب
drop policy if exists "products read"  on public.products;
drop policy if exists "products write" on public.products;
create policy "products read"  on public.products for select using (true);
create policy "products write" on public.products for all to authenticated using (true) with check (true);

-- 4) الطلبات: الأدمن فقط يقرأ ويعدّل (الزبون يرسل عبر الدالة تحت)
drop policy if exists "orders admin" on public.orders;
create policy "orders admin" on public.orders for all to authenticated using (true) with check (true);

-- 5) دالة حفظ الطلب (place_order) ما بتنعرّف هون: موجودة بـ supabase-offers.sql (ترجّع jsonb).
--    النسخة القديمة كانت ترجّع void، وإعادة تشغيل هاد الملف بعد offers كانت تعطي خطأ
--    "cannot change return type of existing function". شغّل supabase-offers.sql بعد هاد الملف.

-- محتوى الصفحة الرئيسية (الشريط الإعلاني / الـ hero / القسم المميز) لكل لغة
create table if not exists public.site_content (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table public.site_content enable row level security;
drop policy if exists "site_content read"  on public.site_content;
drop policy if exists "site_content write" on public.site_content;
create policy "site_content read"  on public.site_content for select using (true);
create policy "site_content write" on public.site_content for all to authenticated using (true) with check (true);
