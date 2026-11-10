import {
  fetchPaymentSettings,
  fetchProductsFromDatabase,
  fetchSiteContentFromDatabase,
  trackVisit,
} from "@/lib/db-service";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Send,
  ShoppingBag,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { ProductCard } from "@/components/store/product-card";
import { StoreGate, useStoreGate } from "@/components/store/store-gate";
import {
  CATALOG_VERSION,
  cloneSeed,
  defaultSettings,
  matchesCat,
  money,
  NAV,
  STORE_MAP_URL,
  catLabel,
  normalizeContent,
  sizeLeft,
  type CartLine,
} from "@/lib/store/catalog";
import { useI18n, useLang } from "@/lib/i18n";
import { useOwl } from "@/lib/store/owl-store";
import { refreshProducts } from "@/lib/store/refresh";
import { cn } from "@/lib/utils";

export function Shell() {
  const lang = useOwl((state) => state.lang);
  const setLang = useOwl((state) => state.setLang);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const theme = useOwl((state) => state.theme);
  const cartOpen = useOwl((state) => state.cartOpen);
  const searchOpen = useOwl((state) => state.searchOpen);
  const setCartOpen = useOwl((state) => state.setCartOpen);
  const setSearchOpen = useOwl((state) => state.setSearchOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (isAdmin) {
      // The admin is always Arabic — don't touch the customer's saved language.
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
      return;
    }
    useLang.getState().setLang(lang);
  }, [lang, isAdmin]);
  const count = useOwl((state) => state.cart.reduce((sum, line) => sum + line.qty, 0));

  useEffect(() => {
    let live = true;
    void Promise.resolve(useOwl.persist.rehydrate()).finally(() => {
      if (!live) return;
      const state = useOwl.getState();
      if (state.catalogVersion !== CATALOG_VERSION) {
        useOwl.setState({
          products: cloneSeed(),
          settings: {
            ...defaultSettings,
            shamCashId: state.settings.shamCashId || defaultSettings.shamCashId,
            shamCashName: state.settings.shamCashName || defaultSettings.shamCashName,
            shamCashQr: state.settings.shamCashQr,
            telegramBotToken: state.settings.telegramBotToken,
            telegramChatId: state.settings.telegramChatId,
            adminPin: state.settings.adminPin || defaultSettings.adminPin,
            storePassword: state.settings.storePassword,
            storePasswordEnabled: state.settings.storePasswordEnabled,
          },
          catalogVersion: CATALOG_VERSION,
          hydrated: true,
        });
      } else {
        useOwl.setState({ hydrated: true });
      }
      void fetchProductsFromDatabase().then((rows) => {
        if (live && rows.length) useOwl.setState({ products: rows });
      });
      // Sham Cash account + QR set by the admin (so every customer sees the same ones)
      void fetchPaymentSettings().then((pay) => {
        if (!live || !pay) return;
        useOwl.setState((current) => ({
          settings: {
            ...current.settings,
            ...(pay.shamCashId ? { shamCashId: String(pay.shamCashId) } : {}),
            ...(pay.shamCashName ? { shamCashName: String(pay.shamCashName) } : {}),
            shamCashQr: typeof pay.shamCashQr === "string" ? pay.shamCashQr : "",
          },
        }));
      });
      void fetchSiteContentFromDatabase().then((content) => {
        if (!live || !content) return;
        useOwl.setState((current) => ({
          settings: { ...current.settings, content: normalizeContent(content) },
        }));
      });
    });
    return () => {
      live = false;
    };
  }, []);

  // Daily visitors counter: once per day per browser, never from the admin pages.
  useEffect(() => {
    if (isAdmin) return;
    void trackVisit();
  }, [isAdmin]);

  // Customers see sold-out sizes without reloading: refresh stock every minute and when the tab returns.
  useEffect(() => {
    if (isAdmin) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && useOwl.getState().hydrated) void refreshProducts();
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isAdmin]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f4f1ea" : "#0c0c0c");
  }, [theme]);

  useEffect(() => {
    const effective = isAdmin ? "ar" : lang;
    document.documentElement.lang = effective;
    document.documentElement.dir = effective === "ar" ? "rtl" : "ltr";
  }, [lang, isAdmin]);

  useEffect(() => {
    const locked = cartOpen || searchOpen || menuOpen;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen, searchOpen, menuOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setCartOpen(false);
      setSearchOpen(false);
      setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCartOpen, setSearchOpen]);

  // Store password: customers must type it before seeing the shop (the admin pages are never gated).
  const gate = useStoreGate(isAdmin);
  if (!isAdmin && gate.status !== "open") {
    return (
      <>
        {gate.status === "locked" ? <StoreGate onUnlock={gate.unlock} /> : <div className="min-h-screen" />}
        <Toaster theme={theme} position="bottom-center" />
      </>
    );
  }

  return (
    <>
      {isAdmin ? null : (
        <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-fg focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      {/* Tap-outside layer for the mobile menu */}
      {menuOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          className="fixed inset-0 z-20 cursor-default lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      {/* Floating glass header — zero height so the page (hero) shows through behind it */}
      <div className="sticky top-0 z-30 h-0" dir="ltr">
        <div className="px-3 pt-2 lg:px-5">
          <div className="text-black max-lg:overflow-visible lg:overflow-hidden lg:rounded-xl lg:bg-black/40 lg:text-white lg:shadow-lg lg:backdrop-blur-xl lg:backdrop-saturate-150">
            <header className="px-0 lg:px-6">
              {/* Mobile: round burger (left) · round language, theme, search, bag (right). No brand here. */}
              <div className="flex items-center justify-between py-1.5 lg:hidden">
                <button
                  type="button"
                  className={ROUND}
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
                <HeaderControls round count={count} onOpen={() => setMenuOpen(false)} />
              </div>
              {/* Desktop: logo | nav | controls */}
              <div className="hidden min-h-[85px] grid-cols-[1fr_auto_1fr] items-center gap-6 py-3 lg:grid">
                <div className="flex items-center justify-start">
                  <Link
                    to="/"
                    className="font-display text-4xl font-bold tracking-widest whitespace-nowrap text-white uppercase"
                  >
                    Athar &amp; Owl
                  </Link>
                </div>
                <nav className="lg:max-w-[min(68vw,1300px)]">
                  <NavLinks />
                </nav>
                <div className="flex items-center justify-end gap-4">
                  <HeaderControls count={count} onOpen={() => setMenuOpen(false)} />
                </div>
              </div>
            </header>
            <MobileMenu open={menuOpen} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      </div>
        </>
      )}
      <main id="main" className={isAdmin ? "pt-6" : pathname === "/" ? "" : "pt-32 lg:pt-44"}>
        <Outlet />
      </main>
      {isAdmin ? null : (
        <>
          <Footer />
          <SearchPanel />
          <CartDrawer />
        </>
      )}
      <Toaster theme={theme} position="bottom-center" />
    </>
  );
}

