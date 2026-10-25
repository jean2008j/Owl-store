import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  deleteCoupon,
  fetchCoupons,
  fetchShippingZones,
  isSupabaseConfigured,
  saveCoupon,
  saveShippingZones,
  setCouponActive,
} from "@/lib/db-service";
import { DEFAULT_SHIPPING_ZONES, money, type Coupon, type ShippingZone } from "@/lib/store/catalog";
import { CITY_AR } from "@/lib/i18n/content";
import { cn } from "@/lib/utils";

/** "الشحن والعروض" tab: shipping fee per governorate + discount codes. Everything is priced by the database. */
export function OffersTab() {
  if (!isSupabaseConfigured) {
    return (
      <p className="max-w-xl border border-line p-4 text-sm text-muted">
        الشحن حسب المحافظة وأكواد الخصم يعملان مع قاعدة البيانات (Supabase). اربط المتجر بـ Supabase وشغّل ملف
        supabase-offers.sql حتى تظهر هنا.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-12">
      <Block title="الشحن حسب المحافظة" hint="فعّل المحافظات التي توصل إليها وحدّد سعر الشحن لكل محافظة. المحافظة المعطّلة لا تظهر للزبون.">
        <ShippingSection />
      </Block>
      <Block
        title="أكواد الخصم"
        hint="يُطبَّق الخصم على سعر المنتجات فقط (بدون الشحن). يجري التحقق من الكود وحساب المبلغ في قاعدة البيانات."
      >
        <CouponsSection />
      </Block>
    </div>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-5 border-b border-line pb-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Shipping zones                                                       */
/* ------------------------------------------------------------------ */

type ZoneDraft = Omit<ShippingZone, "fee"> & { fee: string };

const toDraft = (zones: ShippingZone[]): ZoneDraft[] => zones.map((z) => ({ ...z, fee: String(z.fee) }));

function ShippingSection() {
  const [saved, setSaved] = useState<ShippingZone[] | null>(null);
  const [draft, setDraft] = useState<ZoneDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notSaved, setNotSaved] = useState(false);
  const [restored, setRestored] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    void fetchShippingZones().then((rows) => {
      if (!live) return;
      // No rows yet (SQL not run / empty table): show the defaults and let the admin save them.
      const base = rows && rows.length ? rows : DEFAULT_SHIPPING_ZONES;
      setNotSaved(!rows || rows.length === 0);
      setSaved(base);
      // A governorate that is missing from the table (deleted by mistake) comes back as a closed row, so it can be re-enabled and saved.
      const have = new Set(base.map((row) => row.city));
      const missing = rows && rows.length ? DEFAULT_SHIPPING_ZONES.filter((row) => !have.has(row.city)) : [];
      setRestored(missing.map((row) => row.city));
      setDraft(toDraft([...base, ...missing.map((row) => ({ ...row, enabled: false }))]));
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const dirty = useMemo(
    () => notSaved || JSON.stringify(draft) !== JSON.stringify(saved ? toDraft(saved) : []),
    [draft, saved, notSaved],
  );

  function patch(city: string, change: Partial<ZoneDraft>) {
    setDraft((rows) => rows.map((row) => (row.city === city ? { ...row, ...change } : row)));
  }

  async function save() {
    const zones: ShippingZone[] = [];
    for (const row of draft) {
      const fee = Number(row.fee);
      if (row.fee.trim() === "" || !Number.isFinite(fee) || fee < 0) {
        toast.error(`سعر الشحن لـ ${CITY_AR[row.city] ?? row.city} غير صحيح.`);
        return;
      }
      zones.push({ ...row, fee });
    }
    setSaving(true);
    const res = await saveShippingZones(zones);
    setSaving(false);
    if (!res.ok) return toast.error(res.message || "تعذّر حفظ الشحن.");
    setSaved(zones);
    setDraft(toDraft(zones));
    setNotSaved(false);
    setRestored([]);
    toast("تم حفظ الشحن.");
  }

  if (loading) return <Loader2 className="size-5 animate-spin text-muted" />;

  const activeCount = draft.filter((row) => row.enabled).length;

  return (
    <div className="flex flex-col gap-4">
      {notSaved ? (
        <p className="border border-line p-3 text-xs text-muted">
          هذه القيم افتراضية ولم تُحفظ في قاعدة البيانات بعد. عدّلها ثم اضغط «حفظ». (إذا لم ينجح الحفظ، شغّل ملف
          supabase-offers.sql في Supabase.)
        </p>
      ) : null}
      {restored.length ? (
        <p className="border border-line p-3 text-xs text-muted">
          محافظات غير موجودة في قاعدة البيانات أُضيفت هنا معطّلة: {restored.map((city) => CITY_AR[city] ?? city).join("، ")}. فعّلها ثم اضغط «حفظ» لإرجاعها.
        </p>
      ) : null}
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[720px] text-start text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-3 py-3 text-start font-normal">المحافظة</th>
              <th className="px-3 py-3 text-start font-normal">الحالة</th>
              <th className="px-3 py-3 text-start font-normal">سعر الشحن ($)</th>
              <th className="px-3 py-3 text-start font-normal">مدة التوصيل (عربي)</th>
              <th className="px-3 py-3 text-start font-normal">مدة التوصيل (English)</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((row) => (
              <tr key={row.city} className={cn("border-b border-line last:border-0", !row.enabled && "opacity-60")}>
                <td className="px-3 py-2 font-bold">{CITY_AR[row.city] ?? row.city}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.enabled}
                    onClick={() => patch(row.city, { enabled: !row.enabled })}
                    className={cn(
                      "min-h-9 px-3 font-display text-xs tracking-widest",
                      row.enabled ? "bg-fg text-bg" : "border border-line text-muted",
                    )}
                  >
                    {row.enabled ? "مفعّلة" : "معطّلة"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <input
                    className="field w-24"
                    dir="ltr"
                    inputMode="decimal"
                    value={row.fee}
                    onChange={(event) => patch(row.city, { fee: event.target.value })}
                    aria-label={`سعر الشحن ${CITY_AR[row.city] ?? row.city}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="field min-w-36"
                    value={row.etaAr}
                    onChange={(event) => patch(row.city, { etaAr: event.target.value })}
                    placeholder="مثلاً: 2–4 أيام"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="field min-w-32"
                    dir="ltr"
                    value={row.etaEn}
                    onChange={(event) => patch(row.city, { etaEn: event.target.value })}
                    placeholder="e.g. 2–4 days"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div dir="ltr" className="flex flex-wrap items-center justify-start gap-2">
        <button type="button" className="btn-solid" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          حفظ الشحن
        </button>
        <button
          type="button"
          className="btn-line"
          disabled={!dirty || saving || !saved}
          onClick={() => {
            if (!saved) return;
            setDraft(toDraft(saved));
          }}
        >
          إلغاء التغييرات
        </button>
        <span dir="rtl" className="ms-2 text-xs text-muted">
          {activeCount} من {draft.length} محافظة مفعّلة{dirty ? " · في تغييرات غير محفوظة" : ""}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coupons                                                              */
/* ------------------------------------------------------------------ */

type CouponForm = {
  id: string | null;
  code: string;
  type: "percent" | "fixed";
  value: string;
  minOrder: string;
  maxUses: string;
  startsAt: string; // datetime-local
  endsAt: string; // datetime-local
  active: boolean;
};

const EMPTY_FORM: CouponForm = {
  id: null,
  code: "",
  type: "percent",
  value: "",
  minOrder: "",
  maxUses: "",
  startsAt: "",
  endsAt: "",
  active: true,
};

const pad = (n: number) => String(n).padStart(2, "0");
/** Coupon dates are always entered and shown in Syria's time, whatever the time zone of the admin's device. */
const STORE_TZ = "Asia/Damascus";

/** Wall-clock parts of an instant in Syria's time. */
function zoneParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

/** ISO → value for <input type="datetime-local"> in Syria's time. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const p = zoneParts(ms);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** Value typed as Syria's time → ISO (UTC). */
function fromLocalInput(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Find the offset of Syria's zone at that moment (two passes, in case the offset changes around it).
  let guess = asUtc;
  for (let i = 0; i < 2; i += 1) {
    const p = zoneParts(guess);
    const shown = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    guess += asUtc - shown;
  }
  return new Date(guess).toISOString();
}
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: STORE_TZ });

type Status = { label: string; tone: "on" | "off" };
function couponStatus(c: Coupon, now = Date.now()): Status {
  if (!c.active) return { label: "متوقف", tone: "off" };
  if (c.startsAt && now < new Date(c.startsAt).getTime()) return { label: "لم يبدأ بعد", tone: "off" };
  if (c.endsAt && now > new Date(c.endsAt).getTime()) return { label: "منتهي", tone: "off" };
  if (c.maxUses != null && c.usedCount >= c.maxUses) return { label: "استُنفد", tone: "off" };
  return { label: "فعّال", tone: "on" };
}

function CouponsSection() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<CouponForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchCoupons();
    setCoupons(res.coupons);
    setLoadError(res.ok ? "" : (res.message ?? "تعذّر جلب الأكواد."));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function edit(c: Coupon) {
    setForm({
      id: c.id,
      code: c.code,
      type: c.type,
      value: String(c.value),
      minOrder: c.minOrder ? String(c.minOrder) : "",
      maxUses: c.maxUses == null ? "" : String(c.maxUses),
      startsAt: toLocalInput(c.startsAt),
      endsAt: toLocalInput(c.endsAt),
      active: c.active,
    });
  }

  async function submit() {
    if (!form) return;
    const code = form.code.trim().toUpperCase();
    const value = Number(form.value);
    const minOrder = form.minOrder.trim() === "" ? 0 : Number(form.minOrder);
    const maxUses = form.maxUses.trim() === "" ? null : Number(form.maxUses);

    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return toast.error("الكود: 6 إلى 32 حرف أو رقم إنكليزي (أو - أو _) بدون مسافات.");
    // Short codes are easy to guess. Old short codes keep working, but a new code (or a renamed one) needs 6+ characters.
    if (code.length < 6 && (!form.id || code !== coupons.find((row) => row.id === form.id)?.code)) {
      return toast.error("يجب أن يكون الكود 6 أحرف أو أرقام على الأقل، مثل OWL10-X7K (الأطول أصعب في التخمين).");
    }
    if (!Number.isFinite(value) || value <= 0) return toast.error("أدخل قيمة الخصم.");
    if (form.type === "percent" && value > 100) return toast.error("نسبة الخصم لا تتجاوز 100%.");
    if (!Number.isFinite(minOrder) || minOrder < 0) return toast.error("الحد الأدنى للطلب غير صحيح.");
    if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1)) return toast.error("يجب أن يكون عدد الاستخدامات عددًا صحيحًا أكبر من صفر.");
    const startsAt = fromLocalInput(form.startsAt);
    const endsAt = fromLocalInput(form.endsAt);
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return toast.error("يجب أن يكون تاريخ النهاية بعد تاريخ البداية.");

    setSaving(true);
    const res = await saveCoupon({ id: form.id, code, type: form.type, value, minOrder, maxUses, startsAt, endsAt, active: form.active });
    setSaving(false);
    if (!res.ok) return toast.error(res.message || "تعذّر حفظ الكود.");
    toast(form.id ? "تم تعديل الكود." : "تمت إضافة الكود.");
    setForm(null);
    void load();
  }

  async function toggle(c: Coupon) {
    const res = await setCouponActive(c.id, !c.active);
    if (!res.ok) return toast.error(res.message || "تعذّر التغيير.");
    setCoupons((rows) => rows.map((row) => (row.id === c.id ? { ...row, active: !c.active } : row)));
  }

  async function remove(c: Coupon) {
    if (!window.confirm(`حذف الكود ${c.code}؟ لن تتأثر الطلبات السابقة التي استخدمته.`)) return;
    const res = await deleteCoupon(c.id);
    if (!res.ok) return toast.error(res.message || "تعذّر الحذف.");
    setCoupons((rows) => rows.filter((row) => row.id !== c.id));
    toast("تم حذف الكود.");
  }

  const set = (change: Partial<CouponForm>) => setForm((current) => (current ? { ...current, ...change } : current));

  return (
    <div className="flex flex-col gap-6">
      {loadError ? <p className="border border-line p-3 text-sm text-muted">{loadError}</p> : null}

      {form ? (
        <div className="border border-line p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-bold">{form.id ? "تعديل الكود" : "كود جديد"}</h3>
            <button type="button" className="btn-line" onClick={() => setForm(null)} aria-label="إغلاق">
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="field-label">الكود</span>
              <input
                className="field"
                dir="ltr"
                value={form.code}
                onChange={(event) => set({ code: event.target.value.toUpperCase().replace(/\s/g, "") })}
                placeholder="OWL10"
                maxLength={32}
                autoComplete="off"
              />
              <span className="mt-1 block text-xs text-muted">حروف وأرقام إنكليزية. يمكن للزبون كتابته بأي حالة أحرف.</span>
            </label>
            <div>
              <span className="field-label">نوع الخصم</span>
              <div className="flex gap-2">
                {(
                  [
                    ["percent", "نسبة %"],
                    ["fixed", "مبلغ ثابت $"],
                  ] as const
                ).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set({ type })}
                    className={cn(
                      "min-h-11 flex-1 px-3 font-display text-xs tracking-widest",
                      form.type === type ? "bg-fg text-bg" : "border border-line text-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="field-label">{form.type === "percent" ? "قيمة الخصم (%)" : "قيمة الخصم ($)"}</span>
              <input
                className="field"
                dir="ltr"
                inputMode="decimal"
                value={form.value}
                onChange={(event) => set({ value: event.target.value })}
                placeholder={form.type === "percent" ? "10" : "5"}
              />
            </label>
            <label className="block">
              <span className="field-label">الحد الأدنى للطلب ($)</span>
              <input
                className="field"
                dir="ltr"
                inputMode="decimal"
                value={form.minOrder}
                onChange={(event) => set({ minOrder: event.target.value })}
                placeholder="بدون حد أدنى"
              />
              <span className="mt-1 block text-xs text-muted">يُحسب على مجموع المنتجات قبل الخصم وبدون الشحن.</span>
            </label>
            <label className="block">
              <span className="field-label">عدد الاستخدامات</span>
              <input
                className="field"
                dir="ltr"
                inputMode="numeric"
                value={form.maxUses}
                onChange={(event) => set({ maxUses: event.target.value.replace(/\D/g, "") })}
                placeholder="غير محدود"
              />
              <span className="mt-1 block text-xs text-muted">كل طلب يُحسب استخدامًا واحدًا، ويُعاد الاستخدام إذا أُلغي الطلب. ويُسمح باستخدام الكود مرة واحدة لكل رقم هاتف.</span>
            </label>
            <div className="flex items-end">
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={form.active} onChange={(event) => set({ active: event.target.checked })} className="size-5" />
                <span className="text-sm">الكود مفعّل</span>
              </label>
            </div>
            <label className="block">
              <span className="field-label">يبدأ من</span>
              <input className="field" dir="ltr" type="datetime-local" value={form.startsAt} onChange={(event) => set({ startsAt: event.target.value })} />
              <span className="mt-1 block text-xs text-muted">اتركه فارغًا ليعمل من الآن. بتوقيت سوريا.</span>
            </label>
            <label className="block">
              <span className="field-label">ينتهي في</span>
              <input className="field" dir="ltr" type="datetime-local" value={form.endsAt} onChange={(event) => set({ endsAt: event.target.value })} />
              <span className="mt-1 block text-xs text-muted">اتركه فارغًا بلا تاريخ انتهاء. بتوقيت سوريا.</span>
            </label>
          </div>
          <div dir="ltr" className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="button" className="btn-solid" disabled={saving} onClick={() => void submit()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {form.id ? "حفظ التعديل" : "إضافة الكود"}
            </button>
            <button type="button" className="btn-line" disabled={saving} onClick={() => setForm(null)}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" className="btn-solid" onClick={() => setForm({ ...EMPTY_FORM })}>
            <Plus className="size-4" />
            كود جديد
          </button>
        </div>
      )}

      {loading ? (
        <Loader2 className="size-5 animate-spin text-muted" />
      ) : coupons.length === 0 ? (
        <p className="text-sm text-muted">لا توجد أكواد بعد.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {coupons.map((c) => {
            const status = couponStatus(c);
            return (
              <li key={c.id} className="border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg tracking-widest" dir="ltr">
                      {c.code}
                    </p>
                    <p className="mt-1 text-sm">
                      خصم {c.type === "percent" ? `${c.value}%` : money(c.value)}
                      {c.minOrder > 0 ? ` · حد أدنى ${money(c.minOrder)}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 text-xs font-bold",
                      status.tone === "on" ? "bg-fg text-bg" : "border border-line text-muted",
                    )}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  الاستخدام: {c.usedCount}
                  {c.maxUses != null ? ` من ${c.maxUses}` : " (غير محدود)"}
                  {" · "}
                  {c.startsAt ? `من ${fmtDate(c.startsAt)}` : "من الآن"}
                  {" · "}
                  {c.endsAt ? `إلى ${fmtDate(c.endsAt)}` : "بدون نهاية"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-line" onClick={() => void toggle(c)}>
                    {c.active ? "إيقاف" : "تفعيل"}
                  </button>
                  <button type="button" className="btn-line" onClick={() => edit(c)}>
                    <Pencil className="size-4" />
                    تعديل
                  </button>
                  <button type="button" className="btn-line" onClick={() => void remove(c)}>
                    <Trash2 className="size-4" />
                    حذف
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
