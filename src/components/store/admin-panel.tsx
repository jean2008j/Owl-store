import { useState, useEffect, useRef } from "react";
import type { SiteContent } from "@/lib/store/catalog";
import {
  ChevronDown,
  Languages,
  Loader2,
  Lock,
  LockOpen,
  Minus,
  Monitor,
  Moon,
  Pencil,
  Pipette,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ColorPinPicker } from "@/components/store/color-pin-picker";
import { FeatureSection, HeroSection } from "@/components/store/home-sections";
import { StatsTab } from "@/components/store/stats-tab";
import { SecurityTab } from "@/components/store/security-tab";
import { OffersTab } from "@/components/store/offers-tab";
import { refreshProducts } from "@/lib/store/refresh";
import { toast } from "sonner";
import {
  blankProduct,
  catLabel,
  MAX_HERO_IMAGES,
  money,
  SIZE_MAX,
  SIZE_MIN,
  SIZE_STEP,
  type TextKey,
  NAV,
  productCat,
  shopLabel,
  type NavCat,
  SIZES,
  TAGS,
  visibleSizes,
  type Order,
  type Product,
  type Size,
  type Tag,
} from "@/lib/store/catalog";
import { fileToJpegDataUrl } from "@/lib/store/images";
import { translateArToEn } from "@/lib/translate";
import { ensureAllEnglish, ensureProductEnglish } from "@/lib/store/auto-english";
import { uploadOrKeep, uploadProductMedia } from "@/lib/store/media";
import { useOwl } from "@/lib/store/owl-store";
import { cn } from "@/lib/utils";
import {
  adminHasSession,
  adminSignIn,
  fetchOrdersFromDatabase,
  isSupabaseConfigured,
  upsertProductToDatabase,
} from "@/lib/db-service";

const TABS = ["Stats", "Storefront", "Products", "Orders", "Offers", "Security"] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  Stats: "الإحصائيات",
  Storefront: "واجهة المتجر",
  Products: "المنتجات",
  Orders: "الطلبات",
  Offers: "الشحن والعروض",
  Security: "الأمان",
};

const ICON_BTN =
  "inline-flex size-11 shrink-0 items-center justify-center border border-line text-fg transition-colors hover:bg-fg hover:text-bg";

/** One button that flips between dark and light mode. */
function ThemeToggle() {
  const theme = useOwl((state) => state.theme);
  const setTheme = useOwl((state) => state.setTheme);
  const dark = theme === "dark";
  const label = dark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن";
  return (
    <button
      type="button"
      className={ICON_BTN}
      title={label}
      aria-label={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

export function AdminPanel() {
  const unlocked = useOwl((state) => state.adminUnlocked);
  const pin = useOwl((state) => state.settings.adminPin);
  const unlock = useOwl((state) => state.unlockAdmin);
  const lockAdmin = useOwl((state) => state.lockAdmin);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !unlocked) return;
    void adminHasSession().then((ok) => {
      if (!ok) lockAdmin();
    });
  }, [unlocked, lockAdmin]);

  if (!unlocked) {
    return (
      <div dir="rtl" lang="ar" className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <div className="flex items-center justify-between gap-3">
          <span className={cn(ICON_BTN, "pointer-events-none")} aria-hidden>
            <Lock className="size-5" />
          </span>
          <ThemeToggle />
        </div>
        <p className="mt-6 font-display text-xs tracking-brand text-muted uppercase">الإدارة</p>
        <h1 className="mt-3 font-display text-4xl uppercase leading-none">التحكم بالمتجر</h1>
        <p className="mt-3 text-sm text-muted">
          الشريط الإعلاني والمنتجات والطلبات وشام كاش كلها من هنا.
        </p>
        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (isSupabaseConfigured) {
              void adminSignIn(email.trim(), code).then((res) => {
                if (res.ok) {
                  unlock();
                  setError("");
                } else {
                  setError(res.message);
                }
              });
            } else if (code.trim() === pin) {
              unlock();
              setError("");
            } else {
              setError("الرمز غير صحيح.");
            }
          }}
        >
          {isSupabaseConfigured ? (
            <>
              <label className="field-label" htmlFor="admin-email">
                البريد الإلكتروني
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field"
                autoComplete="username"
              />
            </>
          ) : null}
          <label className="field-label" htmlFor="admin-pin">
            {isSupabaseConfigured ? "كلمة المرور" : "رمز الدخول"}
          </label>
          <input
            id="admin-pin"
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="field"
            autoComplete="current-password"
          />
          {error ? <p className="text-sm text-muted">{error}</p> : null}
          <button type="submit" className="btn-solid">
            دخول
          </button>
          {isSupabaseConfigured ? null : (
            <p className="text-sm text-muted">رمز الدخول التجريبي: OWL-2026</p>
          )}
        </form>
      </div>
    );
  }

  return <Dashboard />;
}

function Dashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Stats");
  const lock = useOwl((state) => state.lockAdmin);

  return (
    <div dir="rtl" lang="ar" className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs tracking-brand text-muted uppercase">الإدارة</p>
          <h1 className="mt-2 font-display text-4xl uppercase leading-none">لوحة التحكم</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className={ICON_BTN}
            onClick={lock}
            title="قفل الإدارة"
            aria-label="قفل الإدارة"
          >
            <LockOpen className="size-5" />
          </button>
        </div>
      </div>
      <div className="mt-8 flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "min-h-11 shrink-0 px-4 font-display text-xs tracking-widest uppercase",
              tab === item ? "bg-fg text-bg" : "border border-line text-muted",
            )}
          >
            {TAB_LABEL[item]}
          </button>
        ))}
      </div>
      <div className="mt-8 min-w-0">
        {tab === "Stats" ? <StatsTab /> : null}
        {tab === "Storefront" ? <StorefrontTab /> : null}
        {tab === "Products" ? <ProductsTab /> : null}
        {tab === "Orders" ? <OrdersTab /> : null}
        {tab === "Offers" ? <OffersTab /> : null}
        {tab === "Security" ? <SecurityTab payments={<PaymentsSection />} /> : null}
      </div>
    </div>
  );
}

const T = {
    editing: "أنت تعدّل النسخة العربية من الموقع. بدّل اللغة من الأعلى لتعديل النسخة الإنجليزية.",
    announcement: "الشريط الإعلاني",
    hero: "الواجهة الرئيسية",
    save: "حفظ",
    cancelChanges: "إلغاء التغييرات",
    unsaved: "توجد تغييرات غير محفوظة",
    saved: "تم الحفظ",
    kicker: "العنوان الصغير",
    title: "العنوان الرئيسي",
    description: "الوصف",
    image: "الصورة",
    addImage: "اضغط لإضافة صورة من جهازك",
    imagesLeft: (n: number) => `${n} من ${MAX_HERO_IMAGES} صور · تتبدّل تلقائياً`,
    imagesFull: `الحد الأقصى ${MAX_HERO_IMAGES} صور — احذف صورة لإضافة غيرها`,
    button: "زر الواجهة",
    buttonHint: "يوجّه الزر الزبون إلى هذا القسم من المتجر.",
    preview: "المعاينة",
    feature: "القسم المميز",
    featureKicker: "العنوان الصغير",
    featureTitle: "العنوان",
    featureBody: "الوصف",
    product: "المنتج المرتبط",
    productHint:
      "تتبع الصورة والزر هذا المنتج؛ فمثلاً يُظهر التيشيرت زر «تسوق التيشيرتات» مع صورة التيشيرت.",
    noProduct: "بدون منتج",
    imgError: "تعذّرت قراءة الصورة.",
    remove: "حذف الصورة",
    mobileView: "عرض الجوال",
    desktopView: "عرض الحاسوب",
    mobileImage: "صورة الجوال (طولية)",
    mobileImagesLeft: (n: number) =>
      `${n} من ${MAX_HERO_IMAGES} صور للجوال · إذا تُركت فارغة تُستخدم صور الحاسوب على الجوال`,
  arBox: "عربي (يظهر في واجهة المتجر العربية)",
  enBox: "إنجليزي (يظهر في واجهة المتجر الإنجليزية)",
  fontSize: "حجم الخط",
  fontSizeReset: "إعادة الحجم الطبيعي",
  translate: "ترجمة تلقائية من العربية إلى الإنجليزية",
  translateEmpty: "اكتب النص بالعربية أولاً.",
  translateFail: "تعذّرت الترجمة، تحقق من الاتصال بالإنترنت أو اكتب الترجمة يدوياً.",
} as const;

