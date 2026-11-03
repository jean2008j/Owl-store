-- OWL STORE: فصل الحسكة عن القامشلي + خيارات التوصيل الجديدة
-- شغّله مرة وحدة: Supabase > SQL Editor > New query > الصق > Run  (آمن لو شغّلته أكثر من مرة)
-- الترتيب: بعد supabase-offers.sql.
--
-- النتيجة:
--   الحسكة   : شركة صلة (توصيل لباب المنزل، 4$) أو شركة الرافدين (استلام من مكتبهم بكراج تل حجز، 2$).
--   القامشلي : استلام من المحل مباشرة (بدون أجرة) أو توصيل لباب المنزل (2$). بدون أي شركة شحن.

-- 1) عمود «ليست شركة شحن» (الاستلام من المحل / التوصيل المباشر ما بيظهرلهم كلمة «شركة»)
alter table public.shipping_companies
  add column if not exists is_company boolean not null default true;

-- 2) الرافدين: مكتبهم بالحسكة بكراج تل حجز (الاستلام من المكتب متل باقي المحافظات)
update public.shipping_companies
   set zones = zones || '[{"city":"Al-Hasakah","areas":"كراج تل حجز","etaAr":"","etaEn":""}]'::jsonb,
       updated_at = now()
 where id = 'rafidain'
   and not exists (
     select 1 from jsonb_array_elements(zones) z where z->>'city' = 'Al-Hasakah'
   );

-- 3) القامشلي: خياران فقط (المحل بالقامشلي، فما في شركة شحن)
insert into public.shipping_companies
  (id, name_ar, name_en, fee, delivery_ar, delivery_en, pickup, is_company, enabled, sort_order, zones)
values
  ('qamishli-store', 'استلام من المحل', 'Pick up from the store', 0,
   'بدون أجرة توصيل', 'No delivery fee', true, false, true, 3,
   '[{"city":"Qamishli","areas":"","etaAr":"","etaEn":""}]'::jsonb),
  ('qamishli-home', 'توصيل لباب المنزل', 'Home delivery', 2,
   '', '', false, false, true, 4,
   '[{"city":"Qamishli","areas":"","etaAr":"","etaEn":""}]'::jsonb)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
