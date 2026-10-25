import { CITY_AR } from "@/lib/i18n/content";

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;
export type Size = (typeof SIZES)[number];

export const FITS = ["Oversize", "Boxy Fit", "Regular Fit"] as const;
export type Fit = (typeof FITS)[number];

export const TAGS = ["new", "bestsellers", "shirts", "hoodies", "tees", "jackets", "pants", "shorts", "sets"] as const;
export type Tag = (typeof TAGS)[number];

export const CATS = ["all", "new", "bestsellers", "shirts", "hoodies", "tees", "jackets", "pants", "shorts", "sets", "sale"] as const;
export type Cat = (typeof CATS)[number];

export type ProductColor = {
  id: string;
  name: string; // as typed in the admin (Arabic)
  nameEn?: string; // filled automatically (Arabic → English)
  nameAr?: string;
  hex: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string; // as typed in the admin (Arabic)
  nameEn?: string; // filled automatically (Arabic → English)
  nameAr?: string;
  price: number;
  cost?: number | null; // what the piece costs you (admin only, never shown to customers)
  compareAt: number | null;
  tags: Tag[];
  description: string;
  descriptionEn?: string;
  descriptionAr?: string;
  details: string[];
  detailsEn?: string[];
  detailsAr?: string[];
  images: string[];
  video: string;
  colors: ProductColor[];
  fits: Fit[];
  /** Total per size (sum over all colours). Kept in sync with `colorStock`; old code and old products read this. */
  stock: Record<Size, number>;
  /** Stock per colour and size: { [colorId]: { XS: 2, S: 4, … } }. Missing on old products → `stock` is used. */
  colorStock?: Record<string, Record<Size, number>>;
  soldOut: boolean;
  secret?: boolean; // true → only shown inside the locked "secret section"
};

export type CartLine = {
  productId: string;
  size: Size;
  fit: Fit;
  colorId: string;
  qty: number;
};

export type Lang = "en" | "ar";

export type NavCat = Exclude<Cat, "all">;

/** Texts on the storefront whose font size the admin can change. */
export type TextKey =
  | "heroKicker"
  | "heroTitle"
  | "heroSub"
  | "featureKicker"
  | "featureTitle"
  | "featureBody";

/** Font size is a percentage of the normal size (100 = unchanged). */
export const SIZE_MIN = 50;
export const SIZE_MAX = 300;
export const SIZE_STEP = 10;

/** Everything the admin can edit on the storefront, stored once per language. */
export type SiteContent = {
  sizes?: Partial<Record<TextKey, number>>; // font size per text, in % (missing = 100)
  announcement: string;
  heroKicker: string;
  heroTitle: string;
  heroSub: string;
  heroImages: string[]; // 1–3 images (laptop / landscape)
  heroImagesMobile: string[]; // 0–3 portrait images for phones (empty → laptop images are used)
  heroCat: NavCat; // where the hero button goes ("Shop <category>")
  featureKicker: string;
  featureTitle: string;
  featureBody: string;
  featureProductId: string; // linked product — drives the image and button
};

export const MAX_HERO_IMAGES = 3;

export type Settings = {
  content: Record<Lang, SiteContent>;
  shamCashId: string;
  shamCashName: string;
  shamCashQr: string; // uploaded picture of the Sham Cash QR code ("" → a generated one is shown)
  telegramBotToken: string;
  telegramChatId: string;
  adminPin: string;
  secretCode: string; // code that opens the secret section (local/demo mode)
};

export type OrderItem = {
  productId: string;
  colorId?: string;
  name: string;
  size: Size;
  fit: Fit;
  color: string;
  qty: number;
  unitPrice: number;
};

export type Order = {
  ref: string;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    city: string;
    address: string;
  };
  shipping: { id: string; label: string; fee: number; companyId?: string };
  /** Only used to build the Telegram message (the database keeps the joined `customer.address`). */
  addressParts?: { area: string; detail: string; pickup: boolean };
  /** What the customer was told about delivery (shown on the order page). */
  delivery?: { pickup: boolean; office: string; etaAr: string; etaEn: string; companyAr: string; companyEn: string };
  items: OrderItem[];
  subtotal: number;
  discount?: number; // coupon discount on the items (shipping is never discounted)
  coupon?: string | null; // coupon code used on this order
  total: number;
  payment: "Sham Cash";
  receiptDataUrl: string;
  telegram: "sent" | "failed" | "unconfigured";
  status: "pending" | "confirmed" | "fulfilled" | "cancelled"; // cancelled = final: stock and coupon use are given back
};

