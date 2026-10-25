-- OWL STORE: شركات الشحن + أكواد الخصم (الحساب كله بقاعدة البيانات)
-- شغّله مرة وحدة: Supabase > SQL Editor > New query > الصق > Run  (آمن لو شغّلته أكثر من مرة)
-- الترتيب: supabase-setup.sql ← supabase-fix.sql ← supabase-security.sql ← هذا الملف.
-- هذا الملف هو المكان الوحيد اللي بتتعرّف فيه: place_order و quote_order و get_secret_products (لا تعرّفهم بمكان تاني).

-- ============================================================
-- 1) شركات الشحن (صلة، الرافدين...): كل شركة بسعر ثابت ومناطق تغطيها. الزبون يختار الشركة بصفحة الدفع.
--     zones = مصفوفة: [{ "city": "Damascus", "areas": "...", "etaAr": "...", "etaEn": "..." }]
--     إذا ما في شركة مفعّلة تغطي المحافظة، ما بيتقبّل أي طلب لهالمحافظة.
-- ============================================================
create table if not exists public.shipping_companies (
  id          text primary key,
  name_ar     text          not null,
  name_en     text          not null default '',
  fee         numeric(10,2) not null default 0 check (fee >= 0),
  delivery_ar text          not null default '',     -- مثلاً: إلى باب المنزل / الاستلام من مكتب الشركة
  delivery_en text          not null default '',
  enabled     boolean       not null default true,
  sort_order  int           not null default 0,
  zones       jsonb         not null default '[]'::jsonb,
  updated_at  timestamptz   not null default now()
);
alter table public.shipping_companies enable row level security;
drop policy if exists "shipping_companies read"  on public.shipping_companies;
drop policy if exists "shipping_companies write" on public.shipping_companies;
create policy "shipping_companies read"  on public.shipping_companies for select using (true);
create policy "shipping_companies write" on public.shipping_companies for all to authenticated using (true) with check (true);

insert into public.shipping_companies (id, name_ar, name_en, fee, delivery_ar, delivery_en, enabled, sort_order, zones) values
  ('sila', 'صلة', 'Sila', 4, 'إلى باب المنزل', 'Home delivery', true, 1, '[
    {"city":"Damascus","areas":"الزبداني، القطيفة، برزة، يبرود، الزبلطاني، أشرفية صحنايا","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Rural Damascus","areas":"الزبداني، القطيفة، برزة، يبرود، الزبلطاني، أشرفية صحنايا","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Deir ez-Zor","areas":"البوكمال، الميادين، مركزي","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Tartus","areas":"حديقة الملجأ، بانياس، دريكيش","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Aleppo","areas":"منبج، مركزي - الأعظمية، اعزاز، الأتارب، الباب، دوار الموت","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Hama","areas":"البارودية، السقيلبية، سلمية، مصياف","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Homs","areas":"كرم اللوز، الحولة، الرستن، تل كلخ","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Daraa","areas":"المجمع الحكومي، انخل","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Idlib","areas":"المتنبي، أريحا، البارة، حارم، خان شيخون، سراقب، سرمدا، معرة النعمان","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Al-Hasakah","areas":"الحسكة والقامشلي: الكلاسة، مركزي - دوار التفاحة","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Raqqa","areas":"سوق الهال القديم، سلوك","etaAr":"5–10 أيام","etaEn":"5–10 days"},
    {"city":"Latakia","areas":"المشروع السابع، جبلة","etaAr":"5–10 أيام","etaEn":"5–10 days"}
  ]'::jsonb),
  ('rafidain', 'الرافدين', 'Al-Rafidain', 2, 'الاستلام من مكتب الشركة', 'Pick-up from the company office', true, 2, '[
    {"city":"Damascus","areas":"جسر فيكتوريا خلف البريد القديم","etaAr":"2–3 أيام","etaEn":"2–3 days"},
    {"city":"Aleppo","areas":"السليمانية خلف زجاج غريبه","etaAr":"يومين","etaEn":"2 days"},
    {"city":"Homs","areas":"الكراج الشمالي","etaAr":"2–3 أيام","etaEn":"2–3 days"}
  ]'::jsonb)
