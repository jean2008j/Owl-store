import { CITY_AR } from "@/lib/i18n/content";

/** The shop's location on Google Maps (footer link, and the pick-up address for store pick-up orders). */
export const STORE_MAP_URL = "https://maps.app.goo.gl/uwhJvvncMc3tnHaF6";

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;
export type Size = (typeof SIZES)[number];

export const FITS = ["Oversize", "Boxy Fit", "Regular Fit"] as const;
export type Fit = (typeof FITS)[number];

export const TAGS = ["new", "hoodies", "pants", "pajamas"] as const;
export type Tag = (typeof TAGS)[number];

export const CATS = ["all", "new", "hoodies", "pants", "pajamas"] as const;
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
  video: string; // first video (kept for older code and saved data)
  /** All videos of the product (the first one equals `video`). Missing on old products → `video` is used. */
  videos?: string[];
  colors: ProductColor[];
  fits: Fit[];
  /** Total per size (sum over all colours). Kept in sync with `colorStock`; old code and old products read this. */
  stock: Record<Size, number>;
  /** Stock per colour and size: { [colorId]: { XS: 2, S: 4, … } }. Missing on old products → `stock` is used. */
  colorStock?: Record<string, Record<Size, number>>;
  soldOut: boolean;
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
  storePassword: string; // customers' store password (local/demo mode only; with Supabase it lives in the database)
  storePasswordEnabled: boolean; // false → no password screen
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
  delivery?: {
    pickup: boolean;
    office: string;
    /** Phone of the company office (shown on the order page). */
    officePhone?: string;
    etaAr: string;
    etaEn: string;
    companyAr: string;
    companyEn: string;
    /** false = a store option (pick-up from the shop / own delivery), not a shipping company. */
    isCompany?: boolean;
  };
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
  "Qamishli",
] as const;

/** A governorate a shipping company delivers to (with its own delivery time and pick-up / delivery areas). */
export type CompanyZone = {
  city: string; // English governorate name, same list as CITIES
  areas: string; // areas separated by «،» (home delivery) or the office address (pick-up)
  etaAr: string;
  etaEn: string;
  /** Office phone shown to the customer (pick-up companies, e.g. Sila). Optional. */
  phone?: string;
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
  isCompany?: boolean; // false = not a shipping company (e.g. pick-up from the store / own delivery). Missing = true.
  enabled: boolean;
  sortOrder: number;
  zones: CompanyZone[];
};

const SILA_ETA = { etaAr: "2–7 أيام", etaEn: "2–7 days" };
const RAFIDAIN_ETA = { etaAr: "2–3 أيام", etaEn: "2–3 days" };
const rafidain = (city: string, areas: string): CompanyZone => ({ city, areas, ...RAFIDAIN_ETA });
const sila = (city: string, areas: string, phone = ""): CompanyZone => ({ city, areas, phone, ...SILA_ETA });

