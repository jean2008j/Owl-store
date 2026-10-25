-- OWL STORE: إصلاح حفظ المنتجات + مخزن الصور
-- شغّله مرة وحدة: Supabase > SQL Editor > New query > الصق > Run
-- آمن لو شغّلته أكثر من مرة (ما بيلمس دالة place_order).
-- ملاحظة: حفظ الطلبات ومنع بيع كمية أكثر من المتوفر صار بـ supabase-offers.sql، شغّله بعد هذا الملف.

-- 1) أعمدة الجداول (لو كانت ناقصة)
alter table public.products add column if not exists pid  text unique;
alter table public.products add column if not exists data jsonb;
alter table public.orders   add column if not exists ref  text unique;
alter table public.orders   add column if not exists data jsonb;

alter table public.products enable row level security;
alter table public.orders   enable row level security;

drop policy if exists "products read"  on public.products;
drop policy if exists "products write" on public.products;
create policy "products read"  on public.products for select using (true);
create policy "products write" on public.products for all to authenticated using (true) with check (true);

drop policy if exists "orders admin" on public.orders;
create policy "orders admin" on public.orders for all to authenticated using (true) with check (true);

-- 2) مخزن صور وفيديوهات المنتجات (الصور تنحفظ هون، والمنتج يحفظ الرابط فقط)
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do update set public = true;

drop policy if exists "product-media read"   on storage.objects;
drop policy if exists "product-media insert" on storage.objects;
drop policy if exists "product-media update" on storage.objects;
drop policy if exists "product-media delete" on storage.objects;
create policy "product-media read"   on storage.objects for select using (bucket_id = 'product-media');
create policy "product-media insert" on storage.objects for insert to authenticated with check (bucket_id = 'product-media');
create policy "product-media update" on storage.objects for update to authenticated using (bucket_id = 'product-media');
create policy "product-media delete" on storage.objects for delete to authenticated using (bucket_id = 'product-media');

-- 3) دالة حفظ الطلب (place_order) انتقلت إلى supabase-offers.sql.
--    ما نعرّفها هون عمداً: النسخة الجديدة ترجّع jsonb والقديمة كانت ترجّع void،
--    وPostgres ما بيسمح يغيّر نوع الإرجاع بـ create or replace، فإعادة تشغيل هاد الملف كانت تكسر الدالة/تعطي خطأ.
--    بعد هذا الملف شغّل supabase-offers.sql لتثبيت place_order.

notify pgrst, 'reload schema';