export const CITIES = [
  "Damascus",
  "Rural Damascus",
  "Aleppo",
  "Homs",
  "Hama",
  "Latakia",
  "Tartus",
  "Idlib",
  "Daraa",
  "As-Suwayda",
  "Quneitra",
  "Deir ez-Zor",
  "Raqqa",
  "Al-Hasakah",
] as const;

/** A governorate a shipping company delivers to (with its own delivery time and pick-up / delivery areas). */
export type CompanyZone = {
  city: string; // English governorate name, same list as CITIES
  areas: string; // areas separated by «،» (home delivery) or the office address (pick-up)
  etaAr: string;
  etaEn: string;
};

/** A shipping company (Sila, Al-Rafidain…). Flat fee, covers some governorates. The customer picks one at checkout. */
export type ShippingCompany = {
  id: string;
  nameAr: string;
  nameEn: string;
  fee: number;
  deliveryAr: string; // e.g. "إلى باب المنزل" / "الاستلام من مكتب الشركة"
  deliveryEn: string;
  pickup: boolean; // true = the customer collects from the company office (no detailed address; the zone's text is the office address)
  enabled: boolean;
  sortOrder: number;
  zones: CompanyZone[];
};

const SILA_ETA = { etaAr: "5–10 أيام", etaEn: "5–10 days" };
const sila = (city: string, areas: string): CompanyZone => ({ city, areas, ...SILA_ETA });
const DAMASCUS_AREAS = "الزبداني، القطيفة، برزة، يبرود، الزبلطاني، أشرفية صحنايا";

/** Used in demo mode (no Supabase). Same data the SQL file seeds. */
export const DEFAULT_SHIPPING_COMPANIES: ShippingCompany[] = [
  {
    id: "sila",
    nameAr: "صلة",
    nameEn: "Sila",
    fee: 4,
    deliveryAr: "إلى باب المنزل",
    deliveryEn: "Home delivery",
    pickup: false,
    enabled: true,
    sortOrder: 1,
    zones: [
      sila("Damascus", DAMASCUS_AREAS),
      sila("Rural Damascus", DAMASCUS_AREAS),
      sila("Deir ez-Zor", "البوكمال، الميادين، مركزي"),
      sila("Tartus", "حديقة الملجأ، بانياس، دريكيش"),
      sila("Aleppo", "منبج، مركزي - الأعظمية، اعزاز، الأتارب، الباب، دوار الموت"),
      sila("Hama", "البارودية، السقيلبية، سلمية، مصياف"),
      sila("Homs", "كرم اللوز، الحولة، الرستن، تل كلخ"),
      sila("Daraa", "المجمع الحكومي، انخل"),
      sila("Idlib", "المتنبي، أريحا، البارة، حارم، خان شيخون، سراقب، سرمدا، معرة النعمان"),
      sila("Al-Hasakah", "الكلاسة، مركزي - دوار التفاحة"),
      sila("Raqqa", "سوق الهال القديم، سلوك"),
      sila("Latakia", "المشروع السابع، جبلة"),
    ],
  },
  {
    id: "rafidain",
    nameAr: "الرافدين",
    nameEn: "Al-Rafidain",
    fee: 2,
    deliveryAr: "الاستلام من مكتب الشركة",
    deliveryEn: "Pick-up from the company office",
    pickup: true,
    enabled: true,
    sortOrder: 2,
    zones: [
      { city: "Damascus", areas: "جسر فيكتوريا خلف البريد القديم", etaAr: "2–3 أيام", etaEn: "2–3 days" },
      { city: "Aleppo", areas: "السليمانية خلف زجاج غريبه", etaAr: "يومين", etaEn: "2 days" },
      { city: "Homs", areas: "الكراج الشمالي", etaAr: "2–3 أيام", etaEn: "2–3 days" },
    ],
  },
];

