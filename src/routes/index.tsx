import { createFileRoute, Link } from "@tanstack/react-router";
import { ProductCard } from "@/components/store/product-card";
import { FeatureSection, HeroSection } from "@/components/store/home-sections";
import { useI18n } from "@/lib/i18n";
import { publicProducts } from "@/lib/store/catalog";
import { useOwl } from "@/lib/store/owl-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "OWL STORE — New Drop" }],
  }),
  component: Home,
});

function Home() {
  const lang = useOwl((state) => state.lang);
  const content = useOwl((state) => state.settings.content[state.lang]);
  const allProducts = useOwl((state) => state.products);
  const products = publicProducts(allProducts);
  const { t, dir } = useI18n();

  return (
    <>
      <HeroSection content={content} lang={lang} />

      {/* Content sheet: slides up over the bottom of the hero with rounded top corners */}
      <div className="relative z-10 -mt-8 rounded-t-3xl bg-bg">
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-brand text-muted uppercase">{t("home.season")}</p>
            <h2 className="mt-2 font-display text-4xl uppercase leading-none md:text-5xl">{t("home.floor")}</h2>
          </div>
          <Link to="/shop" search={{ cat: "all" }} className="font-display text-xs tracking-widest uppercase">
            {t("home.shopAll")}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <FeatureSection content={content} lang={lang} products={products} />

      <section dir="ltr" className="grid border-t border-line md:grid-cols-3">
        {(
          [
            ["home.f1.title", "home.f1.body"],
            ["home.f2.title", "home.f2.body"],
            ["home.f3.title", "home.f3.body"],
          ] as const
        ).map(([title, copy]) => (
          <div key={title} dir={dir} className="border-b border-line px-6 py-10 md:border-r md:border-b-0 md:px-8">
            <h3 className="font-display text-xl uppercase">{t(title)}</h3>
            <p className="mt-3 text-sm text-muted">{t(copy)}</p>
          </div>
        ))}
      </section>
      </div>
    </>
  );
}