/** Used in demo mode (no Supabase). Same data the SQL file seeds. */
export const DEFAULT_SHIPPING_COMPANIES: ShippingCompany[] = [
  {
    id: "sila",
    nameAr: "صلة",
    nameEn: "Sila",
    fee: 2,
    deliveryAr: "الاستلام من مكتب الشركة",
    deliveryEn: "Pick-up from the company office",
    pickup: true,
    enabled: true,
    sortOrder: 1,
    zones: [
      sila("Damascus", "الزبلطاني، خلف الهجرة والجوازات، المنطقة الصناعية، مقسم رقم 11", "0989700311"),
      sila("Rural Damascus", "الزبلطاني، خلف الهجرة والجوازات، المنطقة الصناعية، مقسم رقم 11", "0989700311"),
      sila("Deir ez-Zor", "", ""),
      sila("Tartus", "طرطوس جنوب حديقة الملجأ - غرب فلافل العرب", "0989700314"),
      sila("Aleppo", "الأعظمية - خط صلاح الدين بعد مفرق عوجة باتجاه جسر قصر الضيافة مقابل شركة الهرم", "0989700312"),
      sila("Hama", "البارودية - جانب مديرية النفوس", "0989700316"),
      sila("Homs", "كرم اللوز - خلف مشفى كرم اللوز العيادات", "0989700315"),
      sila("Daraa", "شمال الخط - بعد مطعم فلفول (مستر نوح) بـ200 متر نحو الشرق", "0989700317"),
      sila("Idlib", "إدلب المدينة - شارع الـ40 مقابل مدرسة المتنبي", "0989700310"),
      sila("Al-Hasakah", "الكلاسة - شارع الـ34 - مقابل جامع السيدة زينب", "0989700320"),
      sila("Raqqa", "سوق الهال القديم جانب معرض الفرحان", "0989700319"),
      sila("Latakia", "المشروع السابع - شارع الشعبة", "0989700313"),
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
      rafidain("Damascus", "جسر فيكتوريا خلف البريد القديم"),
      rafidain("Aleppo", "السليمانية خلف زجاج غريبه"),
      rafidain("Homs", "الكراج الشمالي"),
      { city: "Al-Hasakah", areas: "كراج تل حجز", etaAr: "يوم واحد", etaEn: "1 day" },
    ],
  },
  // Qamishli: the shop is there, so no shipping company. Two plain options.
  {
    id: "qamishli-store",
    nameAr: "استلام من المحل",
    nameEn: "Pick up from the store",
    fee: 0,
    deliveryAr: "بدون أجرة توصيل",
    deliveryEn: "No delivery fee",
    pickup: true,
    isCompany: false,
    enabled: true,
    sortOrder: 3,
    zones: [{ city: "Qamishli", areas: "", etaAr: "", etaEn: "" }],
  },
  {
    id: "qamishli-home",
    nameAr: "توصيل لباب المنزل",
    nameEn: "Home delivery",
    fee: 2,
    deliveryAr: "",
    deliveryEn: "",
    pickup: false,
    isCompany: false,
    enabled: true,
    sortOrder: 4,
    zones: [{ city: "Qamishli", areas: "", etaAr: "", etaEn: "" }],
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
  { label: "New Drop", cat: "new" },
  { label: "Jacket", cat: "hoodies" },
  { label: "Pants", cat: "pants" },
  { label: "Pajamas", cat: "pajamas" },
];

export const CAT_LABEL: Record<Cat, string> = {
  all: "All products",
  new: "New drop",
  hoodies: "Jacket",
  pants: "Pants",
  pajamas: "Pajamas",
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
    featureProductId: "set-black",
  },
  ar: {
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
    featureProductId: "set-black",
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
  storePassword: "",
  storePasswordEnabled: false,
};

export const seedProducts: Product[] = [
  {
    id: "set-navy",
    slug: "set-navy",
    name: "سيت كامل (جاكيت + بنطلون) - كحلي",
    nameEn: "Full Set (Jacket + Pants) - Navy",
    price: 45,
    compareAt: null,
    tags: ["new", "pajamas"],
    description: "سيت بيجاما قطني كامل: جاكيت كروب مع بنطلون سوبر باجي. الجاكيت والبنطلون بنفس اللون.",
    descriptionEn: "Full cotton pajama set: cropped zip jacket with super-baggy pants, in the same colour.",
    details: ["سيت بيجاما قطني", "جاكيت كروب كت بسحاب وقبعة", "بنطلون سوبر باجي مع جيب جانبي ومطاط سفلي", "الجاكيت والبنطلون بنفس اللون"],
    detailsEn: ["Cotton pajama set", "Cropped zip jacket with hood", "Super-baggy pants with side pocket and elastic hem", "Jacket and pants in the same colour"],
    images: ["/products/navy-set.webp", "/products/navy-jacket.webp", "/products/navy-pants.webp"],
    video: "",
    colors: [{ id: "navy", name: "كحلي", nameEn: "Navy", hex: "#1f2f5c" }],
    fits: ["Oversize"],
    stock: stock({ XS: 0, XXL: 0 }),
    soldOut: false,
  },
  {
    id: "set-grey",
    slug: "set-grey",
    name: "سيت كامل (جاكيت + بنطلون) - رمادي",
    nameEn: "Full Set (Jacket + Pants) - Grey",
    price: 45,
    compareAt: null,
    tags: ["new", "pajamas"],
    description: "سيت بيجاما قطني كامل: جاكيت كروب مع بنطلون سوبر باجي. الجاكيت والبنطلون بنفس اللون.",
    descriptionEn: "Full cotton pajama set: cropped zip jacket with super-baggy pants, in the same colour.",
    details: ["سيت بيجاما قطني", "جاكيت كروب كت بسحاب وقبعة", "بنطلون سوبر باجي مع جيب جانبي ومطاط سفلي", "الجاكيت والبنطلون بنفس اللون"],
    detailsEn: ["Cotton pajama set", "Cropped zip jacket with hood", "Super-baggy pants with side pocket and elastic hem", "Jacket and pants in the same colour"],
    images: ["/products/grey-set.webp", "/products/grey-jacket.webp", "/products/grey-pants.webp"],
    video: "",
    colors: [{ id: "grey", name: "رمادي", nameEn: "Grey", hex: "#9a9a9c" }],
    fits: ["Oversize"],
    stock: stock({ XS: 0, XXL: 0 }),
    soldOut: false,
  },
  {
    id: "set-black",
    slug: "set-black",
    name: "سيت كامل (جاكيت + بنطلون) - أسود",
    nameEn: "Full Set (Jacket + Pants) - Black",
    price: 45,
    compareAt: null,
    tags: ["new", "pajamas"],
    description: "سيت بيجاما قطني كامل: جاكيت كروب مع بنطلون سوبر باجي. الجاكيت والبنطلون بنفس اللون.",
    descriptionEn: "Full cotton pajama set: cropped zip jacket with super-baggy pants, in the same colour.",
    details: ["سيت بيجاما قطني", "جاكيت كروب كت بسحاب وقبعة", "بنطلون سوبر باجي مع جيب جانبي ومطاط سفلي", "الجاكيت والبنطلون بنفس اللون"],
    detailsEn: ["Cotton pajama set", "Cropped zip jacket with hood", "Super-baggy pants with side pocket and elastic hem", "Jacket and pants in the same colour"],
    images: ["/products/black-set.webp", "/products/black-jacket.webp", "/products/black-pants.webp"],
    video: "",
    colors: [{ id: "black", name: "أسود", nameEn: "Black", hex: "#141414" }],
    fits: ["Oversize"],
    stock: stock({ XS: 0, XXL: 0 }),
    soldOut: false,
  },
  {
    id: "jacket-navy",
    slug: "jacket-navy",
    name: "جاكيت كروب - كحلي",
    nameEn: "Cropped Jacket - Navy",
    price: 25,
    compareAt: null,
    tags: ["new", "hoodies"],
    description: "جاكيت قطني بسحاب بقصّة كروب قصيرة، مع قبعة وجيب أمامي وأساور مطاط.",
    descriptionEn: "Cotton zip-up jacket in a cropped cut, with a hood, front pocket and ribbed cuffs.",
    details: ["قطن", "قصّة كروب كت", "سحاب أمامي وقبعة", "جيب أمامي وأساور وخصر مطاط"],
    detailsEn: ["Cotton", "Cropped cut", "Front zip and hood", "Front pocket, ribbed cuffs and hem"],
    images: ["/products/navy-jacket.webp"],
    video: "",
    colors: [{ id: "navy", name: "كحلي", nameEn: "Navy", hex: "#1f2f5c" }],
    fits: ["Boxy Fit"],
    stock: stock({ XS: 0, XXL: 0 }),
    soldOut: false,
  },
  {
    id: "jacket-grey",
    slug: "jacket-grey",
    name: "جاكيت كروب - رمادي",
    nameEn: "Cropped Jacket - Grey",
    price: 25,
    compareAt: null,
    tags: ["new", "hoodies"],
    description: "جاكيت قطني بسحاب بقصّة كروب قصيرة، مع قبعة وجيب أمامي وأساور مطاط.",
    descriptionEn: "Cotton zip-up jacket in a cropped cut, with a hood, front pocket and ribbed cuffs.",
    details: ["قطن", "قصّة كروب كت", "سحاب أمامي وقبعة", "جيب أمامي وأساور وخصر مطاط"],
    detailsEn: ["Cotton", "Cropped cut", "Front zip and hood", "Front pocket, ribbed cuffs and hem"],
    images: ["/products/grey-jacket.webp"],
    video: "",
    colors: [{ id: "grey", name: "رمادي", nameEn: "Grey", hex: "#9a9a9c" }],
    fits: ["Boxy Fit"],
    stock: stock({ XS: 0, XXL: 0 }),
    soldOut: false,
  },
  {
    id: "jacket-black",
    slug: "jacket-black",
    name: "جاكيت كروب - أسود",
    nameEn: "Cropped Jacket - Black",
    price: 25,
    compareAt: null,
    tags: ["new", "hoodies"],
    description: "جاكيت قطني بسحاب بقصّة كروب قصيرة، مع قبعة وجيب أمامي وأساور مطاط.",
    descriptionEn: "Cotton zip-up jacket in a cropped cut, with a hood, front pocket and ribbed cuffs.",
    details: ["قطن", "قصّة كروب كت", "سحاب أمامي وقبعة", "جيب أمامي وأساور وخصر مطاط"],
    detailsEn: ["Cotton", "Cropped cut", "Front zip and hood", "Front pocket, ribbed cuffs and hem"],
    images: ["/products/black-jacket.webp"],
    video: "",
    colors: [{ id: "black", name: "أسود", nameEn: "Black", hex: "#141414" }],
    fits: ["Boxy Fit"],
    stock: stock({ XS: 0, XXL: 0 }),
    soldOut: false,
  },
  {
    id: "pants-navy",
    slug: "pants-navy",
    name: "بنطلون سوبر باجي - كحلي",
    nameEn: "Super-Baggy Pants - Navy",
    price: 25,
    compareAt: null,
    tags: ["new", "pants"],
    description: "بنطلون بيجاما قطني سوبر باجي مع جيب جانبي ومطاط سفلي.",
    descriptionEn: "Super-baggy cotton pajama pants with a side pocket and an elastic hem.",
    details: ["قطن", "قصّة سوبر باجي", "جيب جانبي", "مطاط سفلي قابل للتعديل"],
    detailsEn: ["Cotton", "Super-baggy cut", "Side pocket", "Adjustable elastic hem"],
    images: ["/products/navy-pants.webp"],
    video: "",
    colors: [{ id: "navy", name: "كحلي", nameEn: "Navy", hex: "#1f2f5c" }],
    fits: ["Oversize"],
    stock: stock({ XS: 0, XXL: 0 }),
    soldOut: false,
  },
  {
    id: "pants-grey",
    slug: "pants-grey",
    name: "بنطلون سوبر باجي - رمادي",
    nameEn: "Super-Baggy Pants - Grey",
    price: 25,
    compareAt: null,
    tags: ["new", "pants"],
    description: "بنطلون بيجاما قطني سوبر باجي مع جيب جانبي ومطاط سفلي.",
    descriptionEn: "Super-baggy cotton pajama pants with a side pocket and an elastic hem.",
    details: ["قطن", "قصّة سوبر باجي", "جيب جانبي", "مطاط سفلي قابل للتعديل"],
    detailsEn: ["Cotton", "Super-baggy cut", "Side pocket", "Adjustable elastic hem"],
    images: ["/products/grey-pants.webp"],
    video: "",
    colors: [{ id: "grey", name: "رمادي", nameEn: "Grey", hex: "#9a9a9c" }],
    fits: ["Oversize"],
    stock: stock({ XS: 0, XXL: 0 }),
    soldOut: false,
  },
  {
    id: "pants-black",
    slug: "pants-black",
    name: "بنطلون سوبر باجي - أسود",
    nameEn: "Super-Baggy Pants - Black",
    price: 25,
    compareAt: null,
    tags: ["new", "pants"],
    description: "بنطلون بيجاما قطني سوبر باجي مع جيب جانبي ومطاط سفلي.",
    descriptionEn: "Super-baggy cotton pajama pants with a side pocket and an elastic hem.",
    details: ["قطن", "قصّة سوبر باجي", "جيب جانبي", "مطاط سفلي قابل للتعديل"],
    detailsEn: ["Cotton", "Super-baggy cut", "Side pocket", "Adjustable elastic hem"],
    images: ["/products/black-pants.webp"],
    video: "",
    colors: [{ id: "black", name: "أسود", nameEn: "Black", hex: "#141414" }],
    fits: ["Oversize"],
    stock: stock({ XS: 0, XXL: 0 }),
    soldOut: false,
  },
];

export const CATALOG_VERSION = 2;

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

/** Every video of a product (new `videos` list, or the single old `video`). */
export function productVideos(product: Pick<Product, "video" | "videos">): string[] {
  if (product.videos?.length) return product.videos.filter(Boolean);
  return product.video ? [product.video] : [];
}

/** Does this product track stock per colour? */
export function hasColorStock(product: Product) {
  return Boolean(product.colorStock && Object.keys(product.colorStock).length);
}

export function matchesCat(product: Product, cat: Cat) {
  if (cat === "all") return true;
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
  // "المحافظة - المنطقة/المكتب (العنوان التفصيلي)": the detailed address is in brackets whenever the customer wrote one.
  const addressLine = parts
    ? `${city}${parts.area ? ` - ${parts.area}` : ""}${detail ? ` (${detail})` : ""}`
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
    ...(order.shipping.companyId && order.delivery?.isCompany !== false ? [`شركة الشحن: ${order.shipping.label}`] : []),
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
    images: ["/products/navy-jacket.webp"],
    video: "",
    colors: [{ id: "navy", name: "Navy", hex: "#1f2f5c" }],
    fits: ["Oversize"],
    stock: stock(),
    soldOut: false,
  };
}