/** A discount code (the customer never reads this table; the database validates it). */
export type Coupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrder: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: string | null; // ISO
  endsAt: string | null; // ISO
  active: boolean;
};


export const NAV: { label: string; cat: Exclude<Cat, "all"> }[] = [
  { label: "New Drops", cat: "new" },
  { label: "Best Sellers", cat: "bestsellers" },
  { label: "Shirts", cat: "shirts" },
  { label: "Blouses", cat: "hoodies" },
  { label: "T-Shirt", cat: "tees" },
  { label: "Jackets", cat: "jackets" },
  { label: "Pants", cat: "pants" },
  { label: "Shorts", cat: "shorts" },
  { label: "Sets", cat: "sets" },
];

export const CAT_LABEL: Record<Cat, string> = {
  all: "All products",
  new: "New drops",
  bestsellers: "Best sellers",
  shirts: "Shirts",
  hoodies: "Blouses",
  tees: "T-Shirt",
  jackets: "Jackets",
  pants: "Pants",
  shorts: "Shorts",
  sets: "Sets",
  sale: "Sale",
};

const stock = (patch: Partial<Record<Size, number>> = {}): Record<Size, number> => ({
  XS: patch.XS ?? 6,
  S: patch.S ?? 10,
  M: patch.M ?? 12,
  L: patch.L ?? 10,
  XL: patch.XL ?? 6,
  XXL: patch.XXL ?? 4,
  "3XL": patch["3XL"] ?? 0,
});

export const defaultContent: Record<Lang, SiteContent> = {
  en: {
    announcement:
      "SHIPPING ACROSS SYRIA  ·  SHAM CASH PAYMENT AVAILABLE  ·  SEASON 04 IS LIVE",
    heroKicker: "Season collection",
    heroTitle: "New Drop",
    heroSub: "Heavyweight hoodies, tees, and sets. Cut oversize. Paid with Sham Cash.",
    heroImages: ["/media/hero.jpg"],
    heroImagesMobile: [],
    heroCat: "new",
    featureKicker: "The cut",
    featureTitle: "Built heavy. Worn after dark.",
    featureBody:
      "Fleece with a dense hand, shoulders dropped, owl kept tonal. Sets are cut as one silhouette — hoodie and trouser, nothing extra.",
    featureProductId: "crest-noir",
  },
  ar: {
    announcement: "شحن لكل المحافظات السورية  ·  الدفع عبر شام كاش متاح  ·  الموسم 04 متوفر الآن",
    heroKicker: "مجموعة الموسم",
    heroTitle: "الإصدار الجديد",
    heroSub: "هوديات وتيشيرتات وأطقم ثقيلة الوزن. قصّة واسعة. الدفع عبر شام كاش.",
    heroImages: ["/media/hero.jpg"],
    heroImagesMobile: [],
    heroCat: "new",
    featureKicker: "القصّة",
    featureTitle: "صُنعت ثقيلة. تُلبس بعد الظلام.",
    featureBody:
      "قماش فليس كثيف الملمس، أكتاف مائلة، والبومة بنفس اللون. الأطقم مقصوصة كقطعة واحدة — هودي وبنطلون، بلا زيادة.",
    featureProductId: "crest-noir",
  },
};

export const defaultSettings: Settings = {
  content: defaultContent,
  shamCashId: "OWL-SC-448291",
  shamCashName: "OWL STORE",
  shamCashQr: "",
  telegramBotToken: "",
  telegramChatId: "",
  adminPin: "OWL-2026",
  secretCode: "1234",
};

/** Products shown to everyone (the secret-section ones are left out). */
export const publicProducts = (list: Product[]) => list.filter((product) => !product.secret);

