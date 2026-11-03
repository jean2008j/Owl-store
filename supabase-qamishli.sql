-- OWL STORE: فصل الحسكة عن القامشلي + خيارات التوصيل الجديدة
-- شغّله مرة وحدة: Supabase > SQL Editor > New query > الصق > Run  (آمن لو شغّلته أكثر من مرة)
-- الترتيب: بعد supabase-offers.sql.
--
-- النتيجة:
--   الحسكة   : شركة صلة (توصيل لباب المنزل، 4$، 2–7 أيام) أو شركة الرافدين (استلام من مكتبهم بكراج تل حجز، 2$، يوم واحد).
--   القامشلي : استلام من المحل مباشرة (بدون أجرة) أو توصيل لباب المنزل (2$). بدون أي شركة شحن.

-- 1) عمود «ليست شركة شحن» (الاستلام من المحل / التوصيل المباشر ما بيظهرلهم كلمة «شركة»)
alter table public.shipping_companies
  add column if not exists is_company boolean not null default true;

-- 2) الرافدين: مكتبهم بالحسكة بكراج تل حجز (الاستلام من المكتب متل باقي المحافظات)
update public.shipping_companies
   set zones = zones || '[{"city":"Al-Hasakah","areas":"كراج تل حجز","etaAr":"يوم واحد","etaEn":"1 day"}]'::jsonb,
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

-- 4) مدة التوصيل ثابتة: الرافدين 2–3 أيام (والحسكة يوم واحد)، وصلة 2–7 أيام
update public.shipping_companies c
   set zones = (
         select coalesce(jsonb_agg(
                case when z->>'city' = 'Al-Hasakah'
                     then z || jsonb_build_object('etaAr', 'يوم واحد', 'etaEn', '1 day')
                     else z || jsonb_build_object('etaAr', '2–3 أيام', 'etaEn', '2–3 days')
                end), '[]'::jsonb)
           from jsonb_array_elements(c.zones) z
       ),
       updated_at = now()
 where c.id = 'rafidain';

update public.shipping_companies c
   set zones = (
         select coalesce(jsonb_agg(z || jsonb_build_object('etaAr', '2–7 أيام', 'etaEn', '2–7 days')), '[]'::jsonb)
           from jsonb_array_elements(c.zones) z
       ),
       updated_at = now()
 where c.id = 'sila';

notify pgrst, 'reload schema';
