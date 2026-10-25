import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  productCat,
  shopLabel,
  type Lang,
  type Product,
  type SiteContent,
} from "@/lib/store/catalog";
import { cn } from "@/lib/utils";

const SLIDE_MS = 5500;

/**
 * Hero: 1–3 images per device (cross-fading when there is more than one), text and a "Shop …" button.
 * Phones use `heroImagesMobile` (portrait) and fall back to the laptop images when none were added.
 */
export function HeroSection({
  content,
  lang,
  preview = false,
  view = "desktop",
}: {
  content: SiteContent;
  lang: Lang;
  /** Smaller, non-interactive version used by the admin live preview. */
  preview?: boolean;
  /** Admin preview only: which device to show. */
  view?: "desktop" | "mobile";
}) {
  const desktopImgs = content.heroImages;
  const mobileImgs = content.heroImagesMobile?.length ? content.heroImagesMobile : desktopImgs;
  const portrait = preview && view === "mobile";
  const sets = preview
    ? [{ imgs: portrait ? mobileImgs : desktopImgs, cls: "" }]
    : [
        { imgs: desktopImgs, cls: "max-md:hidden" },
        { imgs: mobileImgs, cls: "md:hidden" },
      ];
  const [tick, setTick] = useState(0);
  const longest = Math.max(...sets.map((set) => set.imgs.length));

  useEffect(() => {
    if (longest < 2) return;
    const timer = setInterval(() => setTick((t) => t + 1), SLIDE_MS);
    return () => clearInterval(timer);
  }, [longest]);

  const label = shopLabel(lang, content.heroCat);

  return (
    <section
      className={cn(
        "relative overflow-hidden",
        preview ? "bg-surface" : "hero-frame",
        preview && (portrait ? "mx-auto aspect-[9/16] max-w-[260px]" : "aspect-video"),
      )}
    >
      {sets.map((set, s) =>
        set.imgs.map((src, i) => (
          <img
            key={`${s}-${i}-${src.slice(-24)}`}
            src={src}
            alt=""
            fetchPriority={i === 0 ? "high" : undefined}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000",
              set.cls,
              i === tick % set.imgs.length ? "opacity-100" : "opacity-0",
            )}
          />
        )),
      )}
      <div className="absolute inset-0 bg-black/25" />
      <div
        className={cn(
          "relative mx-auto flex max-w-7xl flex-col justify-end",
          preview ? "h-full p-4" : "hero-frame px-4 pt-10 pb-16 md:px-8 md:pb-20",
        )}
      >
        <p
          className={cn(
            "font-display tracking-brand text-white uppercase",
            preview ? "text-[0.6rem]" : "text-xs",
          )}
        >
          <Sized pct={content.sizes?.heroKicker}>{content.heroKicker}</Sized>
        </p>
        <h1
          className={cn(
            "max-w-4xl font-display leading-none text-white uppercase",
            preview ? (portrait ? "mt-1 text-2xl" : "mt-1 text-3xl") : "mt-3 text-6xl md:text-8xl",
          )}
        >
          <Sized pct={content.sizes?.heroTitle}>{content.heroTitle}</Sized>
        </h1>
        <p
          className={cn(
            "max-w-md text-white/85",
            preview ? "mt-2 line-clamp-2 text-xs" : "mt-4 text-sm md:text-base",
          )}
        >
          <Sized pct={content.sizes?.heroSub}>{content.heroSub}</Sized>
        </p>
        {preview ? (
          <span className="btn-glass mt-3 min-h-8 self-start !px-3 !py-1.5 !text-[0.65rem]">{label}</span>
        ) : (
          <Link to="/shop" search={{ cat: content.heroCat }} className="btn-glass mt-8 self-start">
            {label}
          </Link>
        )}
        {sets.map((set, s) =>
          set.imgs.length > 1 ? (
            <div
              key={s}
              className={cn(
                "absolute flex gap-2",
                set.cls,
                preview ? "end-4 bottom-4" : "end-4 bottom-12 md:end-8 md:bottom-14",
              )}
            >
              {set.imgs.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Image ${i + 1}`}
                  tabIndex={preview ? -1 : 0}
                  onClick={() => setTick(i)}
                  className={cn(
                    "h-0.5 w-8 transition-colors",
                    i === tick % set.imgs.length ? "bg-white" : "bg-white/30 hover:bg-white/60",
                  )}
                />
              ))}
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}

/** Scales the text inside an element by a percentage of the element's normal font size. */
export function Sized({ pct, children }: { pct?: number; children: React.ReactNode }) {
  if (!pct || pct === 100) return <>{children}</>;
  return <span style={{ fontSize: `${pct}%` }}>{children}</span>;
}

/** Tall image + text. Image and button follow the linked product. */
export function FeatureSection({
  content,
  lang,
  products,
  preview = false,
}: {
  content: SiteContent;
  lang: Lang;
  products: Product[];
  preview?: boolean;
}) {
  const product = products.find((item) => item.id === content.featureProductId);
  const cat = productCat(product);
  const label = shopLabel(lang, cat);
  const image = product?.images[0] ?? "/media/crest-1.jpg";

  return (
    <section className={cn("grid border-t border-line", preview ? "grid-cols-2" : "md:grid-cols-2")}>
      <img
        src={image}
        alt={product?.name ?? ""}
        className={cn(
          "w-full object-cover",
          preview ? "aspect-garment" : "aspect-garment md:aspect-auto md:h-full",
        )}
      />
      <div
        className={cn(
          "flex flex-col justify-center",
          preview ? "gap-3 p-4" : "gap-6 px-6 py-16 md:px-16",
        )}
      >
        <p
          className={cn(
            "font-display tracking-brand text-muted uppercase",
            preview ? "text-[0.6rem]" : "text-xs",
          )}
        >
          <Sized pct={content.sizes?.featureKicker}>{content.featureKicker}</Sized>
        </p>
        <h2
          className={cn(
            "font-display leading-none uppercase",
            preview ? "text-xl" : "text-4xl md:text-6xl",
          )}
        >
          <Sized pct={content.sizes?.featureTitle}>{content.featureTitle}</Sized>
        </h2>
        <p className={cn("max-w-md text-muted", preview ? "line-clamp-4 text-xs" : "")}>
          <Sized pct={content.sizes?.featureBody}>{content.featureBody}</Sized>
        </p>
        {preview ? (
          <span className="btn-line min-h-8 self-start px-3 py-1.5 text-[0.65rem]">{label}</span>
        ) : (
          <Link to="/shop" search={{ cat }} className="btn-line self-start">
            {label}
          </Link>
        )}
      </div>
    </section>
  );
}