export const seedProducts: Product[] = [
  {
    id: "night-archive",
    slug: "night-archive-hoodie",
    name: "Night Archive Hoodie",
    price: 148,
    compareAt: 178,
    tags: ["new", "hoodies"],
    description:
      "Heavyweight fleece, dropped shoulder, double-lined hood. The night uniform — tonal owl, cut oversize.",
    details: [
      "480gsm heavyweight fleece",
      "Dropped shoulder, double-lined hood",
      "Tone-on-tone owl embroidery",
      "Kangaroo pocket, rib cuffs",
    ],
    images: ["/media/night-1.jpg", "/media/night-2.jpg"],
    video: "/media/night-walk.mp4",
    colors: [{ id: "night", name: "Night", hex: "#161616" }],
    fits: ["Oversize", "Boxy Fit"],
    stock: stock({ XS: 2, XXL: 0 }),
    soldOut: false,
  },
  {
    id: "bone-structure",
    slug: "bone-structure-hoodie",
    name: "Bone Structure Hoodie",
    price: 154,
    compareAt: null,
    tags: ["new", "hoodies"],
    description:
      "Boxy bone fleece with a dense hand-feel. The light piece in a dark wardrobe.",
    details: [
      "480gsm brushed fleece",
      "Boxy body, shorter hem",
      "Charcoal owl embroidery",
      "Rib hem and cuffs",
    ],
    images: ["/media/bone-1.jpg", "/media/bone-2.jpg"],
    video: "",
    colors: [{ id: "bone", name: "Bone", hex: "#e7e0d2" }],
    fits: ["Boxy Fit"],
    stock: stock({ XS: 4, XXL: 2 }),
    soldOut: false,
  },
  {
    id: "smoke-column",
    slug: "smoke-column-tee",
    name: "Smoke Column Tee",
    price: 64,
    compareAt: 78,
    tags: ["tees"],
    description: "320gsm boxy tee. Smoke grey, dropped shoulder, owl at the chest.",
    details: ["320gsm jersey", "Boxy, dropped shoulder", "Owl embroidery", "Pre-shrunk"],
    images: ["/media/smoke-1.jpg", "/media/smoke-2.jpg"],
    video: "",
    colors: [{ id: "smoke", name: "Smoke", hex: "#8d8d90" }],
    fits: ["Boxy Fit", "Regular Fit"],
    stock: stock({ XS: 0, XXL: 1 }),
    soldOut: false,
  },
  {
    id: "ink-standard",
    slug: "ink-standard-tee",
    name: "Ink Standard Tee",
    price: 68,
    compareAt: null,
    tags: ["tees"],
    description:
      "The regular-fit essential. Ink black, heavy jersey — currently gone.",
    details: ["Heavy jersey", "Regular fit", "Tonal owl", "Crew neck"],
    images: ["/media/ink-1.jpg", "/media/ink-2.jpg"],
    video: "",
    colors: [{ id: "ink", name: "Ink", hex: "#111111" }],
    fits: ["Regular Fit"],
    stock: stock({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 }),
    soldOut: true,
  },
  {
    id: "crest-noir",
    slug: "crest-noir-set",
    name: "Crest Noir Set",
    price: 220,
    compareAt: null,
    tags: ["new", "sets"],
    description:
      "Hoodie and trouser, cut as one silhouette. Oversize through the shoulder, straight through the leg.",
    details: [
      "Matching hoodie and trouser",
      "Oversize shoulder, straight leg",
      "Tonal owl on the chest",
      "Sold as a set",
    ],
    images: ["/media/crest-1.jpg", "/media/night-2.jpg"],
    video: "",
    colors: [{ id: "night", name: "Night", hex: "#141414" }],
    fits: ["Oversize"],
    stock: stock({ XS: 0, XXL: 2 }),
    soldOut: false,
  },
];

export const CATALOG_VERSION = 1;

export function cloneSeed(): Product[] {
  return seedProducts.map((product) => ({
    ...product,
    colors: product.colors.map((color) => ({ ...color })),
    fits: [...product.fits],
    tags: [...product.tags],
    images: [...product.images],
    details: [...product.details],
    stock: { ...product.stock },
  }));
}

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function isSoldOut(product: Product) {
  if (product.soldOut) return true;
  return SIZES.every((size) => (product.stock[size] ?? 0) <= 0);
}