const ROUND =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-black shadow-md backdrop-blur-xl";

/** Language · theme · search · cart — same size and same gap, identical in Arabic and English. */
function HeaderControls({
  count,
  onOpen,
  round = false,
}: {
  count: number;
  onOpen: () => void;
  round?: boolean;
}) {
  const lang = useOwl((state) => state.lang);
  const setLang = useOwl((state) => state.setLang);
  const setCartOpen = useOwl((state) => state.setCartOpen);
  const setSearchOpen = useOwl((state) => state.setSearchOpen);
  const ring = round ? ROUND : "inline-flex size-9 w-[30px] shrink-0 items-center justify-center lg:w-9";
  const plain = round
    ? cn(ROUND, "relative")
    : "relative inline-flex size-9 w-[30px] shrink-0 items-center justify-center lg:w-9";
  return (
    <div className={cn("flex items-center", round ? "gap-2" : "gap-0 lg:gap-1.5")} dir="ltr">
      <button
        type="button"
        className={ring}
        aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        title={lang === "ar" ? "English" : "العربية"}
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      >
        {lang === "ar" ? (
          <CenteredGlyph className="font-sans text-[13px] font-bold tracking-normal">EN</CenteredGlyph>
        ) : (
          <CenteredGlyph className="font-sans text-[18px] font-semibold">ع</CenteredGlyph>
        )}
      </button>
      <button
        type="button"
        className={plain}
        aria-label="Search"
        onClick={() => {
          onOpen();
          setSearchOpen(true);
        }}
      >
        <Search className="size-5" />
      </button>
      <button
        type="button"
        className={plain}
        aria-label={`Bag, ${count} items`}
        onClick={() => {
          onOpen();
          setCartOpen(true);
        }}
      >
        <ShoppingBag className="size-5" />
        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-black px-1 text-center text-[11px] leading-4 font-semibold tabular-nums text-white lg:bg-white lg:text-black">
            {count}
          </span>
        ) : null}
      </button>
    </div>
  );
}

