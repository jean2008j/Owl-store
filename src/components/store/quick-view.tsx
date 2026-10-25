import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { money, sizeLeft, SIZES, visibleSizes, type Fit, type Product, type Size } from "@/lib/store/catalog";
import { useI18n } from "@/lib/i18n";
import { lineQtyInCart, useOwl } from "@/lib/store/owl-store";
import { cn } from "@/lib/utils";

/**
 * "View details" card: product pictures with left/right arrows on top, then colour (left) and
 * size (right), then a button that goes to checkout once both are chosen.
 */
export function QuickView({
  product,
  onClose,
  page = false,
}: {
  product: Product;
  onClose: () => void;
  /** Render as a normal full page (mobile product page) instead of a popup card. */
  page?: boolean;
}) {
  const { t, isAr, dir, productName, productDescription, colorLabel, fitLabel } = useI18n();
  const addLine = useOwl((state) => state.addLine);
  const cart = useOwl((state) => state.cart);

  const images = product.images.length ? product.images : ["/media/night-1.jpg"];
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState<Size | null>(null);
  // a single colour is chosen for the customer; with several colours they must pick one
  const [colorId, setColorId] = useState<string | null>(
    product.colors.length === 1 ? product.colors[0].id : null,
  );
  const [fit, setFit] = useState<Fit | null>(product.fits[0] ?? null);
  const touchX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);
  // the arrows keep their physical side; in Arabic the left arrow moves forward
  const leftStep = isAr ? 1 : -1;

  useEffect(() => {
    const previous = document.body.style.overflow;
    if (!page) {
      closeRef.current?.focus();
      document.body.style.overflow = "hidden";
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") go(leftStep);
      if (event.key === "ArrowRight") go(-leftStep);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      if (!page) document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftStep, images.length]);

  const color = product.colors.find((item) => item.id === colorId) ?? null;
  const ready = Boolean(size && color && fit);
  // The size is chosen after the colour: until a colour is picked there is nothing to choose.
  const hint = !color ? t("quick.pickColorFirst") : !size ? t("quick.pickSize") : t("quick.pickColor");

  // Pieces of this colour+size already in the bag (all fits share the same stock).
  const inBagOf = (cid: string, sz: Size) =>
    cart
      .filter((line) => line.productId === product.id && line.colorId === cid && line.size === sz)
      .reduce((sum, line) => sum + line.qty, 0);
  const leftOf = (cid: string, sz: Size) => sizeLeft(product, sz, cid) - inBagOf(cid, sz);
  const colorGone = (cid: string) => SIZES.every((sz) => sizeLeft(product, sz, cid) <= 0);

  function pickColor(id: string, i: number) {
    setColorId(id);
    // keep the chosen size only if this colour still has it
    setSize((current) => (current && leftOf(id, current) > 0 ? current : null));
    if (images[i]) setIndex(i); // colour N follows picture N
  }

  function proceed() {
    if (!size || !color || !fit) return;
    const inBag = lineQtyInCart(cart, { productId: product.id, size, fit, colorId: color.id });
    if (sizeLeft(product, size, color.id) < inBag + 1) {
      toast(t("product.sizeGone"));
      return;
    }
    // Add to the cart and open it; the customer continues to checkout from there.
    addLine({ productId: product.id, size, fit, colorId: color.id, qty: 1 });
    onClose();
  }

  const arrow =
    "absolute top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)] transition-colors hover:text-white";

  const card = (
    <div
      role={page ? undefined : "dialog"}
      aria-modal={page ? undefined : "true"}
      aria-label={productName(product)}
      dir={dir}
      className={cn(
        "relative w-full max-w-sm bg-bg text-fg",
        page
          ? "mx-auto overflow-hidden rounded-2xl border border-line"
          : "h-[min(94vh,860px)] overflow-hidden rounded-2xl border border-line shadow-2xl",
      )}
    >
        <div
          className={cn(
            "flex flex-col",
            !page && "no-scrollbar h-full overflow-y-auto overscroll-contain",
          )}
        >
        {/* 1. Pictures with arrows */}
        <div
          className={cn(
            "relative overflow-hidden bg-surface",
            page ? "aspect-[3/4] w-full" : "min-h-[16rem] flex-1",
          )}
          onTouchStart={(event) => {
            touchX.current = event.touches[0].clientX;
          }}
          onTouchEnd={(event) => {
            if (touchX.current == null) return;
            const dx = event.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 40) go(dx > 0 ? leftStep : -leftStep);
          }}
        >
          <img
            src={images[index]}
            alt={productName(product)}
            draggable={false}
            className={cn(
              "absolute inset-0 h-full w-full",
              page ? "object-contain" : "object-cover",
            )}
          />
          <button
            ref={closeRef}
            type="button"
            aria-label={t("quick.close")}
            title={t("quick.close")}
            onClick={onClose}
            className="absolute end-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-bg/85 text-fg shadow hover:bg-fg hover:text-bg"
          >
            <X className="size-4" />
          </button>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label={t(isAr ? "quick.next" : "quick.prev")}
                className={cn(arrow, "left-1")}
                onClick={() => go(leftStep)}
              >
                <ChevronLeft className="size-9" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label={t(isAr ? "quick.prev" : "quick.next")}
                className={cn(arrow, "right-1")}
                onClick={() => go(-leftStep)}
              >
                <ChevronRight className="size-9" strokeWidth={1.5} />
              </button>
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className={cn("size-1.5 rounded-full shadow", i === index ? "bg-white" : "bg-white/45")}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {/* name + price */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <h3 className="min-w-0 text-base leading-snug">{productName(product)}</h3>
          <p className="shrink-0 text-sm tabular-nums">
            {product.compareAt != null && product.compareAt > product.price ? (
              <span className="me-2 text-muted line-through">{money(product.compareAt)}</span>
            ) : null}
            <span>{money(product.price)}</span>
          </p>
        </div>

        {productDescription(product).trim() ? (
          <p className="whitespace-pre-line px-5 pt-3 text-sm leading-relaxed text-muted">
            {productDescription(product)}
          </p>
        ) : null}

        {/* 2. Colour on the left, size on the right */}
        <div dir="ltr" className="grid grid-cols-2 gap-5 px-5 pt-5">
          <div dir={dir}>
            <p className="field-label">{t("product.color")}</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((item, i) => {
                const gone = product.soldOut || colorGone(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={colorLabel(product, item)}
                    aria-pressed={colorId === item.id}
                    title={gone ? `${colorLabel(product, item)} — ${t("quick.colorGone")}` : colorLabel(product, item)}
                    disabled={gone}
                    onClick={() => pickColor(item.id, i)}
                    className={cn(
                      "relative size-9 overflow-hidden rounded-full border border-fg/40 transition-shadow",
                      colorId === item.id && "ring-2 ring-fg ring-offset-2 ring-offset-bg",
                      gone && "cursor-not-allowed opacity-40",
                    )}
                    style={{ backgroundColor: item.hex }}
                  >
                    {gone ? (
                      <span className="absolute left-1/2 top-1/2 h-0.5 w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-red-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 min-h-4 text-xs text-muted">{color ? colorLabel(product, color) : ""}</p>
          </div>
          <div dir={dir}>
            <p className="field-label">{t("product.size")}</p>
            <div className="grid grid-cols-3 gap-2">
              {visibleSizes(product, colorId).map((item) => {
                // no colour yet → nothing to pick (greyed, not struck); colour chosen → sold-out sizes are struck through
                const open = color ? leftOf(color.id, item) > 0 : false;
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={!open}
                    aria-pressed={size === item}
                    onClick={() => setSize(item)}
                    className={
                      size === item
                        ? "min-h-10 bg-fg text-sm text-bg"
                        : cn(
                            "min-h-10 border border-line text-sm text-fg disabled:text-muted",
                            color ? "disabled:line-through" : "disabled:opacity-40",
                          )
                    }
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {product.fits.length > 1 ? (
          <div className="px-5 pt-4">
            <p className="field-label">{t("product.fit")}</p>
            <div className="flex flex-wrap gap-2">
              {product.fits.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={fit === item}
                  onClick={() => setFit(item)}
                  className={
                    fit === item
                      ? "min-h-10 bg-fg px-3 text-sm text-bg"
                      : "min-h-10 border border-line px-3 text-sm text-fg"
                  }
                >
                  {fitLabel(item)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* 3. Add to cart */}
        <div className="px-5 pt-5 pb-5">
          {ready ? null : <p className="mb-2 text-center text-xs text-muted">{hint}</p>}
          <button
            type="button"
            className="btn-solid w-full disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!ready}
            onClick={proceed}
          >
            {t("quick.continue")}
          </button>
        </div>
        </div>
    </div>
  );

  if (page) return card;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-3"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {card}
    </div>,
    document.body,
  );
}