on conflict (id) do nothing;

-- ============================================================
-- 2) أكواد الخصم (الزبون ما يقدر يقرأ الجدول أبداً؛ يتحقق من الكود عبر الدالة تحت)
-- ============================================================
create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text          not null,
  type        text          not null check (type in ('percent', 'fixed')),
  value       numeric(10,2) not null check (value > 0),
  min_order   numeric(10,2) not null default 0 check (min_order >= 0),  -- حد أدنى لمجموع المنتجات
  max_uses    int           check (max_uses is null or max_uses > 0),   -- null = بلا حد
  used_count  int           not null default 0,
  starts_at   timestamptz,                                              -- null = من الآن
  ends_at     timestamptz,                                              -- null = بلا نهاية
  active      boolean       not null default true,                      -- زر التفعيل / الإيقاف
  created_at  timestamptz   not null default now(),
  constraint coupons_code_format  check (code ~ '^[A-Z0-9_-]{3,32}$'),
  constraint coupons_percent_max  check (type <> 'percent' or value <= 100),
  constraint coupons_dates        check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create unique index if not exists coupons_code_key on public.coupons (code);
alter table public.coupons enable row level security;
revoke all on public.coupons from anon;
drop policy if exists "coupons admin" on public.coupons;
create policy "coupons admin" on public.coupons for all to authenticated using (true) with check (true);
-- (بدون سياسة للزوار عن قصد: الكودات ما بتتسرّب)

-- ============================================================
-- 2.5) حماية من التخمين: سجل محاولات + مفتاح العميل (IP) + حد المحاولات
--      القفل الاستشاري (advisory lock) يخلّي الطلبات المتوازية من نفس العميل تنحسب واحد ورا واحد،
--      فما بيمرق تخمين متوازي من تحت الحد.
-- ============================================================
create table if not exists public.rate_events (
  id   bigint generated always as identity primary key,
  kind text        not null,
  key  text        not null,
  at   timestamptz not null default now()
);
create index if not exists rate_events_lookup on public.rate_events (kind, key, at);
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;
-- (بدون سياسات عن قصد: ما أحد من المتصفح بيقدر يوصل للجدول)

-- المفتاح: cf-connecting-ip (Cloudflare بيكتبه ومابيتزوّر) ثم x-real-ip ثم أول عنوان بـ x-forwarded-for.
create or replace function public.client_key()
returns text language plpgsql stable as $$
declare h json;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    h := null;
  end;
  return coalesce(
    nullif(btrim(h->>'cf-connecting-ip'), ''),
    nullif(btrim(h->>'x-real-ip'), ''),
    nullif(btrim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );
end $$;

-- هل وصل هذا العميل للحد؟ (بياخد القفل، فاستدعيها قبل ما تسجّل المحاولة بنفس العملية)
create or replace function public.rate_limited(p_kind text, p_limit int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare k text := public.client_key(); n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_kind || ':' || k));
  select count(*) into n from public.rate_events where kind = p_kind and key = k and at > now() - p_window;
  return n >= p_limit;
end $$;