/**
 * Centers a glyph by its real ink box (Arabic letters like ع sit off-center in their line box).
 * Measures the glyph with canvas once fonts are ready and nudges it vertically.
 */
function CenteredGlyph({ children, className }: { children: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [dy, setDy] = useState(0);

  useEffect(() => {
    let live = true;
    const measure = () => {
      const el = ref.current;
      const ctx = document.createElement("canvas").getContext("2d");
      if (!live || !el || !ctx) return;
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(children);
      const fa = m.fontBoundingBoxAscent;
      const fd = m.fontBoundingBoxDescent;
      const up = m.actualBoundingBoxAscent;
      const down = m.actualBoundingBoxDescent;
      if (![fa, fd, up, down].every((n) => Number.isFinite(n))) return;
      const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
      const baseline = (line - (fa + fd)) / 2 + fa;
      const inkCenter = baseline - (up - down) / 2;
      setDy(Math.round((line / 2 - inkCenter) * 10) / 10);
    };
    measure();
    void document.fonts?.ready.then(measure);
    document.fonts?.addEventListener?.("loadingdone", measure);
    return () => {
      live = false;
      document.fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [children]);

  return (
    <span
      ref={ref}
      className={cn("block leading-none", className)}
      style={{ transform: `translateY(${dy}px)` }}
    >
      {children}
    </span>
  );
}

/** Desktop nav: categories on row 1 (and row 2 if there are more than 5), Privacy always on row 3. */
function NavLinks() {
  const lang = useOwl((state) => state.lang);
  const href = useRouterState({ select: (state) => state.location.href });
  const ar = lang === "ar";
  const linkClass = (active: boolean) =>
    cn(
      "font-sans font-semibold tracking-normal whitespace-nowrap text-white uppercase transition-opacity duration-200 hover:opacity-70",
      ar ? "text-[clamp(14px,1vw,18px)]" : "text-[clamp(12px,0.78vw,15px)]",
      active && "underline decoration-2 underline-offset-[6px]",
    );
  const rowClass =
    "flex flex-wrap items-center justify-center gap-x-[clamp(1.25rem,3.9vw,5rem)] gap-y-6";
  const cats = NAV;
  const catRows = [cats.slice(0, 5), cats.slice(5)].filter((row) => row.length > 0);
  return (
    <div className="flex flex-col items-center gap-y-6">
      {catRows.map((row, rowIndex) => (
        <div key={rowIndex} className={rowClass}>
          {row.map((item) => (
            <Link
              key={item.cat}
              to="/shop"
              search={{ cat: item.cat }}
              className={linkClass(href.includes(`cat=${item.cat}`))}
            >
              {catLabel(lang, item.cat)}
            </Link>
          ))}
        </div>
      ))}
      <div className={rowClass}>
        <Link to="/privacy" className={linkClass(href.startsWith("/privacy"))}>
          {ar ? "سياسة الخصوصية" : "Privacy Policy"}
        </Link>
      </div>
    </div>
  );
}

/** Expands inside the same glass bar (Trikko style): links stacked under the header row. */
function MobileMenu({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const lang = useOwl((state) => state.lang);
  const cats = NAV;
  const item =
    "block py-3 font-sans text-[16px] font-medium tracking-[0.08em] text-black uppercase transition-opacity active:opacity-60";
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out lg:hidden",
        open ? "mt-2 grid-rows-[1fr] rounded-xl bg-white/90 shadow-lg backdrop-blur-xl" : "grid-rows-[0fr]",
      )}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden rounded-xl">
        <nav
          dir={lang === "ar" ? "rtl" : "ltr"}
          className="max-h-[calc(100svh-11rem)] overflow-y-auto border-t border-black/15 px-6 pt-2 pb-6"
        >
          {cats.map((c) => (
            <Link key={c.cat} to="/shop" search={{ cat: c.cat }} onClick={onNavigate} className={item}>
              {catLabel(lang, c.cat)}
            </Link>
          ))}
          <Link to="/privacy" onClick={onNavigate} className={item}>
            {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
          </Link>
        </nav>
      </div>
    </div>
  );
}

const SOCIALS = [
  {
    href: "https://www.instagram.com/owlstore2025?utm_source=ig_web_button_share_sheet&psln=ZDNlZDc0MzIxNw==",
    label: "Instagram",
    Icon: Instagram,
  },
  { href: "https://whatsapp.com/channel/0029VbDV6td5EjxrBOYS1V2U", label: "WhatsApp", Icon: MessageCircle },
  { href: "https://t.me/owlstore2025", label: "Telegram", Icon: Send },
];

function Footer() {
  const { t, lang, dir } = useI18n();

  return (
    <footer className="border-t border-line">
      <div dir="ltr" className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-12 md:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:col-span-12 md:grid-cols-3">
          <div dir={dir}>
            <p className="font-display text-xs tracking-brand text-muted uppercase">{t("footer.shop")}</p>
            <ul className="mt-5 flex flex-col gap-3 font-display text-sm tracking-widest uppercase">
              {NAV.map((item) => (
                <li key={item.cat}>
                  <Link to="/shop" search={{ cat: item.cat }} className="hover:opacity-60">
                    {catLabel(lang, item.cat)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div dir={dir}>
            <p className="font-display text-xs tracking-brand text-muted uppercase">{t("footer.house")}</p>
            <ul className="mt-5 flex flex-col gap-3 font-display text-sm tracking-widest uppercase">
              <li>
                <Link to="/privacy" className="hover:opacity-60">
                  {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
                </Link>
              </li>
            </ul>
            <p className="mt-5 text-sm text-muted">{t("footer.delivery")}</p>
          </div>
          <div dir={dir} className="col-span-2 max-md:border-t max-md:border-line max-md:pt-8 max-md:text-center md:col-span-1">
            <p className="font-display text-xs tracking-brand text-muted uppercase">ATHAR &amp; OWL</p>
            <p className="mt-5 max-w-xs text-sm text-muted max-md:mx-auto">
              The Owl has already seen your future look
              <br />
              Sharp vision, premium quality
            </p>
            <a
              href={STORE_MAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm hover:opacity-60"
            >
              <MapPin className="size-4 shrink-0" />
              {t("footer.map")}
            </a>
            <div className="mt-5 flex items-center gap-2 max-md:justify-center">
              {SOCIALS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-fg/60 transition-colors hover:bg-fg hover:text-bg"
                >
                  <Icon className="size-[18px]" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SearchPanel() {
  const open = useOwl((state) => state.searchOpen);
  const setSearchOpen = useOwl((state) => state.setSearchOpen);
  const products = useOwl((state) => state.products);
  const { t, productName } = useI18n();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const needle = query.trim().toLowerCase();
  const results = needle
    ? products.filter((product) =>
        `${product.name} ${productName(product)}`.toLowerCase().includes(needle),
      )
    : products.filter((product) => matchesCat(product, "new"));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 md:px-8">
        <Search className="size-5 shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search.placeholder")}
          className="w-full bg-transparent font-display text-2xl uppercase outline-none placeholder:text-muted md:text-4xl"
          aria-label={t("a11y.searchProducts")}
        />
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center"
          aria-label={t("a11y.closeSearch")}
          onClick={() => setSearchOpen(false)}
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-3 gap-y-10 px-4 pb-16 md:grid-cols-4 md:px-8">
        {results.length === 0 ? (
          <p className="col-span-full text-muted">{t("search.empty")}</p>
        ) : (
          results.map((product) => (
            <div key={product.id} onClick={() => setSearchOpen(false)}>
              <ProductCard product={product} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CartDrawer() {
  const open = useOwl((state) => state.cartOpen);
  const setCartOpen = useOwl((state) => state.setCartOpen);
  const cart = useOwl((state) => state.cart);
  const products = useOwl((state) => state.products);
  const setQty = useOwl((state) => state.setQty);
  const removeLine = useOwl((state) => state.removeLine);
  const { t, productName, colorLabel } = useI18n();

  const rows = cart
    .map((line) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product) return null;
      const color = product.colors.find((item) => item.id === line.colorId);
      return { line, product, colorName: color ? colorLabel(product, color) : "—" };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.line.qty, 0);

  return (
    <>
      <button
        type="button"
        aria-label={t("a11y.closeBag")}
        className={cn(
          "fixed inset-0 z-40 bg-bg/70 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setCartOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-bg transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-sm tracking-brand uppercase">{t("cart.title")}</h2>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center"
            aria-label={t("a11y.closeBag")}
            onClick={() => setCartOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {rows.length === 0 ? (
            <div className="flex h-full flex-col items-start justify-center gap-4">
              <p className="text-muted">{t("cart.empty")}</p>
              <Link to="/shop" search={{ cat: "all" }} className="btn-line" onClick={() => setCartOpen(false)}>
                {t("cart.shopDrop")}
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-5">
              {rows.map(({ line, product, colorName }) => (
                <CartRow
                  key={`${line.productId}-${line.size}-${line.fit}-${line.colorId}`}
                  line={line}
                  name={productName(product)}
                  image={
                    product.images[Math.max(0, product.colors.findIndex((c) => c.id === line.colorId))] ||
                    product.images[0] ||
                    "/products/navy-jacket.webp"
                  }
                  price={product.price}
                  colorName={colorName}
                  max={product.soldOut ? line.qty : sizeLeft(product, line.size, line.colorId) || line.qty}
                  onQty={(qty) => setQty(line, qty)}
                  onRemove={() => removeLine(line)}
                />
              ))}
            </ul>
          )}
        </div>
        {rows.length > 0 ? (
          <div className="border-t border-line px-5 py-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{t("cart.subtotal")}</span>
              <span className="tabular-nums">{money(subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{t("cart.shippingNote")}</p>
            <Link
              to="/checkout"
              className="btn-solid mt-4 w-full"
              onClick={() => setCartOpen(false)}
            >
              {t("cart.checkout")}
            </Link>
          </div>
        ) : null}
      </aside>
    </>
  );
}

function CartRow({
  line,
  name,
  image,
  price,
  colorName,
  max,
  onQty,
  onRemove,
}: {
  line: CartLine;
  name: string;
  image: string;
  price: number;
  colorName: string;
  max: number;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const { t, fitLabel } = useI18n();
  return (
    <li className="flex gap-3">
      <img src={image} alt="" width={160} height={214} className="aspect-garment w-16 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm">{name}</p>
          <p className="text-sm tabular-nums">{money(price * line.qty)}</p>
        </div>
        <p className="mt-2 text-xs text-muted">{t("cart.qtyLabel")}</p>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center border border-line"
            aria-label={t("a11y.decrease")}
            onClick={() => onQty(line.qty - 1)}
          >
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center text-base tabular-nums">{line.qty}</span>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center border border-line"
            aria-label={t("a11y.increase")}
            disabled={line.qty >= max}
            onClick={() => onQty(line.qty + 1)}
          >
            <Plus className="size-4" />
          </button>
          <button type="button" className="ms-auto text-xs text-muted" onClick={onRemove}>
            {t("cart.remove")}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {line.size} · {fitLabel(line.fit)} · {colorName}
        </p>
      </div>
    </li>
  );
}
