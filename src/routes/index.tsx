import { createFileRoute, Link } from "@tanstack/react-router";
import { catLabel, NAV } from "@/lib/store/catalog";
import { useI18n } from "@/lib/i18n";
import { useOwl } from "@/lib/store/owl-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "ATHAR & OWL — New Drop" }],
  }),
  component: Home,
});

function Home() {
  const lang = useOwl((state) => state.lang);
  const products = useOwl((state) => state.products);
  const { t, dir } = useI18n();
  const ar = lang === "ar";

  return (
    <>
      {/* Store name, big, right under the floating header */}
      <section className="px-4 pt-[5.4rem] pb-8 text-center lg:pt-56 lg:pb-10">
        <h1 className="font-display text-[clamp(1.6rem,10.5vw,3.25rem)] leading-none font-bold tracking-[0.03em] whitespace-nowrap uppercase md:text-7xl">
          Athar &amp; Owl
        </h1>
      </section>

      {/* Shop by category: image tiles instead of the old strip. Tap one → its products. */}
      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
        <h2 className="mb-5 text-center font-display text-lg tracking-wide uppercase">
          {ar ? "تسوّق حسب الفئة" : "Shop by category"}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {NAV.map((item) => {
            const sample = products.find((p) => p.tags.includes(item.cat));
            const image = sample?.images[0] ?? "/media/hero.jpg";
            return (
              <Link
                key={item.cat}
                to="/shop"
                search={{ cat: item.cat }}
                className="group relative block aspect-[3/4] overflow-hidden rounded-xl bg-surface"
              >
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-3 text-center font-sans text-sm font-semibold text-white">
                  {catLabel(lang, item.cat)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="relative z-10 bg-bg">
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
