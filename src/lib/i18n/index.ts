import { useEffect, useMemo } from "react";
import { create } from "zustand";
import {
  defaultSettings,
  seedProducts,
  type Fit,
  type Order,
  type OrderItem,
  type Product,
  type ProductColor,
  type Settings,
} from "@/lib/store/catalog";
import { ImageError } from "@/lib/store/images";
import { ar, en, type Key } from "./dictionary";
import { CITY_AR } from "./content";
import { autoEn, hasArabic, useTranslationVersion } from "@/lib/translate";

export type Lang = "en" | "ar";
export type { Key };

export const LANG_KEY = "owl-lang";
const dictionaries: Record<Lang, Record<string, string>> = { en, ar };

const FIT_KEY: Record<Fit, Key> = {
  Oversize: "fit.oversize",
  "Boxy Fit": "fit.boxy",
  "Regular Fit": "fit.regular",
};

// ---------------------------------------------------------------------------
// Language store (persisted separately from the shop data) + <html> sync
// ---------------------------------------------------------------------------

function readStoredLang(): Lang {
  try {
    const value = localStorage.getItem(LANG_KEY);
    if (value === "ar" || value === "en") return value;
  } catch {
    /* storage blocked — fall back to English */
  }
  return "en";
}

export function dirOf(lang: Lang) {
  return lang === "ar" ? "rtl" : "ltr";
}

function applyToDocument(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = dirOf(lang);
}

type LangState = { lang: Lang; setLang: (lang: Lang) => void };

export const useLang = create<LangState>()((set) => ({
  lang: typeof window === "undefined" ? "en" : readStoredLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
    applyToDocument(lang);
    set({ lang });
  },
}));

if (typeof window !== "undefined") {
  applyToDocument(useLang.getState().lang);
  // keep several open tabs in sync
  window.addEventListener("storage", (event) => {
    if (event.key !== LANG_KEY) return;
    const next = event.newValue === "ar" ? "ar" : "en";
    if (next !== useLang.getState().lang) {
      applyToDocument(next);
      useLang.setState({ lang: next });
    }
  });
}

// ---------------------------------------------------------------------------
// Translation helpers
// ---------------------------------------------------------------------------

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

const SETTING_TEXT_KEYS = [
  "announcement",
  "heroKicker",
  "heroTitle",
  "heroSub",
  "heroCta",
] as const;
export type SettingTextKey = (typeof SETTING_TEXT_KEYS)[number];
const arKey = (key: SettingTextKey) => `${key}Ar` as const;

/** Arabic text as stored (falls back to the built-in Arabic copy while English is still the default). */
export function settingArValue(settings: Settings, key: SettingTextKey): string {
  const own = settings[arKey(key)];
  if (typeof own === "string") return own;
  return settings[key] === defaultSettings[key] ? (defaultSettings[arKey(key)] ?? "") : "";
}

function seedFor(id: string) {
  return seedProducts.find((item) => item.id === id);
}

function buildI18n(lang: Lang) {
  const dict = dictionaries[lang];
  const isAr = lang === "ar";
  const locale = isAr ? "ar-u-nu-latn" : "en-US";

  function t(key: Key, vars?: Vars) {
    return interpolate(dict[key] ?? en[key] ?? key, vars);
  }

  /** Picks `<base>.<plural category>` using Intl.PluralRules (Arabic has 6 forms). */
  function plural(base: string, n: number) {
    const category = new Intl.PluralRules(lang).select(n);
    const template =
      dict[`${base}.${category}`] ?? dict[`${base}.other`] ?? en[`${base}.other` as Key] ?? base;
    return interpolate(template, { n });
  }

  const arabicOr = (value: string | undefined, fallback: string) =>
    isAr && value && value.trim() ? value : fallback;

  // ---- products ----
  // The admin types product text in Arabic. English comes from the saved translation
  // (nameEn …) or, for older products, from a live cached translation.
  const enText = (own: string | undefined, source: string) =>
    own && own.trim() ? own : hasArabic(source) ? autoEn(source) : source;

  function productName(product: Product) {
    if (!isAr) return enText(product.nameEn, product.name);
    return arabicOr(product.nameAr || seedFor(product.id)?.nameAr, product.name);
  }
  function productDescription(product: Product) {
    if (!isAr) return enText(product.descriptionEn, product.description);
    return arabicOr(product.descriptionAr || seedFor(product.id)?.descriptionAr, product.description);
  }
  function productDetails(product: Product) {
    if (!isAr) {
      const own = product.detailsEn?.filter((line) => line.trim());
      if (own?.length) return own;
      return product.details.map((line) => enText(undefined, line));
    }
    const own = product.detailsAr?.filter((line) => line.trim());
    if (own?.length) return own;
    const seeded = seedFor(product.id)?.detailsAr;
    return seeded?.length ? seeded : product.details;
  }
  function colorLabel(product: Product, color: ProductColor) {
    if (!isAr) return enText(color.nameEn, color.name);
    const seeded = seedFor(product.id)?.colors.find((item) => item.id === color.id)?.nameAr;
    return arabicOr(color.nameAr || seeded, color.name);
  }

  // ---- fixed data ----
  const fitLabel = (fit: string) => (fit in FIT_KEY ? t(FIT_KEY[fit as Fit]) : fit);
  const cityLabel = (city: string) =>
    isAr ? (CITY_AR[city] ?? city) : city === "Al-Hasakah" ? "Al-Hasakah & Qamishli" : city;

  // ---- editable storefront copy ----
  function settingText(settings: Settings, key: SettingTextKey) {
    if (isAr) {
      const own = settings[arKey(key)]?.trim();
      if (own) return own;
      if (settings[key] === defaultSettings[key]) return defaultSettings[arKey(key)] ?? settings[key];
    }
    return settings[key];
  }

  // ---- orders (stored in English; localised at display time) ----
  function orderItemName(item: OrderItem, products: Product[]) {
    const product = products.find((entry) => entry.id === item.productId);
    if (product) return productName(product);
    return isAr ? item.name : enText(undefined, item.name);
  }
  function orderItemColor(item: OrderItem, products: Product[]) {
    const product = products.find((entry) => entry.id === item.productId);
    const color = product?.colors.find((entry) => entry.name === item.color);
    if (product && color) return colorLabel(product, color);
    return isAr ? item.color : enText(undefined, item.color);
  }
  const orderStatusLabel = (status: Order["status"]) => t(`order.status.${status}`);
  const telegramLabel = (status: Order["telegram"]) => t(`order.tg.${status}`);

  const formatDateTime = (iso: string) => new Date(iso).toLocaleString(locale);
  const imageError = (error: unknown, fallback: Key = "img.err.read") =>
    error instanceof ImageError ? t(`img.err.${error.code}`) : t(fallback);

  return {
    lang,
    isAr,
    dir: dirOf(lang),
    locale,
    t,
    plural,
    productName,
    productDescription,
    productDetails,
    colorLabel,
    fitLabel,
    cityLabel,
    settingText,
    orderItemName,
    orderItemColor,
    orderStatusLabel,
    telegramLabel,
    formatDateTime,
    imageError,
  };
}

export type I18n = ReturnType<typeof buildI18n>;

/** Main hook: re-renders the component when the language changes. */
export function useI18n(): I18n {
  const lang = useLang((state) => state.lang);
  const translations = useTranslationVersion((state) => state.v); // re-render when a live translation arrives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildI18n(lang), [lang, translations]);
}

/** Keeps <html lang/dir> correct even if something else touched them. */
export function useSyncDocumentLanguage() {
  const lang = useLang((state) => state.lang);
  useEffect(() => applyToDocument(lang), [lang]);
}
