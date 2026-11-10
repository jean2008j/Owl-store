import { toast } from "sonner";
import { isSupabaseConfigured, uploadMediaToStorage } from "@/lib/db-service";
import { productVideos, type Product } from "@/lib/store/catalog";

const isData = (src: string) => src.startsWith("data:");

/**
 * Moves a product's pictures and video from base64 (huge) to Supabase Storage and keeps only
 * the links. Files that already are links are left alone. Throws if an upload fails.
 */
export async function uploadProductMedia(product: Product): Promise<Product> {
  if (!isSupabaseConfigured) return product;
  const allVideos = productVideos(product);
  if (!product.images.some(isData) && !allVideos.some(isData)) return product;
  const folder = `products/${product.id}`;
  const images: string[] = [];
  for (const src of product.images) images.push(isData(src) ? await uploadMediaToStorage(src, folder) : src);
  const videos: string[] = [];
  for (const src of allVideos) videos.push(isData(src) ? await uploadMediaToStorage(src, folder) : src);
  return { ...product, images, video: videos[0] ?? "", videos };
}

/** For site pictures (hero …): upload when possible, otherwise keep the picture as it is. */
export async function uploadOrKeep(urls: string[], folder: string): Promise<string[]> {
  if (!isSupabaseConfigured) return urls;
  const out: string[] = [];
  let warned = false;
  for (const src of urls) {
    if (!isData(src)) {
      out.push(src);
      continue;
    }
    try {
      out.push(await uploadMediaToStorage(src, folder));
    } catch (error) {
      if (!warned) toast.error(error instanceof Error ? error.message : "تعذّر رفع الصورة.");
      warned = true;
      out.push(src);
    }
  }
  return out;
}
