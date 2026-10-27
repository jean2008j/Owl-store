import { fetchProductsFromDatabase } from "@/lib/db-service";
import { useOwl } from "@/lib/store/owl-store";

/** Pulls the latest products (and their stock) from Supabase into the store. */
export async function refreshProducts(): Promise<void> {
  const rows = await fetchProductsFromDatabase();
  if (!rows.length) return;
  useOwl.setState({ products: rows });
}
