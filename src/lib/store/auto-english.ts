import { hasArabic, translateArToEn } from "@/lib/translate";
import { useOwl } from "@/lib/store/owl-store";
import type { Product } from "@/lib/store/catalog";

/** Translation that never throws: returns undefined when the service is down or over quota. */
async function tr(text: string): Promise<string | undefined> {
  try {
    const out = (await translateArToEn(text)).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

const running = new Set<string>();

/**
 * Fills the missing English texts of one product (name, description, details, colour names)
 * from the Arabic ones the admin typed, then saves them with the product.
 * Texts that already have English are left alone.
 */
export async function ensureProductEnglish(id: string): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  try {
    const find = () => useOwl.getState().products.find((item) => item.id === id);
    const before = find();
    if (!before) return;

    const nameEn = !before.nameEn?.trim() && hasArabic(before.name) ? await tr(before.name) : undefined;
    const descriptionEn =
      !before.descriptionEn?.trim() && hasArabic(before.description)
        ? await tr(before.description)
        : undefined;
    const detailsEn =
      !before.detailsEn?.length && before.details.some(hasArabic)
        ? await Promise.all(before.details.map((line) => (hasArabic(line) ? tr(line) : line)))
        : undefined;
    const colorEn = new Map<string, string>();
    for (const color of before.colors) {
      if (!color.nameEn?.trim() && hasArabic(color.name)) {
        const en = await tr(color.name);
        if (en) colorEn.set(color.id, en);
      }
    }

    // Apply on top of the latest copy, and only if the Arabic source did not change meanwhile.
    const latest = find();
    if (!latest) return;
    const patch: Partial<Product> = {};
    if (nameEn && latest.name === before.name) patch.nameEn = nameEn;
    if (descriptionEn && latest.description === before.description) patch.descriptionEn = descriptionEn;
    if (detailsEn && detailsEn.every(Boolean) && latest.details.join("\n") === before.details.join("\n")) {
      patch.detailsEn = detailsEn as string[];
    }
    if (colorEn.size) {
      patch.colors = latest.colors.map((color) => {
        const source = before.colors.find((item) => item.id === color.id);
        const en = colorEn.get(color.id);
        return en && source && source.name === color.name ? { ...color, nameEn: en } : color;
      });
    }
    if (Object.keys(patch).length) useOwl.getState().updateProduct(id, patch);
  } finally {
    running.delete(id);
  }
}

/** Runs ensureProductEnglish for every product, one after the other (gentle on the free API). */
export async function ensureAllEnglish(): Promise<void> {
  for (const product of useOwl.getState().products) {
    await ensureProductEnglish(product.id);
  }
}