type Section = "announcement" | "hero" | "feature";
type Draft = { ar: SiteContent; en: SiteContent };

/** Which saved fields (and font sizes) belong to each section's Save / Cancel buttons. */
const SECTION_FIELDS: Record<Section, { keys: (keyof SiteContent)[]; sizes: TextKey[] }> = {
  announcement: { keys: ["announcement"], sizes: [] },
  hero: {
    keys: ["heroKicker", "heroTitle", "heroSub", "heroImages", "heroImagesMobile", "heroCat"],
    sizes: ["heroKicker", "heroTitle", "heroSub"],
  },
  feature: {
    keys: ["featureKicker", "featureTitle", "featureBody", "featureProductId"],
    sizes: ["featureKicker", "featureTitle", "featureBody"],
  },
};

function pickSection(content: SiteContent, section: Section): Partial<SiteContent> {
  const { keys, sizes } = SECTION_FIELDS[section];
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = content[key];
  if (sizes.length) {
    const picked: Partial<Record<TextKey, number>> = {};
    for (const key of sizes) picked[key] = content.sizes?.[key];
    out.sizes = picked;
  }
  return out as Partial<SiteContent>;
}

const sectionSig = (d: Draft, section: Section) =>
  JSON.stringify([pickSection(d.ar, section), pickSection(d.en, section)]);

/** Copy one section from `from` into `into` (sizes are merged so other sections keep theirs). */
function applySection(into: Draft, from: Draft, section: Section): Draft {
  const next = { ...into };
  for (const lang of ["ar", "en"] as const) {
    const picked = pickSection(from[lang], section);
    next[lang] = {
      ...into[lang],
      ...picked,
      ...(picked.sizes ? { sizes: { ...(into[lang].sizes ?? {}), ...picked.sizes } } : {}),
    };
  }
  return next;
}

/** Save (left) and "cancel changes" buttons at the end of a section. */
function SectionActions({
  dirty,
  onSave,
  onCancel,
}: {
  dirty: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div dir="ltr" className="flex flex-wrap items-center justify-start gap-2 border-t border-line pt-4">
      <button type="button" className="btn-solid" disabled={!dirty} onClick={onSave}>
        {T.save}
      </button>
      <button type="button" className="btn-line" disabled={!dirty} onClick={onCancel}>
        {T.cancelChanges}
      </button>
      {dirty ? (
        <span dir="rtl" className="ms-2 text-xs text-muted">
          {T.unsaved}
        </span>
      ) : null}
    </div>
  );
}