create or replace function public.rate_hit(p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.rate_events (kind, key) values (p_kind, public.client_key());
  if random() < 0.02 then
    delete from public.rate_events where at < now() - interval '1 day';
  end if;
end $$;

revoke all on function public.client_key() from public, anon, authenticated;
revoke all on function public.rate_limited(text, int, interval) from public, anon, authenticated;
revoke all on function public.rate_hit(text) from public, anon, authenticated;

-- طول الكود: 6 على الأقل للأكواد الجديدة أو لما يتغيّر نص الكود (الأكواد القديمة القصيرة بتضل شغالة ولا تنكسر).
create or replace function public.coupons_min_length()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if length(new.code) < 6 then raise exception 'COUPON_CODE_TOO_SHORT'; end if;
  elsif new.code is distinct from old.code and length(new.code) < 6 then
    raise exception 'COUPON_CODE_TOO_SHORT';
  end if;
  return new;
end $$;
drop trigger if exists coupons_min_length on public.coupons;
create trigger coupons_min_length before insert or update on public.coupons
  for each row execute function public.coupons_min_length();

-- ============================================================
-- 2.6) حالة «ملغي»: ترجّع المخزون وتنقص استخدام الكود (مرة وحدة، وبشكل نهائي)
-- ============================================================
alter table public.orders drop constraint if exists orders_status_check;
create index if not exists orders_coupon_idx on public.orders ((upper(data->>'coupon'))) where data->>'coupon' is not null;

create or replace function public.orders_on_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  if old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    raise exception 'CANCELLED_IS_FINAL';
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for it in select * from jsonb_array_elements(coalesce(old.data->'items', '[]'::jsonb)) loop
      if nullif(it->>'colorId', '') is not null then
        -- نرجّع لمخزون اللون (إذا المنتج بيتتبّع الألوان) ولمجموع المقاس
        update public.products
           set data = jsonb_set(
                 case when coalesce(jsonb_typeof(data->'colorStock'->(it->>'colorId')) = 'object', false)
                      then jsonb_set(
                             data, array['colorStock', it->>'colorId', it->>'size'],
                             to_jsonb(coalesce((data->'colorStock'->(it->>'colorId')->>(it->>'size'))::int, 0) + coalesce((it->>'qty')::int, 0))
                           )
                      else data end,
                 array['stock', it->>'size'],
                 to_jsonb(coalesce((data->'stock'->>(it->>'size'))::int, 0) + coalesce((it->>'qty')::int, 0))
               )
         where pid = it->>'productId' and data is not null;
      else
        update public.products
           set data = jsonb_set(
                 data, array['stock', it->>'size'],
                 to_jsonb(coalesce((data->'stock'->>(it->>'size'))::int, 0) + coalesce((it->>'qty')::int, 0))
               )
         where pid = it->>'productId' and data is not null;
      end if;
    end loop;
    if coalesce(old.data->>'coupon', '') <> '' then
      update public.coupons set used_count = greatest(used_count - 1, 0) where code = upper(old.data->>'coupon');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_on_status_change on public.orders;
create trigger orders_on_status_change before update of status on public.orders
  for each row execute function public.orders_on_status_change();