/** Sizes shown to customers: the standard ones, plus 3XL only when it is in stock. */
export function visibleSizes(product: Product, colorId?: string | null): readonly Size[] {
  const byColor = colorId ? product.colorStock?.[colorId] : undefined;
  const source = byColor ?? product.stock;
  return SIZES.filter((size) => size !== "3XL" || (source[size] ?? 0) > 0);
}

/** Pieces left of a size. Pass the colour to get that colour's stock (falls back to the size total on old products). */
export function sizeLeft(product: Product, size: Size, colorId?: string) {
  if (product.soldOut) return 0;
  const byColor = colorId ? product.colorStock?.[colorId] : undefined;
  if (byColor) return Math.max(0, byColor[size] ?? 0);
  return Math.max(0, product.stock[size] ?? 0);
}

/** Does this product track stock per colour? */
export function hasColorStock(product: Product) {
  return Boolean(product.colorStock && Object.keys(product.colorStock).length);
}

export function matchesCat(product: Product, cat: Cat) {
  if (cat === "all") return true;
  if (cat === "sale") return product.compareAt != null && product.compareAt > product.price;
  return product.tags.includes(cat);
}

export function isCat(value: unknown): value is Cat {
  return typeof value === "string" && (CATS as readonly string[]).includes(value);
}

