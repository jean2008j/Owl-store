/**
 * Arabic → English auto-translation used by the admin "translate" buttons.
 * Uses the free MyMemory API (no key needed). Long text is split into chunks
 * and separators such as "·" and line breaks are kept as they are.
 */
import { create } from "zustand";

const MAX_CHUNK = 450;

export const hasArabic = (text?: string | null) => !!text && /[\u0600-\u06FF]/.test(text);

// ---------------------------------------------------------------------------
// Instant dictionary for colours (so colour names never depend on the network)
// ---------------------------------------------------------------------------
const norm = (text: string) =>
  text
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");

const build = (pairs: Record<string, string>) =>
  new Map(Object.entries(pairs).map(([ar, en]) => [norm(ar), en]));

const COLOR_WORDS = build({
  أسود: "Black", سوداء: "Black", اسود: "Black", أبيض: "White", ابيض: "White", بيضاء: "White",
  رمادي: "Grey", رمادية: "Grey", فضي: "Silver", فضية: "Silver", ذهبي: "Gold", ذهبية: "Gold",
  أحمر: "Red", احمر: "Red", حمراء: "Red", أزرق: "Blue", ازرق: "Blue", زرقاء: "Blue",
  أخضر: "Green", اخضر: "Green", خضراء: "Green", أصفر: "Yellow", اصفر: "Yellow", صفراء: "Yellow",
  برتقالي: "Orange", برتقالية: "Orange", بنفسجي: "Purple", بنفسجية: "Purple", موف: "Mauve",
  وردي: "Pink", وردية: "Pink", زهري: "Pink", زهرية: "Pink", بني: "Brown", بنية: "Brown",
  بيج: "Beige", كحلي: "Navy", كحلية: "Navy", تركوازي: "Turquoise", فيروزي: "Turquoise",
  زيتي: "Olive", زيتوني: "Olive", كاكي: "Khaki", عنابي: "Burgundy", خمري: "Burgundy",
  كريمي: "Cream", كريمية: "Cream", جملي: "Camel", طحيني: "Taupe", سماوي: "Sky Blue",
  ليموني: "Lemon", نيلي: "Indigo", قهوائي: "Coffee", شمبانيا: "Champagne", عظمي: "Bone",
  دخاني: "Smoke", حبري: "Ink", ليلي: "Night", فحمي: "Charcoal", رصاصي: "Grey",
});
const COLOR_MODIFIERS = build({ غامق: "Dark", غامقة: "Dark", فاتح: "Light", فاتحة: "Light" });

function dictionary(text: string): string | null {
  const words = norm(text).split(" ");
  const whole = COLOR_WORDS.get(words.join(" "));
  if (whole) return whole;
  const [first, ...rest] = words;
  const base = COLOR_WORDS.get(first);
  if (base && rest.length && rest.every((w) => COLOR_MODIFIERS.has(w))) {
    return `${rest.map((w) => COLOR_MODIFIERS.get(w)).join(" ")} ${base}`;
  }
  return null;
}

function decode(text: string) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function translateOne(q: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=ar|en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("translate-http");
  const data = (await res.json()) as {
    responseStatus?: number | string;
    responseData?: { translatedText?: string };
  };
  const out = data.responseData?.translatedText;
  if (Number(data.responseStatus) !== 200 || typeof out !== "string" || /MYMEMORY WARNING/i.test(out)) {
    throw new Error("translate-quota");
  }
  return decode(out).trim();
}

function chunks(text: string): string[] {
  const sentences = text.split(/(?<=[.!?؟۔])\s+/);
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + " " + sentence).length > MAX_CHUNK) {
      out.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) out.push(current);
  return out.flatMap((piece) => {
    if (piece.length <= MAX_CHUNK) return [piece];
    const parts: string[] = [];
    for (let i = 0; i < piece.length; i += MAX_CHUNK) parts.push(piece.slice(i, i + MAX_CHUNK));
    return parts;
  });
}

export async function translateArToEn(text: string): Promise<string> {
  if (!hasArabic(text)) return text;
  const quick = dictionary(text);
  if (quick) return quick;
  const parts = text.split(/(\s*·\s*|\n+)/); // separators sit at odd indexes
  const done = await Promise.all(
    parts.map(async (part, index) => {
      if (index % 2 === 1 || !part.trim()) return part;
      const pieces = await Promise.all(chunks(part.trim()).map(translateOne));
      return pieces.join(" ");
    }),
  );
  return done.join("");
}

// ---------------------------------------------------------------------------
// Live fallback used by the storefront: when a product has no saved English yet,
// the Arabic text is translated in the background, cached on the device, and the
// page re-renders as soon as the translation arrives.
// ---------------------------------------------------------------------------
const CACHE_KEY = "owl-tr-en-v1";
const cache = new Map<string, string>();
const pending = new Set<string>();
const failedAt = new Map<string, number>();

try {
  if (typeof localStorage !== "undefined") {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>;
    for (const [key, value] of Object.entries(saved)) cache.set(key, value);
  }
} catch {
  /* ignore broken cache */
}

function persistCache() {
  try {
    const entries = [...cache.entries()].slice(-400);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* storage full or blocked */
  }
}

/** Bumps whenever a background translation lands, so components re-render. */
export const useTranslationVersion = create<{ v: number }>(() => ({ v: 0 }));

/** English for an Arabic text: cached/instant if known, otherwise the original while it loads. */
export function autoEn(text: string): string {
  const source = text.trim();
  if (!hasArabic(source)) return text;
  const hit = cache.get(source);
  if (hit) return hit;
  const quick = dictionary(source);
  if (quick) {
    cache.set(source, quick);
    return quick;
  }
  if (typeof window === "undefined" || pending.has(source)) return text;
  const failed = failedAt.get(source);
  if (failed && Date.now() - failed < 60_000) return text;
  pending.add(source);
  translateArToEn(source)
    .then((out) => {
      cache.set(source, out);
      persistCache();
      useTranslationVersion.setState((state) => ({ v: state.v + 1 }));
    })
    .catch(() => failedAt.set(source, Date.now()))
    .finally(() => pending.delete(source));
  return text;
}