-- ============================================================
-- 2.7) فتح القسم السري (انتقلت هون من supabase-security.sql حتى ما ترجع النسخة القديمة عند إعادة تشغيله)
-- ============================================================
create or replace function public.get_secret_products(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
  result jsonb;
begin
  if public.rate_limited('secret', 10, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'products', '[]'::jsonb, 'error', 'RATE_LIMITED');
  end if;
  select exists (select 1 from public.secret_section where id = 'main' and code = p_code) into ok;
  if not ok then
    perform public.rate_hit('secret');
    return jsonb_build_object('ok', false, 'products', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(data order by created_at desc), '[]'::jsonb)
    into result
    from public.products
   where data is not null and coalesce((data->>'secret')::boolean, false) = true;
  return jsonb_build_object('ok', true, 'products', result);
end $$;
grant execute on function public.get_secret_products(text) to anon, authenticated;

-- ============================================================
-- 3) حساب الطلب بالكامل بقاعدة البيانات: أسعار المنتجات + الشحن + الخصم
--    الأسعار تؤخذ من جدول المنتجات، مو من المتصفح، فما أحد يقدر يتلاعب بالمبلغ.
--    المنتجات السرية ما بتنحسب إلا إذا انبعت الرمز السري الصحيح (p_secret)،
--    وإلا بيجي نفس رد «المنتج غير موجود» حتى ما ينكشف وجودها أو سعرها.
-- ============================================================
drop function if exists public.quote_order(jsonb, text, text);
drop function if exists public.quote_order(jsonb, text, text, text);
create or replace function public.quote_order(
  p_items   jsonb,
  p_city    text,
  p_code    text default null,
  p_secret  text default null,
  p_company text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it        jsonb;
  v_qty     int;
  v_price   numeric;
  v_is_secret boolean;
  v_secret_ok boolean := null;
  v_sub     numeric := 0;
  v_prices  jsonb := '[]'::jsonb;
  sc        public.shipping_companies%rowtype;
  v_fee     numeric;
  c         public.coupons%rowtype;
  v_code    text := upper(btrim(coalesce(p_code, '')));
  v_disc    numeric := 0;
  v_cerr    text := null;
  v_cmin    numeric := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'EMPTY_CART');
  end if;
  if jsonb_array_length(p_items) > 50 then
    return jsonb_build_object('ok', false, 'error', 'BAD_QTY');
  end if;

  -- مجموع المنتجات (بأسعار قاعدة البيانات)
  for it in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(it) <> 'object' or coalesce(it->>'qty', '') !~ '^[0-9]{1,3}$' then
      return jsonb_build_object('ok', false, 'error', 'BAD_QTY');
    end if;
    v_qty := (it->>'qty')::int;
    if v_qty < 1 or v_qty > 100 then
      return jsonb_build_object('ok', false, 'error', 'BAD_QTY');
    end if;
    select (data->>'price')::numeric, coalesce((data->>'secret')::boolean, false)
      into v_price, v_is_secret
      from public.products
     where pid = it->>'productId' and data is not null;
    if not found or v_price is null then
      return jsonb_build_object('ok', false, 'error', 'PRODUCT_NOT_FOUND', 'productId', it->>'productId');
    end if;

    if v_is_secret then
      if v_secret_ok is null then
        if public.rate_limited('secret', 10, interval '10 minutes') then
          v_secret_ok := false;
        else
          v_secret_ok := coalesce(p_secret, '') <> ''
            and exists (select 1 from public.secret_section where id = 'main' and code = p_secret);
          if not v_secret_ok then perform public.rate_hit('secret'); end if;
        end if;
      end if;
      if not v_secret_ok then
        return jsonb_build_object('ok', false, 'error', 'PRODUCT_NOT_FOUND', 'productId', it->>'productId');
      end if;
    end if;

    v_sub    := v_sub + v_price * v_qty;
    v_prices := v_prices || to_jsonb(v_price);
  end loop;

  -- الشحن: لازم شركة شحن مفعّلة تغطي هالمحافظة، والسعر سعرها. بدون شركة ما في طلب.
  select * into sc from public.shipping_companies where id = nullif(btrim(coalesce(p_company, '')), '');
  if not found or not sc.enabled
     or not exists (
       select 1 from jsonb_array_elements(sc.zones) zz where zz->>'city' = p_city
     ) then
    return jsonb_build_object('ok', false, 'error', 'CITY_UNAVAILABLE');
  end if;
  v_fee := sc.fee;

  -- كود الخصم (يُطبَّق على المنتجات فقط، بدون الشحن)
  -- كل محاولة فاشلة (كود غلط/منتهي/مستنفد) بتنسجّل؛ بعد 8 محاولات بـ 10 دقائق من نفس العميل بنوقف التحقق مؤقتاً.
  if v_code <> '' then
    if public.rate_limited('coupon', 8, interval '10 minutes') then
      v_cerr := 'COUPON_RATE_LIMITED';
    else
      select * into c from public.coupons where code = v_code;
      if not found or not c.active then
        v_cerr := 'COUPON_INVALID';
      elsif c.starts_at is not null and now() < c.starts_at then
        v_cerr := 'COUPON_NOT_STARTED';
      elsif c.ends_at is not null and now() > c.ends_at then
        v_cerr := 'COUPON_EXPIRED';
      elsif c.max_uses is not null and c.used_count >= c.max_uses then
        v_cerr := 'COUPON_USED_UP';
      elsif v_sub < c.min_order then
        v_cerr := 'COUPON_MIN_ORDER';
        v_cmin := c.min_order;
      else
        if c.type = 'percent' then
          v_disc := round(v_sub * c.value / 100, 2);
        else
          v_disc := c.value;
        end if;
        v_disc := least(v_disc, v_sub);
      end if;
      if v_cerr is not null and v_cerr <> 'COUPON_MIN_ORDER' then
        perform public.rate_hit('coupon');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'subtotal', v_sub,
    'shipping_fee', v_fee,
    'discount', v_disc,
    'total', v_sub - v_disc + v_fee,
    'coupon', case when v_code <> '' and v_cerr is null
                   then jsonb_build_object('code', c.code, 'type', c.type, 'value', c.value) end,
    'coupon_error', v_cerr,
    'coupon_min', v_cmin,
    'unit_prices', v_prices
  );
