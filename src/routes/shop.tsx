import { createFileRoute } from "@tanstack/react-router";
import { ProductCard } from "@/components/store/product-card";
import { catLabel, isCat, matchesCat, publicProducts, type Cat } from "@/lib/store/catalog";
import { useI18n } from "@/lib/i18n";
import { useOwl } from "@/lib/store/owl-store";

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): { cat: Cat } => ({
    cat: isCat(search.cat) ? search.cat : "all",
  }),
  head: () => ({
    meta: [{ title: "Shop — OWL STORE" }],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { cat } = Route.useSearch();
  const lang = useOwl((state) => state.lang);
  const { t, plural } = useI18n();
  const products = publicProducts(useOwl((state) => state.products)).filter((product) =>
    matchesCat(product, cat),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <p className="font-display text-xs tracking-brand text-muted uppercase">OWL STORE</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <h1 className="font-display text-4xl uppercase leading-none md:text-6xl">{catLabel(lang, cat)}</h1>
        <p className="text-sm text-muted tabular-nums">
          {plural("shop.pieces", products.length)}
        </p>
      </div>
      {products.length === 0 ? (
        <p className="mt-16 text-muted">{t("shop.empty")}</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