function StorefrontTab() {
  const storeAr = useOwl((state) => state.settings.content.ar);
  const storeEn = useOwl((state) => state.settings.content.en);
  const products = useOwl((state) => state.products);
  const updateContent = useOwl((state) => state.updateContent);
  const t = T;

  // Edits go to a draft; each section's Save button writes them to the store (and database).
  const [draft, setDraft] = useState<Draft>({ ar: storeAr, en: storeEn });
  const baseRef = useRef<Draft>({ ar: storeAr, en: storeEn });
  const ar = draft.ar;
  const en = draft.en;
  const store: Draft = { ar: storeAr, en: storeEn };

  // When saved data changes from outside (database load), refresh sections with no pending edits.
  useEffect(() => {
    const base = baseRef.current;
    const incoming: Draft = { ar: storeAr, en: storeEn };
    for (const section of ["announcement", "hero", "feature"] as const) {
      const was = sectionSig(base, section);
      if (was === sectionSig(incoming, section)) continue;
      setDraft((d) => (sectionSig(d, section) === was ? applySection(d, incoming, section) : d));
    }
    baseRef.current = incoming;
  }, [storeAr, storeEn]);

  const dirty = (section: Section) => sectionSig(draft, section) !== sectionSig(store, section);
  const saveSection = (section: Section) => {
    const current = useOwl.getState().settings.content;
    for (const lang of ["ar", "en"] as const) {
      const picked = pickSection(draft[lang], section);
      updateContent(lang, {
        ...picked,
        ...(picked.sizes ? { sizes: { ...(current[lang].sizes ?? {}), ...picked.sizes } } : {}),
      });
    }
    toast(t.saved);
  };
  const cancelSection = (section: Section) =>
    setDraft((d) => applySection(d, { ar: storeAr, en: storeEn }, section));

  const updateAr = (patch: Partial<SiteContent>) => setDraft((d) => ({ ...d, ar: { ...d.ar, ...patch } }));
  const updateEn = (patch: Partial<SiteContent>) => setDraft((d) => ({ ...d, en: { ...d.en, ...patch } }));
  /** Images, hero button, linked product and font sizes are the same in both languages. */
  const updateBoth = (patch: Partial<SiteContent>) =>
    setDraft((d) => ({ ...d, ar: { ...d.ar, ...patch }, en: { ...d.en, ...patch } }));
  const sizeProps = (key: TextKey) => ({
    size: ar.sizes?.[key] ?? 100,
    onSize: (value: number) => updateBoth({ sizes: { ...(ar.sizes ?? {}), [key]: value } }),
  });
  // The preview follows the device: phone → mobile view, laptop → laptop view (until the admin picks one).
  const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const [heroView, setHeroView] = useState<"desktop" | "mobile">(() => (isPhone() ? "mobile" : "desktop"));
  const manualView = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const onChange = () => {
      if (!manualView.current) setHeroView(query.matches ? "mobile" : "desktop");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const mobile = heroView === "mobile";

  const productOptions = [
    { value: "", label: t.noProduct },
    ...products.map((product) => ({ value: product.id, label: product.name })),
  ];
  const categoryOptions = NAV.map((item) => ({
    value: item.cat,
    label: shopLabel("ar", item.cat),
  }));
  const linked = products.find((product) => product.id === ar.featureProductId);

  return (
    <div className="flex flex-col gap-12">
      {/* Announcement */}
      <section className="flex flex-col gap-3">
        <SectionTitle>{t.announcement}</SectionTitle>
        <BilingualField
          label={t.announcement}
          ar={ar.announcement}
          en={en.announcement}
          onAr={(announcement) => updateAr({ announcement })}
          onEn={(announcement) => updateEn({ announcement })}
        />
        <SectionActions
          dirty={dirty("announcement")}
          onSave={() => saveSection("announcement")}
          onCancel={() => cancelSection("announcement")}
        />
      </section>

      {/* Hero */}
      <section className="flex flex-col gap-5">
        <SectionTitle
          action={
            <button
              type="button"
              className={cn(
                "inline-flex min-h-9 items-center gap-2 border px-3 font-sans text-xs font-medium tracking-normal normal-case",
                mobile ? "border-fg bg-fg text-bg" : "border-line text-fg hover:border-fg",
              )}
              aria-pressed={mobile}
              onClick={() => {
                manualView.current = true;
                setHeroView(mobile ? "desktop" : "mobile");
              }}
            >
              {mobile ? <Monitor className="size-4" /> : <Smartphone className="size-4" />}
              {mobile ? t.desktopView : t.mobileView}
            </button>
          }
        >
          {t.hero}
        </SectionTitle>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <BilingualField
              label={t.kicker}
              ar={ar.heroKicker}
              en={en.heroKicker}
              onAr={(heroKicker) => updateAr({ heroKicker })}
              onEn={(heroKicker) => updateEn({ heroKicker })}
              {...sizeProps("heroKicker")}
            />
            <BilingualField
              label={t.title}
              ar={ar.heroTitle}
              en={en.heroTitle}
              onAr={(heroTitle) => updateAr({ heroTitle })}
              onEn={(heroTitle) => updateEn({ heroTitle })}
              {...sizeProps("heroTitle")}
            />
            <BilingualField
              multiline
              label={t.description}
              ar={ar.heroSub}
              en={en.heroSub}
              onAr={(heroSub) => updateAr({ heroSub })}
              onEn={(heroSub) => updateEn({ heroSub })}
              {...sizeProps("heroSub")}
            />
            {mobile ? (
              <MultiImageField
                key="mobile"
                label={t.mobileImage}
                images={ar.heroImagesMobile ?? []}
                max={MAX_HERO_IMAGES}
                portrait
                allowEmpty
                addText={t.addImage}
                countText={t.mobileImagesLeft((ar.heroImagesMobile ?? []).length)}
                fullText={t.imagesFull}
                removeText={t.remove}
                errorText={t.imgError}
                onChange={(heroImagesMobile) => updateBoth({ heroImagesMobile })}
              />
            ) : (
              <MultiImageField
                key="desktop"
                label={t.image}
                images={ar.heroImages}
                max={MAX_HERO_IMAGES}
                addText={t.addImage}
                countText={t.imagesLeft(ar.heroImages.length)}
                fullText={t.imagesFull}
                removeText={t.remove}
                errorText={t.imgError}
                onChange={(heroImages) => updateBoth({ heroImages })}
              />
            )}
            <div>
              <span className="field-label">{t.button}</span>
              <Dropdown
                value={ar.heroCat}
                options={categoryOptions}
                onChange={(heroCat) => updateBoth({ heroCat: heroCat as NavCat })}
              />
              <span className="mt-1 block text-xs text-muted">{t.buttonHint}</span>
            </div>
          </div>
          <div className="lg:sticky lg:top-8 lg:self-start">
            <p className="field-label">{t.preview}</p>
            <div className={cn("pointer-events-none mt-2", !mobile && "border border-line")}>
              <HeroSection content={ar} lang="ar" preview view={heroView} />
            </div>
          </div>
        </div>
        <SectionActions
          dirty={dirty("hero")}
          onSave={() => saveSection("hero")}
          onCancel={() => cancelSection("hero")}
        />
      </section>

      {/* Feature section */}
      <section className="flex flex-col gap-5">
        <SectionTitle>{t.feature}</SectionTitle>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <BilingualField
              label={t.featureKicker}
              ar={ar.featureKicker}
              en={en.featureKicker}
              onAr={(featureKicker) => updateAr({ featureKicker })}
              onEn={(featureKicker) => updateEn({ featureKicker })}
              {...sizeProps("featureKicker")}
            />
            <BilingualField
              label={t.featureTitle}
              ar={ar.featureTitle}
              en={en.featureTitle}
              onAr={(featureTitle) => updateAr({ featureTitle })}
              onEn={(featureTitle) => updateEn({ featureTitle })}
              {...sizeProps("featureTitle")}
            />
            <BilingualField
              multiline
              label={t.featureBody}
              ar={ar.featureBody}
              en={en.featureBody}
              onAr={(featureBody) => updateAr({ featureBody })}
              onEn={(featureBody) => updateEn({ featureBody })}
              {...sizeProps("featureBody")}
            />
            <div>
              <span className="field-label">{t.product}</span>
              <Dropdown
                value={ar.featureProductId}
                options={productOptions}
                onChange={(featureProductId) => updateBoth({ featureProductId })}
              />
              <span className="mt-1 block text-xs text-muted">
                {t.productHint}
                {linked ? ` → ${shopLabel("ar", productCat(linked))}` : ""}
              </span>
            </div>
          </div>
          <div className="lg:sticky lg:top-8 lg:self-start">
            <p className="field-label">{t.preview}</p>
            <div className="pointer-events-none mt-2 border border-line">
              <FeatureSection content={ar} lang="ar" products={products} preview />
            </div>
          </div>
        </div>
        <SectionActions
          dirty={dirty("feature")}
          onSave={() => saveSection("feature")}
          onCancel={() => cancelSection("feature")}
        />
      </section>
    </div>
  );
}

/** Font size stepper: − 100% + (and a reset button when it is not the normal size). */
function SizeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const set = (next: number) => onChange(Math.min(SIZE_MAX, Math.max(SIZE_MIN, next)));
  const btn =
    "inline-flex size-8 shrink-0 items-center justify-center border border-line hover:bg-fg hover:text-bg disabled:opacity-40";
  return (
    <div className="flex items-center gap-1" dir="ltr" title={T.fontSize}>
      <span className="me-2 text-xs text-muted" dir="rtl">
        {T.fontSize}
      </span>
      <button type="button" className={btn} aria-label="−" disabled={value <= SIZE_MIN} onClick={() => set(value - SIZE_STEP)}>
        <Minus className="size-4" />
      </button>
      <span className="w-12 text-center text-sm tabular-nums">{value}%</span>
      <button type="button" className={btn} aria-label="+" disabled={value >= SIZE_MAX} onClick={() => set(value + SIZE_STEP)}>
        <Plus className="size-4" />
      </button>
      <button
        type="button"
        className={cn(btn, value === 100 && "invisible")}
        title={T.fontSizeReset}
        aria-label={T.fontSizeReset}
        onClick={() => set(100)}
      >
        <RotateCcw className="size-4" />
      </button>
    </div>
  );
}

/**
 * One storefront text with two boxes: Arabic on top, English underneath.
 * The square button next to the English box translates the Arabic text into it.
 */