end $$;
revoke all on function public.quote_order(jsonb, text, text, text, text) from public;
grant execute on function public.quote_order(jsonb, text, text, text, text) to anon, authenticated;

-- ============================================================
-- 4) حفظ الطلب: يتحقق من بيانات الزبون، يعيد حساب كل شي بالسيرفر، يعيد بناء بنود الطلب من جدول المنتجات،
--    ينقّص المخزون، ويزيد عدّاد الكود (بقفل يمنع تجاوز عدد الاستخدامات).
--    - الاسم/الهاتف/العنوان تنفحص وتنظَّف. اسم المنتج واللون والقياس والـ fit تنفحص مقابل المنتج الحقيقي.
--    - الطلب المخزّن مبني من حقول معروفة فقط (ما بنخزّن أي شي زائد بعته المتصفح).
--    - الكود: مرة واحدة لكل رقم هاتف (بالطلبات غير الملغية).
--    - أخطاء الطلب/الكود بتنرجّع كـ jsonb فيه ok=false (مو exception) حتى تنحفظ محاولات التخمين.
-- ============================================================
drop function if exists public.place_order(jsonb);
create or replace function public.place_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it        jsonb;
  idx       int;
  cur       int;
  gone      boolean;
  pd        jsonb;
  q         jsonb;
  v_code    text;
  v_secret  text;
  v_ref     text;
  v_name    text;
  v_phone   text;
  v_addr    text;
  v_city    text;
  v_company text;
  v_cname   text;
  v_phone_key text;
  v_size    text;
  v_fit     text;
  v_color   text;
  v_col     jsonb;
  v_cid     text;
  v_cs      boolean;
  v_q       int;
  v_items   jsonb := '[]'::jsonb;
  v_coupon  text;
  fin       jsonb;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object'
     or jsonb_typeof(p_order->'customer') is distinct from 'object'
     or jsonb_typeof(p_order->'items') is distinct from 'array' then
    raise exception 'INVALID_ORDER|BODY';
  end if;

  -- بيانات الزبون
  v_ref   := btrim(coalesce(p_order->>'ref', ''));
  v_name  := btrim(regexp_replace(coalesce(p_order->'customer'->>'name', ''),    '[[:cntrl:]]', ' ', 'g'));
  -- الأرقام العربية/الفارسية (٠-٩ و ۰-۹) تتحوّل لأرقام إنكليزية قبل الفحص
  v_phone := btrim(regexp_replace(
               translate(coalesce(p_order->'customer'->>'phone', ''),
                         '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
               '[[:cntrl:]]', ' ', 'g'));
  v_addr  := btrim(regexp_replace(coalesce(p_order->'customer'->>'address', ''), '[[:cntrl:]]', ' ', 'g'));
  v_city  := p_order->'customer'->>'city';
  v_company := nullif(btrim(coalesce(p_order->'shipping'->>'companyId', '')), '');

  if v_ref !~ '^[A-Za-z0-9-]{4,32}$' then raise exception 'INVALID_ORDER|REF'; end if;
  if char_length(v_name) < 3 or char_length(v_name) > 80 then raise exception 'INVALID_ORDER|NAME'; end if;
  if v_phone !~ '^[0-9+ ()-]{8,20}$'
     or char_length(regexp_replace(v_phone, '\D', '', 'g')) not between 8 and 15 then
    raise exception 'INVALID_ORDER|PHONE';
  end if;
  if char_length(v_addr) < 8 or char_length(v_addr) > 300 then raise exception 'INVALID_ORDER|ADDRESS'; end if;

  v_code   := upper(btrim(coalesce(p_order->>'coupon', '')));
  v_secret := p_order->>'secretCode';

  -- قفل صف الكود حتى لا يستخدمه شخصان معاً بعد آخر استخدام (وحتى يشوف الطلب الثاني الطلب الأول)
  if v_code <> '' then
    perform 1 from public.coupons where code = v_code for update;
  end if;

  q := public.quote_order(p_order->'items', v_city, nullif(v_code, ''), v_secret, v_company);
  if (q->>'ok')::boolean then
    select name_ar into v_cname from public.shipping_companies where id = v_company;
  end if;
  if not (q->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', q->>'error', 'productId', coalesce(q->>'productId', ''));
  end if;
  if v_code <> '' and q->>'coupon_error' is not null then
    return jsonb_build_object('ok', false, 'coupon_error', q->>'coupon_error', 'coupon_min', coalesce(q->>'coupon_min', '0'));
  end if;

  -- الكود مرة واحدة لكل رقم هاتف (آخر 9 أرقام، حتى 09xx و +963 9xx و 00963 9xx تنحسب نفس الرقم)
  v_coupon := q->'coupon'->>'code';
  if v_coupon is not null then
    v_phone_key := right(regexp_replace(v_phone, '\D', '', 'g'), 9);
    if exists (
      select 1 from public.orders o
       where upper(o.data->>'coupon') = v_coupon
         and o.status is distinct from 'cancelled'
         and right(regexp_replace(coalesce(o.phone, ''), '\D', '', 'g'), 9) = v_phone_key
    ) then
      return jsonb_build_object('ok', false, 'coupon_error', 'COUPON_PHONE_USED', 'coupon_min', '0');
    end if;
  end if;

  -- بنود الطلب: نفحص كل بند مقابل المنتج الحقيقي ونعيد بناءه، وننقّص المخزون
  for it, idx in
    select e.value, (e.ord - 1)::int
      from jsonb_array_elements(p_order->'items') with ordinality as e(value, ord)
  loop
    select data into pd
      from public.products
     where pid = it->>'productId' and data is not null
       for update;
    if pd is null then
      -- raise (مو return): ممكن نكون نقّصنا مخزون بنود سابقة، والـ exception بيرجّعه
      raise exception 'ORDER_REJECTED|PRODUCT_NOT_FOUND|%', coalesce(it->>'productId', '');
    end if;

    v_size := it->>'size';
    if v_size is null or v_size not in ('XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL') then
      raise exception 'INVALID_ORDER|SIZE';
    end if;

    v_fit := it->>'fit';
    if jsonb_typeof(pd->'fits') = 'array' and jsonb_array_length(pd->'fits') > 0 then
      if v_fit is null or not (pd->'fits') ? v_fit then raise exception 'INVALID_ORDER|FIT'; end if;
    elsif v_fit is null or v_fit not in ('Oversize', 'Boxy Fit', 'Regular Fit') then
      raise exception 'INVALID_ORDER|FIT';
    end if;

    -- اللون: نطابقه بالمعرّف (colorId) إذا انبعت، وإلا بالاسم. بعدين نستخدم معرّفه لمخزون هذا اللون.
    v_color := it->>'color';
    v_col := null;
    v_cid := null;
    if jsonb_typeof(pd->'colors') = 'array' and jsonb_array_length(pd->'colors') > 0 then
      select col into v_col
        from jsonb_array_elements(pd->'colors') col
       where (nullif(it->>'colorId', '') is not null and col->>'id' = it->>'colorId')
          or (nullif(it->>'colorId', '') is null and v_color in (col->>'name', col->>'nameEn', col->>'nameAr'))
       limit 1;
      if v_col is null then
        raise exception 'INVALID_ORDER|COLOR';
      end if;
      v_cid   := v_col->>'id';
      v_color := coalesce(v_col->>'name', v_color);
    else
      v_color := 'Default';
    end if;

    -- المخزون: لكل (لون، مقاس) إذا المنتج بيتتبّع مخزون الألوان، وإلا مجموع المقاس (منتجات قديمة)
    v_q  := (it->>'qty')::int;
    v_cs := v_cid is not null and coalesce(jsonb_typeof(pd->'colorStock'->v_cid) = 'object', false);
    if v_cs then
      cur := coalesce((pd->'colorStock'->v_cid->>v_size)::int, 0);
    else
      cur := coalesce((pd->'stock'->>v_size)::int, 0);
    end if;
    gone := coalesce((pd->>'soldOut')::boolean, false);
    if gone or cur < v_q then
      raise exception 'OUT_OF_STOCK|%|%|%', it->>'productId', v_size, case when gone then 0 else cur end;
    end if;
    if v_cs then
      update public.products
         set data = jsonb_set(
               jsonb_set(data, array['colorStock', v_cid, v_size], to_jsonb(cur - v_q)),
               array['stock', v_size],
               to_jsonb(greatest(coalesce((data->'stock'->>v_size)::int, 0) - v_q, 0))
             )
       where pid = it->>'productId';
    else
      update public.products
         set data = jsonb_set(data, array['stock', v_size], to_jsonb(cur - v_q))
       where pid = it->>'productId';
    end if;

    v_items := v_items || jsonb_build_object(
      'productId', it->>'productId',
      'colorId',   v_cid,
      'name',      coalesce(pd->>'name', ''),
      'size',      v_size,
      'fit',       v_fit,
      'color',     v_color,
      'qty',       (it->>'qty')::int,
      'unitPrice', (q->'unit_prices'->>idx)::numeric
    );
  end loop;

  -- الطلب المخزّن: حقول معروفة فقط، والأرقام من السيرفر
  fin := jsonb_build_object(
    'ref',       v_ref,
    'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'customer',  jsonb_build_object('name', v_name, 'phone', v_phone, 'city', v_city, 'address', v_addr),
    'shipping',  jsonb_build_object('id', v_company, 'label', coalesce(v_cname, v_company), 'fee', (q->>'shipping_fee')::numeric, 'companyId', v_company),
    'items',     v_items,
    'subtotal',  (q->>'subtotal')::numeric,
    'discount',  (q->>'discount')::numeric,
    'coupon',    v_coupon,
    'total',     (q->>'total')::numeric,
    'payment',   'Sham Cash',
    'telegram',  'unconfigured',
    'status',    'pending'
  );

  insert into public.orders (ref, customer_name, phone, address, items, total_price, status, data)
  values (
    v_ref,
    v_name,
    v_phone,
    v_city || ' - ' || v_addr,
    v_items,
    (q->>'total')::numeric,
    'pending',
    fin
  );

  if v_coupon is not null then
    update public.coupons set used_count = used_count + 1 where code = v_coupon;
  end if;

  return jsonb_build_object(
    'ok',          true,
    'subtotal',    (q->>'subtotal')::numeric,
    'shippingFee', (q->>'shipping_fee')::numeric,
    'discount',    (q->>'discount')::numeric,
    'total',       (q->>'total')::numeric,
    'coupon',      v_coupon
  );
end $$;
revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
