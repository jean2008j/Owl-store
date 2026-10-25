import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  isSoldOut,
  money,
  type Product,
} from "@/lib/store/catalog";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { QuickView } from "@/components/store/quick-view";

export function ProductCard({ product }: { product: Product }) {
  const [hot, setHot] = useState(false);
  const [quick, setQuick] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const { t, productName } = useI18n();
  const gone = isSoldOut(product);
  const cover = product.images[0] || "/media/night-1.jpg";
  const alt = product.images[1];
  const showAlt = hot && !product.video && Boolean(alt);

  return (
    <article
      className="group"
      onMouseEnter={() => {
        setHot(true);
        void videoRef.current?.play();
      }}
      onMouseLeave={() => {
        setHot(false);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
    >
      <div className="overflow-hidden rounded-2xl border border-fg/30">
      <div className="relative">
        <div
          className={cn(
            "relative block overflow-hidden bg-surface",
            !gone && "max-lg:cursor-pointer",
          )}
          onClick={() => {
            // Mobile: tapping anywhere on the picture opens the product page.
            if (gone || !window.matchMedia("(max-width: 1023px)").matches) return;
            void navigate({ to: "/product/$slug", params: { slug: product.id } });
          }}
        >
          <img
            src={cover}
            alt={productName(product)}
            width={900}
            height={1200}
            className={cn(
              "aspect-garment w-full object-cover transition-opacity duration-200",
              showAlt && "opacity-0",
            )}
          />
          {alt ? (
            <img
              src={alt}
              alt=""
              width={900}
              height={1200}
              className={cn(
                "absolute inset-0 aspect-garment h-full w-full object-cover transition-opacity duration-200",
                showAlt ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}
          {product.video ? (
            <video
              ref={videoRef}
              src={product.video}
              muted
              loop
              playsInline
              preload="none"
              poster={cover}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
                hot ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}
          {gone ? (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/55 backdrop-blur-sm">
              <span className="border border-fg/50 px-4 py-2 font-display text-xs tracking-brand text-fg uppercase">
                {t("product.soldOut")}
              </span>
            </div>
          ) : null}
          {product.compareAt != null && product.compareAt > product.price && !gone ? (
            <span className="absolute top-3 start-3 bg-fg px-2 py-1 font-display text-xs tracking-brand text-bg uppercase">
              {t("product.sale")}
            </span>
          ) : null}
        </div>
        {!gone ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center max-lg:hidden">
            <button
              type="button"
              onClick={() => setQuick(true)}
              className="pointer-events-auto rounded-full border border-fg/25 bg-bg/30 px-6 py-3 font-display text-xs tracking-brand text-fg uppercase opacity-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-md backdrop-saturate-150 transition-[opacity,background-color] duration-200 hover:bg-bg/45 focus-visible:opacity-100 group-hover:opacity-100"
            >
              {t("product.viewDetails")}
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-3 px-3 py-3">
        <div className="min-w-0">
          <h3 className="product-name text-sm leading-snug text-fg">{productName(product)}</h3>
        </div>
        <p className="shrink-0 text-sm tabular-nums">
          {product.compareAt != null && product.compareAt > product.price ? (
            <span className="mr-2 text-muted line-through">{money(product.compareAt)}</span>
          ) : null}
          <span>{money(product.price)}</span>
        </p>
      </div>
      {gone ? (
        <p className="px-3 pb-3 text-xs tracking-brand text-muted uppercase md:hidden">{t("product.soldOut")}</p>
      ) : null}
      </div>
      {quick ? <QuickView product={product} onClose={() => setQuick(false)} /> : null}
    </article>
  );
}
