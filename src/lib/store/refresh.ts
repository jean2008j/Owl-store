import { fetchProductsFromDatabase, fetchSecretProducts, isSupabaseConfigured } from "@/lib/db-service";
import { useOwl } from "@/lib/store/owl-store";

/** Pulls the latest products (and their stock) from Supabase into the store. */
export async function refreshProducts(): Promise<void> {
  const rows = await fetchProductsFromDatabase();
  const { secretUnlocked, secretAccess } = useOwl.getState();
  let secretRows: typeof rows = [];
  // A customer who opened the secret section keeps seeing (and getting fresh stock of) those products.
  if (isSupabaseConfigured && secretUnlocked && secretAccess) {
    const res = await fetchSecretProducts(secretAccess);
    if (res.ok) secretRows = res.products;
  }
  if (!rows.length && !secretRows.length) return;
  const ids = new Set(rows.map((row: { id: string }) => row.id));
  useOwl.setState({
    products: [...rows, ...secretRows.filter((row: { id: string }) => !ids.has(row.id))],
  });
}
