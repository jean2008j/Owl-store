import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'),
)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// ---------- Helpers ----------
// يحوّل أخطاء Supabase التقنية إلى جملة مفهومة تقولك شو تعمل
export function explainSupabaseError(message = '') {
  if (/row-level security|violates row-level|not authorized|jwt|permission denied/i.test(message)) {
    return `انتهت جلسة الدخول أو ما عندك صلاحية. اعمل تسجيل خروج ثم ادخل من جديد. (${message})`
  }
  if (/bucket not found/i.test(message)) {
    return 'مخزن الصور product-media غير موجود. شغّل ملف supabase-fix.sql بـ Supabase. (' + message + ')'
  }
  if (/schema cache|column .* does not exist|relation .* does not exist/i.test(message)) {
    return `جدول ناقص بقاعدة البيانات. شغّل ملف supabase-fix.sql بـ Supabase. (${message})`
  }
  return message
}

// ---------- Media (Supabase Storage) ----------
const MEDIA_BUCKET = 'product-media'
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' }

// يرفع صورة/فيديو (data URL) إلى Storage ويرجّع رابطها العام
export async function uploadMediaToStorage(dataUrl, folder = 'misc') {
  if (!supabase) throw new Error('Supabase غير مُعرّف')
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${folder}/${crypto.randomUUID()}.${EXT[blob.type] || 'bin'}`
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (error) throw new Error(explainSupabaseError(error.message))
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

// ---------- Products ----------
export async function fetchProductsFromDatabase() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('products')
    .select('data')
    .not('data', 'is', null)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('خطأ في جلب المنتجات:', error.message)
    return []
  }
  return (data || []).map((row) => row.data).filter(Boolean)
}

export async function upsertProductToDatabase(product) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const stockTotal = Object.values(product.stock || {}).reduce((a, b) => a + (Number(b) || 0), 0)
  const { error } = await supabase.from('products').upsert(
    {
      pid: product.id,
      name: product.name,
      price: product.price,
      stock: stockTotal,
      image_url: typeof product.images?.[0] === 'string' && !product.images[0].startsWith('data:') ? product.images[0] : null,
      category: product.tags?.[0] ?? null,
      data: product,
    },
    { onConflict: 'pid' },
  )
  if (error) console.error('خطأ في حفظ المنتج:', error.message)
  return error ? { ok: false, message: explainSupabaseError(error.message) } : { ok: true }
}

export async function deleteProductFromDatabase(id) {
  if (!supabase) return
  const { error } = await supabase.from('products').delete().eq('pid', id)
  if (error) console.error('خطأ في حذف المنتج:', error.message)
}

// ---------- Site content (announcement / hero / feature, per language) ----------
export async function fetchSiteContentFromDatabase() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('site_content')
    .select('data')
    .eq('id', 'main')
    .maybeSingle()
  if (error) {
    console.error('خطأ في جلب محتوى الموقع:', error.message)
    return null
  }
  return data?.data ?? null
}

export async function upsertSiteContentToDatabase(content) {
  if (!supabase) return false
  const { error } = await supabase
    .from('site_content')
    .upsert({ id: 'main', data: content, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) console.error('خطأ في حفظ محتوى الموقع:', error.message)
  return !error
}

// ---------- Payment settings (Sham Cash name / account / QR) — shown to customers at checkout ----------
export async function fetchPaymentSettings() {
  if (!supabase) return null
  const { data, error } = await supabase.from('site_content').select('data').eq('id', 'payment').maybeSingle()
  if (error) {
    console.error('خطأ في جلب إعدادات الدفع:', error.message)
    return null
  }
  return data?.data ?? null
}

export async function upsertPaymentSettings(payment) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const { error } = await supabase
    .from('site_content')
    .upsert({ id: 'payment', data: payment, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) console.error('خطأ في حفظ إعدادات الدفع:', error.message)
  return error ? { ok: false, message: explainSupabaseError(error.message) } : { ok: true }
}

// ---------- Shipping zones (governorates + fee), edited in the admin tab "الشحن والعروض" ----------
const mapZone = (r) => ({
  city: r.city,
  enabled: Boolean(r.enabled),
  fee: Number(r.fee) || 0,
  etaAr: r.eta_ar || '',
  etaEn: r.eta_en || '',
  sortOrder: Number(r.sort_order) || 0,
})

// null = الجدول غير موجود/خطأ (الموقع يستخدم القيم الافتراضية)، [] = موجود وفاضي
export async function fetchShippingZones() {
  if (!supabase) return null
  const { data, error } = await supabase.from('shipping_zones').select('*').order('sort_order', { ascending: true })
  if (error) {
    console.error('خطأ في جلب مناطق الشحن:', error.message)
    return null
  }
  return (data || []).map(mapZone)
}

export async function saveShippingZones(zones) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const rows = zones.map((z, i) => ({
    city: z.city,
    enabled: z.enabled,
    fee: Math.max(0, Number(z.fee) || 0),
    eta_ar: z.etaAr || '',
    eta_en: z.etaEn || '',
    sort_order: z.sortOrder || i + 1,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('shipping_zones').upsert(rows, { onConflict: 'city' })
  if (error) console.error('خطأ في حفظ الشحن:', error.message)
  return error ? { ok: false, message: explainSupabaseError(error.message) } : { ok: true }
}

// ---------- Shipping companies (Sila, Al-Rafidain…): flat fee + covered governorates, chosen by the customer ----------
const mapCompany = (r) => ({
  id: r.id,
  nameAr: r.name_ar || '',
  nameEn: r.name_en || '',
  fee: Number(r.fee) || 0,
  deliveryAr: r.delivery_ar || '',
  deliveryEn: r.delivery_en || '',
  enabled: Boolean(r.enabled),
  sortOrder: Number(r.sort_order) || 0,
  zones: (Array.isArray(r.zones) ? r.zones : []).map((z) => ({
    city: String(z.city || ''),
    areas: String(z.areas || ''),
    etaAr: String(z.etaAr || ''),
    etaEn: String(z.etaEn || ''),
  })),
})

// null = الجدول غير موجود/خطأ (الموقع يرجع لشحن المحافظات)، [] = موجود وفاضي
export async function fetchShippingCompanies() {
  if (!supabase) return null
  const { data, error } = await supabase.from('shipping_companies').select('*').order('sort_order', { ascending: true })
  if (error) {
    console.error('خطأ في جلب شركات الشحن:', error.message)
    return null
  }
  return (data || []).map(mapCompany)
}

// يحفظ كل الشركات، ويحذف من قاعدة البيانات أي شركة انحذفت من القائمة (removedIds)
export async function saveShippingCompanies(companies, removedIds = []) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const rows = companies.map((c, i) => ({
    id: c.id,
    name_ar: c.nameAr.trim(),
    name_en: c.nameEn.trim(),
    fee: Math.max(0, Number(c.fee) || 0),
    delivery_ar: c.deliveryAr.trim(),
    delivery_en: c.deliveryEn.trim(),
    enabled: Boolean(c.enabled),
    sort_order: i + 1,
    zones: c.zones.map((z) => ({ city: z.city, areas: z.areas.trim(), etaAr: z.etaAr.trim(), etaEn: z.etaEn.trim() })),
    updated_at: new Date().toISOString(),
  }))
  if (removedIds.length) {
    const del = await supabase.from('shipping_companies').delete().in('id', removedIds)
    if (del.error) {
      console.error('خطأ في حذف شركة الشحن:', del.error.message)
      return { ok: false, message: explainSupabaseError(del.error.message) }
    }
  }
  if (rows.length) {
    const { error } = await supabase.from('shipping_companies').upsert(rows, { onConflict: 'id' })
    if (error) {
      console.error('خطأ في حفظ شركات الشحن:', error.message)
      const missing = /shipping_companies.*does not exist|schema cache/i.test(error.message)
      return {
        ok: false,
        message: missing ? 'جدول شركات الشحن غير موجود. شغّل ملف supabase-offers.sql في Supabase.' : explainSupabaseError(error.message),
      }
    }
  }
  return { ok: true }
}

// ---------- Coupons (admin only; customers validate through quote_order) ----------
const mapCoupon = (r) => ({
  id: r.id,
  code: r.code,
  type: r.type,
  value: Number(r.value) || 0,
  minOrder: Number(r.min_order) || 0,
  maxUses: r.max_uses == null ? null : Number(r.max_uses),
  usedCount: Number(r.used_count) || 0,
  startsAt: r.starts_at || null,
  endsAt: r.ends_at || null,
  active: Boolean(r.active),
})

export async function fetchCoupons() {
  if (!supabase) return { ok: false, coupons: [], message: 'Supabase غير مُعرّف' }
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
  if (error) {
    console.error('خطأ في جلب الأكواد:', error.message)
    return { ok: false, coupons: [], message: explainOffersError(error.message) }
  }
  return { ok: true, coupons: (data || []).map(mapCoupon) }
}

// يضيف كود جديد، أو يعدّل كود موجود إذا كان فيه id
export async function saveCoupon(coupon) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const row = {
    code: String(coupon.code).trim().toUpperCase(),
    type: coupon.type,
    value: Number(coupon.value),
    min_order: Number(coupon.minOrder) || 0,
    max_uses: coupon.maxUses == null || coupon.maxUses === '' ? null : Number(coupon.maxUses),
    starts_at: coupon.startsAt || null,
    ends_at: coupon.endsAt || null,
    active: Boolean(coupon.active),
  }
  const query = coupon.id
    ? supabase.from('coupons').update(row).eq('id', coupon.id)
    : supabase.from('coupons').insert(row)
  const { error } = await query
  if (error) {
    console.error('خطأ في حفظ الكود:', error.message)
    return { ok: false, message: explainOffersError(error.message) }
  }
  return { ok: true }
}

export async function setCouponActive(id, active) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const { error } = await supabase.from('coupons').update({ active }).eq('id', id)
  return error ? { ok: false, message: explainOffersError(error.message) } : { ok: true }
}

export async function deleteCoupon(id) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const { error } = await supabase.from('coupons').delete().eq('id', id)
  return error ? { ok: false, message: explainOffersError(error.message) } : { ok: true }
}

function explainOffersError(message = '') {
  if (/duplicate key|coupons_code_key/i.test(message)) return 'هذا الكود موجود مسبقًا، اختر اسمًا آخر.'
  if (/coupons_code_format/i.test(message)) return 'يجب أن يكون الكود من 6 إلى 32 حرفًا أو رقمًا إنكليزيًا (أو - أو _).'
  if (/coupons_percent_max/i.test(message)) return 'نسبة الخصم لا يمكن أن تتجاوز 100%.'
  if (/COUPON_CODE_TOO_SHORT/i.test(message)) return 'يجب أن يكون الكود 6 أحرف أو أرقام على الأقل (الأطول أصعب في التخمين).'
  if (/coupons_dates/i.test(message)) return 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية.'
  if (/relation .*(coupons|shipping_zones|shipping_companies).* does not exist|schema cache/i.test(message)) {
    return 'جداول الشحن والعروض غير موجودة. شغّل ملف supabase-offers.sql في Supabase.'
  }
  return explainSupabaseError(message)
}

// ---------- Order pricing — computed by the database, never by the browser ----------
// items: [{ productId, size, qty }]. Returns the real subtotal / shipping / discount / total.
// هل الخطأ معناه أن الدالة غير موجودة بقاعدة البيانات (وليس مشكلة اتصال مؤقتة)؟
// PGRST202 = PostgREST ما لقي الدالة بالـ schema cache، 42883 = undefined_function بـ Postgres.
function isMissingFunctionError(error) {
  if (!error) return false
  const code = String(error.code || '')
  if (code === 'PGRST202' || code === '42883') return true
  return /could not find the function|function .* does not exist/i.test(error.message || '')
}

/**
 * @typedef {{ ok: true, subtotal: number, shippingFee: number, discount: number, total: number,
 *   coupon: string | null, couponError: string | null, couponMin: number }} QuoteOk
 * @typedef {{ ok: false, error: 'UNAVAILABLE' | 'NETWORK' | string, productId?: string }} QuoteFail
 * @param {{ items: { productId: string, size: string, qty: number }[], city: string, code?: string | null, secret?: string | null, company?: string | null }} args
 * @returns {Promise<QuoteOk | QuoteFail>}
 */
export async function quoteOrder({ items, city, code, secret, company }) {
  if (!supabase) return { ok: false, error: 'UNAVAILABLE' }
  const args = {
    p_items: items,
    p_city: city,
    p_code: code || null,
    p_secret: secret || null, // الرمز السري: لازم لحساب المنتجات السرية فقط
  }
  // شركة الشحن المختارة (السعر سعرها). ما نبعتها إلا إذا انختارت، حتى يضل الموقع شغال قبل تشغيل supabase-offers.sql الجديد.
  if (company) args.p_company = company
  const { data, error } = await supabase.rpc('quote_order', args)
  if (error || !data) {
    if (error) console.error('خطأ في حساب الطلب:', error.message)
    // UNAVAILABLE = الدالة فعلاً غير موجودة بقاعدة البيانات (ما انشغّل supabase-offers.sql) → نخفي خانة الكود.
    // NETWORK     = خطأ مؤقت (انقطاع نت، مهلة، ضغط على السيرفر) → ما نخفي شي، ونسمح بإعادة المحاولة.
    return { ok: false, error: isMissingFunctionError(error) ? 'UNAVAILABLE' : 'NETWORK' }
  }
  if (!data.ok) return { ok: false, error: data.error, productId: data.productId }
  return {
    ok: true,
    subtotal: Number(data.subtotal),
    shippingFee: Number(data.shipping_fee),
    discount: Number(data.discount),
    total: Number(data.total),
    coupon: data.coupon ? data.coupon.code : null,
    couponError: data.coupon_error || null,
    couponMin: Number(data.coupon_min) || 0,
  }
}

// ---------- Orders ----------
// الزبون (بدون تسجيل دخول) يحفظ الطلب عبر دالة place_order بالـ SQL.
// الدالة تعيد حساب الأسعار والشحن والخصم بنفسها، وتنقّص المخزون، وترجّع الأرقام النهائية.
export async function submitOrderToDatabase(order, { secretCode } = {}) {
  if (!supabase) return null
  const { receiptDataUrl, ...clean } = order // صورة الإيصال تروح للتلغرام فقط
  // secretCode: يلزم فقط إذا بالسلة منتج من القسم السري. السيرفر ما بيخزّنه مع الطلب.
  const payload = secretCode ? { ...clean, secretCode } : clean
  const { data, error } = await supabase.rpc('place_order', { p_order: payload })
  if (error) {
    console.error('خطأ في حفظ الطلب:', error.message)
    const msg = error.message || ''
    // الدالة بالـ SQL ترفض الطلب إذا الكمية ما بتكفي: OUT_OF_STOCK|<productId>|<size>|<left>
    const m = /OUT_OF_STOCK\|([^|]*)\|([^|]*)\|(\d+)/.exec(msg)
    if (m) {
      const err = new Error('OUT_OF_STOCK')
      err.code = 'OUT_OF_STOCK'
      err.productId = m[1]
      err.size = m[2]
      err.left = Number(m[3])
      throw err
    }
    const c = /COUPON\|([A-Z_]+)\|([\d.]+)/.exec(msg)
    if (c) {
      const err = new Error(c[1])
      err.code = 'COUPON'
      err.reason = c[1]
      err.min = Number(c[2]) || 0
      throw err
    }
    const r = /ORDER_REJECTED\|([A-Z_]+)\|([^|]*)/.exec(msg)
    if (r) {
      const err = new Error(r[1])
      err.code = r[1]
      err.productId = r[2]
      throw err
    }
    const v = /INVALID_ORDER\|([A-Z_]+)/.exec(msg)
    if (v) {
      const err = new Error('INVALID_ORDER')
      err.code = 'INVALID_ORDER'
      err.field = v[1]
      throw err
    }
    throw new Error('فشل حفظ الطلب في قاعدة البيانات')
  }
  // السيرفر بيرجّع ok=false (بدل exception) لأخطاء الكود/المنتج/المحافظة، حتى تنحفظ محاولات تخمين الأكواد.
  if (data && data.ok === false) {
    if (data.coupon_error) {
      const err = new Error(data.coupon_error)
      err.code = 'COUPON'
      err.reason = data.coupon_error
      err.min = Number(data.coupon_min) || 0
      throw err
    }
    const err = new Error(data.error || 'ORDER_REJECTED')
    err.code = data.error || 'ORDER_REJECTED'
    err.productId = data.productId || ''
    throw err
  }
  return data || true
}

// يرجّع null عند الخطأ (حتى ما تنعرض طلبات قديمة محلية على أنها الحقيقية)، ومصفوفة (ولو فاضية) عند النجاح.
export async function fetchOrdersFromDatabase() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('orders')
    .select('data, status')
    .not('data', 'is', null)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('خطأ في جلب الطلبات:', error.message)
    return null
  }
  return (data || []).map((row) => ({ ...row.data, status: row.status, receiptDataUrl: '' }))
}

// الإلغاء نهائي: السيرفر بيرجّع المخزون وبينقص استخدام الكود مرة وحدة، وما بيسمح يرجع الطلب لحالة ثانية.
export async function updateOrderStatusInDatabase(ref, status) {
  if (!supabase) return { ok: true }
  const { error } = await supabase.from('orders').update({ status }).eq('ref', ref)
  if (error) {
    console.error('خطأ في تحديث حالة الطلب:', error.message)
    return {
      ok: false,
      message: /CANCELLED_IS_FINAL/.test(error.message)
        ? 'الطلب الملغى لا يمكن إعادته. أنشئ طلبًا جديدًا.'
        : explainSupabaseError(error.message),
    }
  }
  return { ok: true }
}

// ---------- Admin auth ----------
export async function adminSignIn(email, password) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function adminHasSession() {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

export async function adminSignOut() {
  if (supabase) await supabase.auth.signOut()
}

// ---------- Secret section ----------
// الرمز محفوظ بجدول مقفول؛ الزبون يفتح القسم عبر دالة SQL تتحقق من الرمز وترجع المنتجات السرية فقط إذا صح
export async function fetchSecretProducts(code) {
  if (!supabase) return { ok: false, products: [], message: 'Supabase غير مُعرّف' }
  const { data, error } = await supabase.rpc('get_secret_products', { p_code: code })
  if (error) {
    console.error('خطأ في فتح القسم السري:', error.message)
    return { ok: false, products: [], message: explainSupabaseError(error.message) }
  }
  if (data?.error === 'RATE_LIMITED') {
    return { ok: false, products: [], message: 'محاولات كثيرة. حاول مجددًا بعد قليل.' }
  }
  return { ok: Boolean(data?.ok), products: data?.products ?? [] }
}

export async function fetchSecretCode() {
  if (!supabase) return null
  const { data, error } = await supabase.from('secret_section').select('code').eq('id', 'main').maybeSingle()
  if (error) {
    console.error('خطأ في جلب رمز القسم السري:', error.message)
    return null
  }
  return data?.code ?? null
}

export async function saveSecretCode(code) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const { error } = await supabase.from('secret_section').upsert({ id: 'main', code }, { onConflict: 'id' })
  return error ? { ok: false, message: explainSupabaseError(error.message) } : { ok: true }
}

// ---------- Admin users (via the admin-users Edge Function) ----------
export async function adminUsersCall(action, payload = {}) {
  if (!supabase) return { ok: false, message: 'Supabase غير مُعرّف' }
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action, ...payload } })
  if (error) {
    let detail = error.message || ''
    try {
      const body = await error.context?.json?.()
      if (body?.message) detail = body.message
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      message: /not found|404|Failed to send|fetch/i.test(detail)
        ? 'دالة admin-users غير منشورة بعد. شغّل: supabase functions deploy admin-users'
        : detail || 'فشل الاتصال بالدالة.',
    }
  }
  return data ?? { ok: false, message: 'ما وصل رد من الدالة.' }
}