// ---------- Language helpers ----------

export const NAV_LABEL: Record<Lang, Record<NavCat, string>> = {
  en: {
    new: "New Drop",
    hoodies: "Jacket",
    pants: "Pants",
    pajamas: "Pajamas",
  },
  ar: {
    new: "دروب جديد",
    hoodies: "جاكيت",
    pants: "بنطال",
    pajamas: "بيجاما",
  },
};

/** Text on a "shop" button for a category, e.g. "Shop sets" / "تسوق الأطقم". */
const SHOP_WORD: Record<Lang, Record<NavCat, string>> = {
  en: {
    new: "Shop new drop",
    hoodies: "Shop jackets",
    pants: "Shop pants",
    pajamas: "Shop pajamas",
  },
  ar: {
    new: "تسوق دروب جديد",
    hoodies: "تسوق الجاكيتات",
    pants: "تسوق البناطيل",
    pajamas: "تسوق البيجامات",
  },
};

export function shopLabel(lang: Lang, cat: NavCat) {
  return SHOP_WORD[lang][cat];
}

/** The "kind" of a product (jackets / pants / pajamas), used to label buttons that link to it. */
export function productCat(product: Product | undefined): NavCat {
  if (!product) return "new";
  for (const cat of ["hoodies", "pants", "pajamas"] as const) {
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