export function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "piece";
}

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → 0-9, so phone numbers typed on an Arabic keyboard pass validation. */
export function normalizeDigits(value: string) {
  return value
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

export function makeRef() {
  const n = Math.floor(1000 + Math.random() * 9000);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letter = alphabet[Math.floor(Math.random() * alphabet.length)];
  return `OWL-${n}${letter}`;
}

/** 70, 4.5 … (no currency sign, no trailing zeros) for the invoice line in the Telegram message. */
const plainNumber = (value: number) => String(Number(value.toFixed(2)));

/**
 * The order message the store owner receives on Telegram (Arabic, one fact per line):
 * name · phone · governorate (detailed address) · product · colour · size · invoice value · invoice number.
 * An order with several pieces repeats the product / colour / size lines for each piece.
 */
export function formatOrderText(order: Order) {
  const city = CITY_AR[order.customer.city] ?? order.customer.city;
  const parts = order.addressParts;
  const detail = (parts ? parts.detail : order.customer.address).replace(/\s*\n+\s*/g, "، ").trim();
  // Sila (home delivery): "المحافظة - المنطقة (العنوان التفصيلي)". Al-Rafidain (office pick-up): no brackets.
  const addressLine = parts
    ? `${city}${parts.area ? ` - ${parts.area}` : ""}${!parts.pickup && detail ? ` (${detail})` : ""}`
    : `${city}${detail ? ` (${detail})` : ""}`;
  const pieces = order.items.map((item) =>
    [
      `المنتج: ${item.name}${item.qty > 1 ? ` × ${item.qty}` : ""}`,
      `اللون: ${item.color}`,
      `القياس: ${item.size}`,
    ].join("\n"),
  );
  // products + (shipping) = total, e.g. "70 + (4) = 74"; a coupon discount is shown as "70 − 5 + (4) = 69".
  const invoice =
    plainNumber(order.subtotal) +
    (order.discount && order.discount > 0 ? ` − ${plainNumber(order.discount)}` : "") +
    ` + (${plainNumber(order.shipping.fee)}) = ${plainNumber(order.total)}`;
  return [
    `الاسم: ${order.customer.name}`,
    `الهاتف: ${order.customer.phone}`,
    `العنوان: ${addressLine}`,
    pieces.join("\n\n"),
    `قيمة الفاتورة: ${invoice}`,
    ...(order.shipping.companyId ? [`شركة الشحن: ${order.shipping.label}`] : []),
    `رقم الفاتورة: ${order.ref}`,
  ].join("\n");
}

export function blankProduct(): Product {
  const id = crypto.randomUUID();
  return {
    id,
    slug: `new-piece-${id.slice(0, 4)}`,
    name: "New piece",
    price: 80,
    compareAt: null,
    tags: ["new"],
    description: "Describe the cut, the hand, and how it sits.",
    details: ["Heavyweight cotton", "Tonal owl embroidery"],
    images: ["/media/night-1.jpg", "/media/night-2.jpg"],
    video: "",
    colors: [{ id: "night", name: "Night", hex: "#1a1a1a" }],
    fits: ["Oversize"],
    stock: stock(),
    soldOut: false,
  };
}

// ---------- Language helpers ----------

export const NAV_LABEL: Record<Lang, Record<NavCat, string>> = {
  en: {
    new: "New Drops",
    bestsellers: "Best Sellers",
    shirts: "Shirts",
    hoodies: "Blouses",
    tees: "T-Shirt",
    jackets: "Jackets",
    pants: "Pants",
    shorts: "Shorts",
    sets: "Sets",
    sale: "Sale",
  },
  ar: {
    new: "الجديد",
    bestsellers: "الأكثر مبيعاً",
    shirts: "قمصان",
    hoodies: "بلوزات",
    tees: "T-Shirt",
    jackets: "جواكيت",
    pants: "بناطيل",
    shorts: "شورتات",
    sets: "سيت",
    sale: "تخفيضات",
  },
};

/** Text on a "shop" button for a category, e.g. "Shop sets" / "تسوق الأطقم". */
const SHOP_WORD: Record<Lang, Record<NavCat, string>> = {
  en: {
    new: "Shop new drops",
    bestsellers: "Shop best sellers",
    shirts: "Shop shirts",
    hoodies: "Shop blouses",
    tees: "Shop T-Shirt",
    jackets: "Shop jackets",
    pants: "Shop pants",
    shorts: "Shop shorts",
    sets: "Shop sets",
    sale: "Shop sale",
  },
  ar: {
    new: "تسوق الجديد",
    bestsellers: "تسوق الأكثر مبيعاً",
    shirts: "تسوق القمصان",
    hoodies: "تسوق البلوزات",
    tees: "تسوق T-Shirt",
    jackets: "تسوق الجواكيت",
    pants: "تسوق البناطيل",
    shorts: "تسوق الشورتات",
    sets: "تسوق السيت",
    sale: "تسوق التخفيضات",
  },
};

export function shopLabel(lang: Lang, cat: NavCat) {
  return SHOP_WORD[lang][cat];
}

/** The "kind" of a product (hoodies / tees / pants / shorts / sets), used to label buttons that link to it. */
export function productCat(product: Product | undefined): NavCat {
  if (!product) return "sets";
  for (const cat of ["sets", "shirts", "hoodies", "jackets", "pants", "shorts", "tees"] as const) {
    if (product.tags.includes(cat)) return cat;
  }
  return "new";
}

/** Fill any missing fields (older saved data, partial database rows) from the defaults. */
export function normalizeContent(value: unknown): Record<Lang, SiteContent> {
  const input = (value ?? {}) as Partial<Record<Lang, Partial<SiteContent>>>;
  const out = {} as Record<Lang, SiteContent>;
  for (const lang of ["en", "ar"] as const) {
    const merged = { ...defaultContent[lang], ...(input[lang] ?? {}) };
    const images = Array.isArray(merged.heroImages)
      ? merged.heroImages.filter((src) => typeof src === "string" && src).slice(0, MAX_HERO_IMAGES)
      : [];
    const mobile = Array.isArray(merged.heroImagesMobile)
      ? merged.heroImagesMobile.filter((src) => typeof src === "string" && src).slice(0, MAX_HERO_IMAGES)
      : [];
    const rawSizes = (merged.sizes ?? {}) as Record<string, unknown>;
    const sizes: Partial<Record<TextKey, number>> = {};
    for (const [key, value] of Object.entries(rawSizes)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        sizes[key as TextKey] = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(value)));
      }
    }
    out[lang] = {
      ...merged,
      sizes,
      heroImages: images.length ? images : defaultContent[lang].heroImages,
      heroImagesMobile: mobile,
      heroCat: (CATS as readonly string[]).includes(merged.heroCat) && merged.heroCat !== "all"
        ? merged.heroCat
        : "new",
    };
  }
  return out;
}

export function catLabel(lang: Lang, cat: Cat) {
  if (cat === "all") return lang === "ar" ? "كل المنتجات" : "All Products";
  return NAV_LABEL[lang][cat];
}