function BilingualField({
  label,
  ar,
  en,
  onAr,
  onEn,
  size = 100,
  onSize,
  multiline = false,
}: {
  label: string;
  ar: string;
  en: string;
  onAr: (value: string) => void;
  onEn: (value: string) => void;
  size?: number;
  onSize?: (value: number) => void;
  multiline?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function translate() {
    if (!ar.trim()) {
      toast(T.translateEmpty);
      return;
    }
    setBusy(true);
    try {
      onEn(await translateArToEn(ar));
    } catch {
      toast(T.translateFail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="field-label !mb-0 !text-fg !text-sm font-bold">{label}</span>
        {onSize ? <SizeControl value={size} onChange={onSize} /> : null}
      </div>
      <div>
        <span className="mb-1 block text-xs text-muted">{T.arBox}</span>
        {multiline ? (
          <textarea className="field min-h-28" dir="rtl" value={ar} onChange={(e) => onAr(e.target.value)} />
        ) : (
          <input className="field" dir="rtl" value={ar} onChange={(e) => onAr(e.target.value)} />
        )}
      </div>
      <div>
        <span className="mb-1 block text-xs text-muted">{T.enBox}</span>
        <div className={cn("flex gap-2", multiline ? "items-start" : "items-stretch")}>
          {multiline ? (
            <textarea
              className="field min-h-28 min-w-0 flex-1"
              dir="ltr"
              value={en}
              onChange={(e) => onEn(e.target.value)}
            />
          ) : (
            <input
              className="field min-w-0 flex-1"
              dir="ltr"
              value={en}
              onChange={(e) => onEn(e.target.value)}
            />
          )}
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center border border-line hover:bg-fg hover:text-bg disabled:opacity-40"
            title={T.translate}
            aria-label={T.translate}
            disabled={busy}
            onClick={() => void translate()}
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Languages className="size-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
      <h2 className="font-display text-xl font-bold tracking-widest uppercase">{children}</h2>
      {action}
    </div>
  );
}

/** Click-to-open list; used for the hero button and the linked product. */
function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const current = options.find((option) => option.value === value) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="field flex items-center justify-between gap-3 text-start"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-line bg-surface"
        >
          {options.map((option) => (
            <li key={option.value || "none"}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  "block w-full px-4 py-3 text-start text-sm hover:bg-fg hover:text-bg",
                  option.value === value && "bg-line",
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Upload box (1..max images) with thumbnails you can remove. */
function MultiImageField({
  label,
  images,
  max,
  addText,
  countText,
  fullText,
  removeText,
  errorText,
  portrait = false,
  allowEmpty = false,
  maxSide = 1600,
  quality = 0.72,
  onChange,
}: {
  label: string;
  images: string[];
  max: number;
  addText: string;
  countText: string;
  fullText: string;
  removeText: string;
  errorText: string;
  portrait?: boolean;
  allowEmpty?: boolean;
  maxSide?: number;
  quality?: number;
  onChange: (images: string[]) => void;
}) {
  const full = images.length >= max;

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = max - images.length;
    const picked = Array.from(files).slice(0, room);
    try {
      const urls = await Promise.all(picked.map((file) => fileToJpegDataUrl(file, maxSide, quality)));
      onChange([...images, ...(await uploadOrKeep(urls, "site"))]);
    } catch (error) {
      toast(error instanceof Error ? error.message : errorText);
    }
  }

  return (
    <div>
      <span className="field-label">{label}</span>
      {images.length ? (
        <ul className="mb-3 grid grid-cols-3 gap-3">
          {images.map((src, index) => (
            <li key={`${index}-${src.slice(-20)}`} className={cn("relative border border-line bg-surface", portrait ? "aspect-[9/16]" : "aspect-video")}>
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={removeText}
                title={removeText}
                disabled={!allowEmpty && images.length <= 1}
                className="absolute end-1 top-1 inline-flex size-6 items-center justify-center bg-bg/80 text-fg hover:bg-fg hover:text-bg disabled:opacity-30"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label
        className={cn(
          "flex min-h-24 flex-col items-center justify-center gap-2 border border-dashed border-line px-4 py-5 text-center text-sm text-muted transition-colors",
          full ? "opacity-50" : "cursor-pointer hover:border-fg hover:text-fg",
        )}
      >
        <Plus className="size-5" />
        <span>{full ? fullText : addText}</span>
        <input
          type="file"
          multiple
          disabled={full}
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <span className="mt-1 block text-xs text-muted">{countText}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="field" value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const PRODUCT_MAX_IMAGES = 3;
const SIZE_LABEL_AR = (size: string) => `مقاس ${size}`;

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A new, empty product for the "add" form. */
function newDraft(): Product {
  return {
    ...blankProduct(),
    name: "",
    price: 0,
    cost: null,
    description: "",
    details: [],
    images: [],
    colors: [{ id: crypto.randomUUID().slice(0, 8), name: "", hex: "#1a1a1a" }],
    tags: ["new"],
  };
}

const ROUND_FIELD = "field rounded-xl";

function ProductsTab() {
  const products = useOwl((state) => state.products);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  // after logging in, the list is refreshed from the database
  useEffect(() => {
    void refreshProducts();
  }, []);

  // Products saved before auto-translation existed get their English filled in automatically.
  useEffect(() => {
    void ensureAllEnglish();
  }, [products.length]);

  const resetForm = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-8">
      <div ref={formRef} className="scroll-mt-6">
        <ProductForm key={`${editing?.id ?? "new"}-${formKey}`} initial={editing} onDone={resetForm} />
      </div>
      <InventoryList
        products={products}
        onEdit={(product) => {
          setEditing(product);
          setFormKey((k) => k + 1);
          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onRemoved={(id) => {
          if (editing?.id === id) resetForm();
        }}
      />
    </div>
  );
}

const MAX_MEDIA = 5;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
const QTY_ROWS: Size[][] = [
  ["XS", "S", "M"],
  ["L", "XL", "XXL"],
];

type MediaItem = { kind: "image" | "video"; src: string };

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذّرت قراءة الملف."));
    reader.readAsDataURL(file);
  });
}

/** Dominant colour of an image (ignores near-white backgrounds), as #rrggbb. */
async function dominantColor(src: string): Promise<string> {
  const img = new Image();
  if (!src.startsWith("data:")) img.crossOrigin = "anonymous"; // Storage links
  img.src = src;
  await img.decode();
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#1a1a1a";
  // Look mostly at the centre, where the garment usually is.
  const crop = 0.6;
  const sw = img.naturalWidth * crop;
  const sh = img.naturalHeight * crop;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    if (r > 238 && g > 238 && b > 238) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    cur.n += 1;
    cur.r += r;
    cur.g += g;
    cur.b += b;
    buckets.set(key, cur);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket;
  if (!best) return "#f4f1ea";
  const hex = (v: number) => Math.round(v / best!.n).toString(16).padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

const BOX = "rounded-2xl border border-fg/20 p-5";
const LABEL = "mb-2 block text-sm font-bold";

/** Manual English edit wins; untouched English survives only while its Arabic source is unchanged. */
function keepEn(current: string | undefined, previous: string | undefined, sourceSame: boolean) {
  if (current !== previous) return current?.trim() || undefined;
  return sourceSame ? previous : undefined;
}

/** Rounded card at the top: add a new product (or edit one from the list below). */
function ProductForm({ initial, onDone }: { initial: Product | null; onDone: () => void }) {
  const addProduct = useOwl((state) => state.addProduct);
  const updateProduct = useOwl((state) => state.updateProduct);
  const [draft, setDraft] = useState<Product>(() => (initial ? { ...initial } : newDraft()));
  // Selling price is what the customer normally pays; the offer price (if any) replaces it.
  const onOffer = initial?.compareAt != null && initial.compareAt > initial.price;
  const [price, setPrice] = useState(initial ? String(onOffer ? initial.compareAt : initial.price) : "");
  const [offer, setOffer] = useState(initial && onOffer ? String(initial.price) : "");
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : "");
  // Stock per colour and size, kept as text while typing: { [colorId]: { XS: "2", S: "4", … } }.
  const [qty, setQty] = useState<Record<string, Partial<Record<Size, string>>>>(() => {
    const out: Record<string, Partial<Record<Size, string>>> = {};
    if (!initial) return out;
    initial.colors.forEach((color, index) => {
      const saved = initial.colorStock?.[color.id];
      out[color.id] = Object.fromEntries(
        SIZES.map((size) => [
          size,
          // Old product (no per-colour stock yet): the whole stock is put on the first colour, to be split by hand.
          String(saved ? saved[size] ?? 0 : index === 0 ? initial.stock[size] ?? 0 : 0),
        ]),
      );
    });
    return out;
  });
  const [media, setMedia] = useState<MediaItem[]>(() => [
    ...(initial?.images ?? []).map((src) => ({ kind: "image" as const, src })),
    ...(initial?.video ? [{ kind: "video" as const, src: initial.video }] : []),
  ]);
  const patch = (next: Partial<Product>) => setDraft((d) => ({ ...d, ...next }));
  // Colour being picked from its image (index into draft.colors), and colours whose hex must not be auto-overwritten:
  // the ones picked by hand with the pin, and the ones already saved on an existing product.
  const [pickingColor, setPickingColor] = useState<number | null>(null);
  const lockedHex = useRef<Set<string>>(new Set((initial?.colors ?? []).map((c) => c.id)));
  const [translating, setTranslating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fillEn(key: string, source: string, apply: (en: string) => void) {
    if (!source.trim()) {
      toast(T.translateEmpty);
      return;
    }
    setTranslating(key);
    try {
      apply(await translateArToEn(source));
    } catch {
      toast(T.translateFail);
    } finally {
      setTranslating(null);
    }
  }

  const imageSrcs = media.filter((m) => m.kind === "image").map((m) => m.src);
  const imageSig = imageSrcs.map((src) => `${src.length}:${src.slice(-24)}`).join("|");

  // Colour number N follows image number N: read each colour straight from its picture.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const hexes = await Promise.all(
        imageSrcs.map((src) => dominantColor(src).catch(() => null)),
      );
      if (cancelled) return;
      setDraft((d) => {
        let changed = false;
        const colors = d.colors.map((color, i) => {
          const hex = hexes[i];
          if (hex && hex !== color.hex && !lockedHex.current.has(color.id)) {
            changed = true;
            return { ...color, hex };
          }
          return color;
        });
        return changed ? { ...d, colors } : d;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSig]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    let list = media;
    for (const file of Array.from(files)) {
      if (list.length >= MAX_MEDIA) {
        toast(`الحد الأقصى ${MAX_MEDIA} صور وفيديوهات.`);
        break;
      }
      try {
        if (file.type.startsWith("video/")) {
          if (list.some((m) => m.kind === "video")) {
            toast("يمكن إضافة فيديو واحد فقط للمنتج.");
            continue;
          }
          if (file.size > MAX_VIDEO_BYTES) {
            toast("حجم الفيديو كبير، الحد الأقصى 8 ميغابايت.");
            continue;
          }
          list = [...list, { kind: "video", src: await fileToDataUrl(file) }];
        } else {
          list = [...list, { kind: "image", src: await fileToJpegDataUrl(file, 1200, 0.7) }];
        }
      } catch (error) {
        toast(error instanceof Error ? error.message : "تعذّرت قراءة الملف.");
      }
    }
    setMedia(list);
  }

  function removeMedia(index: number) {
    const item = media[index];
    setMedia(media.filter((_, i) => i !== index));
    if (item.kind === "image") {
      const imageIndex = media.slice(0, index).filter((m) => m.kind === "image").length;
      if (draft.colors.length > 1 && imageIndex < draft.colors.length) {
        patch({ colors: draft.colors.filter((_, i) => i !== imageIndex) });
      }
    }
  }

  function addColor() {
    if (draft.colors.length >= imageSrcs.length) {
      toast(
        imageSrcs.length
          ? "أضف صورة جديدة للمنتج أولاً، كل لون جديد يأخذ لونه من صورة جديدة."
          : "أضف صور المنتج أولاً.",
      );
      return;
    }
    const src = imageSrcs[draft.colors.length];
    const id = crypto.randomUUID().slice(0, 8);
    patch({ colors: [...draft.colors, { id, name: "", hex: "#f4f1ea" }] });
    void dominantColor(src)
      .then((hex) =>
        setDraft((d) => ({
          ...d,
          colors: d.colors.map((c) => (c.id === id && !lockedHex.current.has(id) ? { ...c, hex } : c)),
        })),
      )
      .catch(() => {});
  }

  async function save() {
    if (saving) return;
    const name = draft.name.trim();
    const sellNum = Number(price);
    if (!name) {
      toast("اكتب اسم المنتج.");
      return;
    }
    if (price.trim() === "" || !Number.isFinite(sellNum) || sellNum < 0) {
      toast("اكتب سعر البيع.");
      return;
    }
    const costNum = cost.trim() === "" ? null : Number(cost);
    if (costNum !== null && (!Number.isFinite(costNum) || costNum < 0)) {
      toast("سعر التكلفة غير صحيح.");
      return;
    }
    const offerNum = offer.trim() === "" ? null : Number(offer);
    if (offerNum !== null && (!Number.isFinite(offerNum) || offerNum < 0 || offerNum >= sellNum)) {
      toast("يجب أن يكون سعر العرض أقل من سعر البيع، أو اتركه فارغاً.");
      return;
    }
    if (!imageSrcs.length) {
      toast("أضف صورة واحدة على الأقل.");
      return;
    }
    const colors = draft.colors
      .slice(0, Math.max(1, imageSrcs.length))
      .map((color, i) => ({ ...color, name: color.name.trim() || `لون ${i + 1}` }));
    // Stock per colour; the size totals (`stock`) are the sum over the colours.
    const stock = Object.fromEntries(SIZES.map((size) => [size, 0])) as Record<Size, number>;
    const colorStock: Record<string, Record<Size, number>> = {};
    for (const color of colors) {
      const row = Object.fromEntries(
        SIZES.map((size) => [size, Math.max(0, Math.floor(Number(qty[color.id]?.[size]) || 0))]),
      ) as Record<Size, number>;
      colorStock[color.id] = row;
      for (const size of SIZES) stock[size] += row[size];
    }
    const next: Product = {
      ...draft,
      name,
      price: offerNum ?? sellNum,
      compareAt: offerNum !== null ? sellNum : null,
      cost: costNum,
      stock,
      colorStock,
      images: imageSrcs,
      video: media.find((m) => m.kind === "video")?.src ?? "",
      colors: colors.map((color) => {
        const old = initial?.colors.find((item) => item.id === color.id);
        return { ...color, nameEn: keepEn(color.nameEn, old?.nameEn, old?.name === color.name) };
      }),
      // English: a manual edit is kept; otherwise it is regenerated when the Arabic text changed
      nameEn: keepEn(draft.nameEn, initial?.nameEn, initial?.name === name),
      descriptionEn: keepEn(
        draft.descriptionEn,
        initial?.descriptionEn,
        initial?.description === draft.description,
      ),
      detailsEn:
        initial && initial.details.join("\n") === draft.details.join("\n")
          ? initial.detailsEn
          : undefined,
    };
    // Pictures/video go to Supabase Storage; only their links are saved with the product.
    let saved: Product = next;
    if (isSupabaseConfigured) {
      setSaving(true);
      try {
        saved = await uploadProductMedia(next);
      } catch (error) {
        setSaving(false);
        toast.error(`تعذّر رفع الصور: ${error instanceof Error ? error.message : "خطأ غير معروف"}`);
        return;
      }
      setSaving(false);
    }
    if (initial) {
      updateProduct(initial.id, saved);
      toast("تم حفظ التعديلات.");
    } else {
      const base = slugify(name);
      saved.slug = base ? `${base}-${draft.id.slice(0, 4)}` : draft.slug;
      addProduct(saved);
      toast("تمت إضافة المنتج.");
    }
    void ensureProductEnglish(saved.id); // Arabic → English in the background
    onDone();
  }

  const toggleTag = (tag: Tag) => {
    const tags = draft.tags.includes(tag)
      ? draft.tags.filter((item) => item !== tag)
      : [...draft.tags, tag];
    if (tags.length) patch({ tags: tags as Tag[] });
  };
  const full = media.length >= MAX_MEDIA;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 md:p-8">
      {/* 1. Title with the green plus on the right */}
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Plus className="size-6 text-emerald-500" />
        {initial ? `تعديل المنتج: ${initial.name}` : "إضافة منتج جديد"}
      </h2>

      {/* 2. Name, cost, selling price, offer price */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={LABEL}>اسم المنتج</span>
          <input
            className={ROUND_FIELD}
            value={draft.name}
            placeholder="مثال: هودي أسود"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </label>
        <label className="block">
          <span className={LABEL}>سعر التكلفة ($)</span>
          <input
            className={ROUND_FIELD}
            type="number"
            min={0}
            inputMode="decimal"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </label>
        <label className="block">
          <span className={LABEL}>سعر البيع ($)</span>
          <input
            className={ROUND_FIELD}
            type="number"
            min={0}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label className="block">
          <span className={LABEL}>سعر العرض ($)</span>
          <input
            className={cn(ROUND_FIELD, "placeholder:text-muted/60")}
            type="number"
            min={0}
            inputMode="decimal"
            value={offer}
            placeholder="إذا لم يكن هناك عرض اتركه فارغاً"
            onChange={(event) => setOffer(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className={LABEL}>اسم المنتج بالإنجليزية (اختياري — يُترجم تلقائياً إذا تركته فارغاً)</span>
          <input
            className={ROUND_FIELD}
            dir="ltr"
            value={draft.nameEn ?? ""}
            placeholder="Product name"
            onChange={(event) => patch({ nameEn: event.target.value })}
          />
        </label>
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line hover:bg-fg hover:text-bg disabled:opacity-40"
          title={T.translate}
          aria-label={T.translate}
          disabled={translating === "name"}
          onClick={() => void fillEn("name", draft.name, (en) => patch({ nameEn: en }))}
        >
          {translating === "name" ? <Loader2 className="size-5 animate-spin" /> : <Languages className="size-5" />}
        </button>
      </div>

      {/* Description */}
      <label className="mt-5 block">
        <span className={LABEL}>وصف المنتج</span>
        <textarea
          className={cn(ROUND_FIELD, "min-h-28 resize-y")}
          value={draft.description}
          placeholder="اكتب وصف المنتج هنا..."
          onChange={(event) => patch({ description: event.target.value })}
        />
      </label>
      <div className="mt-3 flex items-start gap-2">
        <label className="block min-w-0 flex-1">
          <span className={LABEL}>الوصف بالإنجليزية (اختياري)</span>
          <textarea
            className={cn(ROUND_FIELD, "min-h-24 resize-y")}
            dir="ltr"
            value={draft.descriptionEn ?? ""}
            placeholder="Product description"
            onChange={(event) => patch({ descriptionEn: event.target.value })}
          />
        </label>
        <button
          type="button"
          className="mt-8 inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line hover:bg-fg hover:text-bg disabled:opacity-40"
          title={T.translate}
          aria-label={T.translate}
          disabled={translating === "desc"}
          onClick={() => void fillEn("desc", draft.description, (en) => patch({ descriptionEn: en }))}
        >
          {translating === "desc" ? <Loader2 className="size-5 animate-spin" /> : <Languages className="size-5" />}
        </button>
      </div>

      {/* 3. Quantities (right) and categories (left) */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className={BOX}>
          <p className="font-bold text-emerald-500">حدّد الكمية لكل لون ولكل مقاس</p>
          <div className="mt-4 flex flex-col gap-6">
            {draft.colors.map((color, index) => (
              <div key={color.id}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="size-6 shrink-0 rounded-lg border border-fg/60"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-sm font-bold">{color.name.trim() || `لون ${index + 1}`}</span>
                </div>
                <div dir="ltr" className="flex flex-col gap-4">
                  {QTY_ROWS.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-3 gap-3">
                      {row.map((size) => (
                        <label key={size} className="block">
                          <span className="mb-1 block text-center text-sm font-bold">{size}</span>
                          <input
                            className={cn(ROUND_FIELD, "text-center")}
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={qty[color.id]?.[size] ?? ""}
                            onChange={(event) =>
                              setQty((q) => ({
                                ...q,
                                [color.id]: { ...q[color.id], [size]: event.target.value },
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={BOX}>
          <p className="font-bold text-orange-500">القسم (الذي تريد أن يظهر فيه المنتج)</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {TAGS.map((tag) => {
              const on = draft.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "min-h-12 rounded-xl border px-5 font-display text-sm tracking-wide uppercase transition-colors",
                    on
                      ? "border-fg bg-fg text-bg"
                      : "border-line text-muted hover:border-fg hover:text-fg",
                  )}
                >
                  {catLabel("ar", tag)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Media (right) and colours (left) */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className={BOX}>
          <p className="font-bold">صور وفيديوهات المنتج</p>
          {media.length ? (
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
              {media.map((item, index) => (
                <li
                  key={`${index}-${item.src.length}`}
                  className="relative aspect-square overflow-hidden rounded-xl border border-line bg-bg"
                >
                  {item.kind === "video" ? (
                    <video src={item.src} muted playsInline className="h-full w-full object-cover" />
                  ) : (
                    <img src={item.src} alt="" className="h-full w-full object-cover" />
                  )}
                  {index === 0 ? (
                    <span className="absolute start-1 bottom-1 rounded bg-bg/80 px-1.5 py-0.5 text-[11px] font-bold">
                      الرئيسية
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label="حذف"
                    title="حذف"
                    className="absolute end-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-bg/80 text-fg hover:bg-fg hover:text-bg"
                    onClick={() => removeMedia(index)}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label
            className={cn(
              "mt-4 flex min-h-20 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-dashed border-line px-4 py-4 text-center text-sm text-muted transition-colors",
              full ? "opacity-50" : "cursor-pointer hover:border-fg hover:text-fg",
            )}
          >
            <Plus className="size-5" />
            <span>{full ? `وصلت للحد الأقصى — احذف ملفاً لإضافة غيره` : "أضف صور وفيديوهات المنتج من الجهاز"}</span>
            {full ? null : <span>(الحد {MAX_MEDIA} صور و فيديوهات)</span>}
            <input
              type="file"
              multiple
              disabled={full}
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              className="sr-only"
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        <div className={BOX}>
          <p className="font-bold">ألوان المنتج المتوفرة</p>
          <div className="mt-4 flex flex-col gap-3">
            {draft.colors.map((color, index) => (
              <div key={color.id} className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="التقاط لون المنتج من الصورة"
                  title="اضغط لاختيار اللون من الصورة"
                  onClick={() => {
                    if (!imageSrcs.length) {
                      toast("أضف صور المنتج أولاً.");
                      return;
                    }
                    setPickingColor(index);
                  }}
                  className="relative grid size-12 shrink-0 place-items-center rounded-xl border border-fg/60"
                  style={{ backgroundColor: color.hex }}
                >
                  <Pipette className="size-4 text-white mix-blend-difference" aria-hidden />
                </button>
                <input
                  className={ROUND_FIELD}
                  value={color.name}
                  aria-label="اسم اللون"
                  placeholder="اسم اللون"
                  onChange={(event) =>
                    patch({
                      colors: draft.colors.map((item, i) =>
                        i === index ? { ...item, name: event.target.value } : item,
                      ),
                    })
                  }
                />
                <input
                  className={cn(ROUND_FIELD, "max-w-36")}
                  dir="ltr"
                  value={color.nameEn ?? ""}
                  aria-label="Color name (English)"
                  placeholder="English"
                  onChange={(event) =>
                    patch({
                      colors: draft.colors.map((item, i) =>
                        i === index ? { ...item, nameEn: event.target.value } : item,
                      ),
                    })
                  }
                />
                {imageSrcs[index] ? (
                  <img
                    src={imageSrcs[index]}
                    alt=""
                    className="size-12 shrink-0 rounded-xl border border-line object-cover"
                  />
                ) : null}
                <button
                  type="button"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line hover:bg-fg hover:text-bg disabled:opacity-30"
                  aria-label="حذف اللون"
                  disabled={draft.colors.length <= 1}
                  onClick={() => patch({ colors: draft.colors.filter((_, i) => i !== index) })}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <button type="button" className="btn-line self-start rounded-xl" onClick={addColor}>
              <Plus className="size-4" />
              إضافة لون جديد
            </button>
          </div>
          {pickingColor !== null && draft.colors[pickingColor] ? (
            <ColorPinPicker
              images={imageSrcs}
              initialIndex={pickingColor}
              initialHex={draft.colors[pickingColor].hex}
              onClose={() => setPickingColor(null)}
              onConfirm={(hex) => {
                const id = draft.colors[pickingColor].id;
                lockedHex.current.add(id);
                setDraft((d) => ({ ...d, colors: d.colors.map((c) => (c.id === id ? { ...c, hex } : c)) }));
                setPickingColor(null);
              }}
            />
          ) : null}
        </div>
      </div>

      {/* Save */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="btn-solid flex-1 rounded-xl disabled:opacity-60"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {saving ? "جاري رفع الصور..." : initial ? "حفظ التعديلات" : "حفظ المنتج"}
        </button>
        {initial ? (
          <button type="button" className="btn-line rounded-xl sm:px-8" onClick={onDone}>
            إلغاء التعديل
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** The products already on the site, in a table: image, name, prices, stock per size, actions. */
function InventoryList({
  products,
  onEdit,
  onRemoved,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onRemoved: (id: string) => void;
}) {
  const remove = useOwl((state) => state.removeProduct);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const rows = needle ? products.filter((p) => p.name.toLowerCase().includes(needle)) : products;
  const th = "px-3 py-3 text-sm font-bold";

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">قائمة المخزون</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-line rounded-xl disabled:opacity-60"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              let failed = 0;
              let firstMessage = "";
              for (const p of products) {
                try {
                  const uploaded = await uploadProductMedia(p);
                  if (uploaded !== p) {
                    useOwl.getState().updateProduct(p.id, { images: uploaded.images, video: uploaded.video });
                  }
                  const res = await upsertProductToDatabase(uploaded);
                  if (res && !res.ok) {
                    failed += 1;
                    firstMessage = firstMessage || res.message;
                  }
                } catch (error) {
                  failed += 1;
                  firstMessage = firstMessage || (error instanceof Error ? error.message : "خطأ غير معروف");
                }
              }
              setSyncing(false);
              if (failed) {
                toast.error(`فشل حفظ ${failed} من ${products.length} منتج: ${firstMessage}`);
              } else {
                toast("تمت مزامنة الكتالوج مع Supabase");
              }
            }}
          >
            {syncing ? <Loader2 className="size-4 animate-spin" /> : null}
            مزامنة الكل مع Supabase
          </button>
          <label className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              className={cn(ROUND_FIELD, "!ps-9 sm:w-64")}
              value={query}
              placeholder="ابحث في المخزون..."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-center">
          <thead>
            <tr className="bg-fg/5">
              <th className={cn(th, "rounded-s-xl")}>الصورة</th>
              <th className={th}>المنتج</th>
              <th className={th}>سعر التكلفة</th>
              <th className={th}>سعر البيع</th>
              <th className={th}>المخزون حسب المقاس</th>
              <th className={cn(th, "rounded-e-xl")}>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => (
              <tr key={product.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt=""
                      className="mx-auto aspect-square w-14 rounded-xl object-cover"
                    />
                  ) : null}
                </td>
                <td className="px-3 py-3 text-sm font-bold">
                  <span className="inline-flex items-center gap-2">
                    {product.soldOut ? <Lock className="size-4 text-amber-500" /> : null}
                    {product.name}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm tabular-nums text-muted">
                  {product.cost != null ? money(product.cost) : "—"}
                </td>
                <td className="px-3 py-3 text-sm font-bold tabular-nums text-emerald-500">
                  {money(product.price)}
                </td>
                <td className="px-3 py-3">
                  <div dir="ltr" className="flex flex-wrap items-center justify-center gap-1.5">
                    {visibleSizes(product).map((size) => {
                      const n = product.stock[size] ?? 0;
                      const breakdown = product.colorStock
                        ? product.colors
                            .map((color) => `${color.name}: ${product.colorStock?.[color.id]?.[size] ?? 0}`)
                            .join(" · ")
                        : undefined;
                      return (
                        <span
                          key={size}
                          title={breakdown}
                          className={cn(
                            "rounded-md border border-line px-1.5 py-0.5 font-mono text-[12px] tabular-nums",
                            n > 0 ? "text-emerald-500" : "text-red-500",
                          )}
                        >
                          {size}: {n}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-bold text-amber-500 hover:bg-amber-500/20"
                      onClick={() => onEdit(product)}
                    >
                      <Pencil className="size-4" />
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10"
                      aria-label="حذف المنتج"
                      title="حذف المنتج"
                      onClick={() => {
                        if (window.confirm(`حذف ${product.name}؟`)) {
                          remove(product.id);
                          onRemoved(product.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {products.length ? "لا توجد نتائج." : "لا توجد منتجات بعد."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 px-3 font-display text-xs tracking-widest uppercase",
        on ? "bg-fg text-bg" : "border border-line text-muted",
      )}
    >
      {label}
    </button>
  );
}

function toColorInput(hex: string) {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#111111";
}

const STATUS_LABEL = { pending: "قيد الانتظار", confirmed: "مؤكد", fulfilled: "تم التسليم", cancelled: "ملغي" } as const;
const TG_LABEL = { sent: "أُرسل", failed: "فشل", unconfigured: "غير مضبوط" } as const;

// الطلبات الملغاة لا تظهر في أي قسم (الإلغاء نهائي)؛ يُلغى الطلب بزر X الأحمر الموجود على كل طلب.
const ORDER_SECTIONS = ["pending", "confirmed", "fulfilled"] as const;

function OrdersTab() {
  const orders = useOwl((state) => state.orders);
  const setOrderStatus = useOwl((state) => state.setOrderStatus);
  const [shot, setShot] = useState<string | null>(null);
  const [section, setSection] = useState<(typeof ORDER_SECTIONS)[number]>("pending");

  async function setStatus(ref: string, status: Order["status"]) {
    const current = orders.find((order) => order.ref === ref);
    if (!current || current.status === status) return;
    if (current.status === "cancelled") return toast.error("الطلب الملغى لا يمكن إعادته. أنشئ طلبًا جديدًا.");
    if (
      status === "cancelled" &&
      !window.confirm("إلغاء الطلب؟ سيُعاد المخزون ويُرجَع استخدام الكود كأنه لم يُستخدم. الإلغاء نهائي.")
    ) {
      return;
    }
    const res = await setOrderStatus(ref, status);
    if (!res.ok) return toast.error(res.message || "تعذّر تغيير الحالة.");
    if (status === "cancelled") {
      // The database gave the stock back: pull it, so the next product edit does not overwrite it with an old number.
      await refreshProducts().catch(() => {});
      toast("تم إلغاء الطلب وإرجاع المخزون.");
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void fetchOrdersFromDatabase().then((rows) => {
      if (rows) useOwl.setState({ orders: rows });
      else toast.error("تعذّر جلب الطلبات من قاعدة البيانات. تحقق من الاتصال أو أعد تسجيل الدخول.");
    });
  }, []);

  if (!orders.length) {
    return <p className="text-muted">لا توجد طلبات بعد.</p>;
  }

  const shown = orders.filter((order) => order.status === section);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {ORDER_SECTIONS.map((status) => {
          const count = orders.filter((order) => order.status === status).length;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setSection(status)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 px-3 font-display text-xs tracking-widest uppercase",
                section === status ? "bg-fg text-bg" : "border border-line text-muted",
              )}
            >
              <span>{STATUS_LABEL[status]}</span>
              <span className="text-lg tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? <p className="py-6 text-muted">لا توجد طلبات في هذا القسم.</p> : null}
      {shown.map((order) => (
        <OrderCard key={order.ref} order={order} onStatus={setStatus} onShot={setShot} />
      ))}
      {shot ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6"
          onClick={() => setShot(null)}
        >
          <img src={shot} alt="الإيصال" className="max-h-full max-w-full object-contain" />
        </button>
      ) : null}
    </div>
  );
}

function OrderCard({
  order,
  onStatus,
  onShot,
}: {
  order: Order;
  onStatus: (ref: string, status: Order["status"]) => void | Promise<void>;
  onShot: (src: string) => void;
}) {
  return (
    <article className="relative border border-line p-4 pl-16">
      <button
        type="button"
        onClick={() => onStatus(order.ref, "cancelled")}
        title="إلغاء الطلب"
        aria-label="إلغاء الطلب"
        className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center text-red-500 hover:bg-red-500/10"
      >
        <X className="size-6" strokeWidth={2.5} />
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg tracking-widest">{order.ref}</p>
          <p className="text-sm text-muted">{new Date(order.createdAt).toLocaleString("ar")}</p>
        </div>
        <p className="tabular-nums">{money(order.total)}</p>
      </div>
      <p className="mt-3 text-sm">
        {order.customer.name} · {order.customer.phone}
      </p>
      <p className="text-sm text-muted">
        {order.customer.city} — {order.customer.address}
      </p>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {order.items.map((item, index) => (
          <li key={`${item.productId}-${index}`}>
            {item.name} · {item.size} · {item.fit} · {item.color} · ×{item.qty}
          </li>
        ))}
      </ul>
      {order.discount && order.discount > 0 ? (
        <p className="mt-3 text-sm">
          كود الخصم: <span className="font-display tracking-widest">{order.coupon}</span> · −{money(order.discount)}
        </p>
      ) : null}
      <p className="mt-3 text-xs tracking-widest text-muted uppercase">
        {order.payment === "Sham Cash" ? "شام كاش" : order.payment} · تيليغرام: {TG_LABEL[order.telegram]} · {order.shipping.label}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {ORDER_SECTIONS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onStatus(order.ref, status)}
            className={cn(
              "min-h-11 px-3 font-display text-xs tracking-widest uppercase",
              order.status === status ? "bg-fg text-bg" : "border border-line text-muted",
            )}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
        {order.receiptDataUrl ? (
          <button type="button" className="btn-line" onClick={() => onShot(order.receiptDataUrl)}>
            الإيصال
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PaymentsSection() {
  const settings = useOwl((state) => state.settings);
  const update = useOwl((state) => state.updateSettings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pickQr(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const data = await fileToJpegDataUrl(file, 1000, 0.92);
      const [url] = await uploadOrKeep([data], "payments");
      update({ shamCashQr: url });
      toast("تم حفظ صورة الـ QR.");
    } catch {
      toast.error("تعذّرت قراءة الصورة. استخدم صورة JPG أو PNG.");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="grid max-w-xl gap-4">
      <Field label="اسم حساب شام كاش" value={settings.shamCashName} onChange={(shamCashName) => update({ shamCashName })} />
      <Field label="رقم حساب شام كاش" value={settings.shamCashId} onChange={(shamCashId) => update({ shamCashId })} />
      <div>
        <span className="field-label">رمز (QR Code) شام كاش</span>
        <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-line p-4">
          {settings.shamCashQr ? (
            <img
              src={settings.shamCashQr}
              alt="QR شام كاش"
              className="size-28 shrink-0 rounded-xl border border-line bg-white object-contain"
            />
          ) : (
            <div className="flex size-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-line px-2 text-center text-xs text-muted">
              لا توجد صورة
            </div>
          )}
          <div className="flex flex-col items-start gap-2">
            <button type="button" className="btn-line" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {settings.shamCashQr ? "تغيير الصورة" : "إضافة صورة من الجهاز"}
            </button>
            {settings.shamCashQr ? (
              <button type="button" className="btn-line" onClick={() => update({ shamCashQr: "" })}>
                <Trash2 className="size-4" />
                حذف الصورة
              </button>
            ) : null}
            <span className="text-xs text-muted">
              تظهر للزبون في صفحة الدفع. وإذا لم تضف صورة فسيظهر رمز تلقائي من رقم الحساب.
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => void pickQr(event.target.files?.[0])}
          />
        </div>
      </div>
      {isSupabaseConfigured ? null : (
        <>
          <Field
            label="توكن بوت تيليغرام"
            value={settings.telegramBotToken}
            onChange={(telegramBotToken) => update({ telegramBotToken })}
            hint="من @BotFather. يُستخدم فقط عند وصول طلب. أو عيّن المتغير TELEGRAM_BOT_TOKEN على الخادم."
          />
          <Field
            label="معرّف محادثة تيليغرام"
            value={settings.telegramChatId}
            onChange={(telegramChatId) => update({ telegramChatId })}
            hint="رقم حسابك أو رقم مجموعة مثل ‎-100…‎. أو عيّن المتغير TELEGRAM_CHAT_ID على الخادم."
          />
        </>
      )}
    </div>
  );
}
