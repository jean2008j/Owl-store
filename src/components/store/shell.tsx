import { fetchPaymentSettings, fetchProductsFromDatabase, fetchSiteContentFromDatabase } from "@/lib/db-service";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { ProductCard } from "@/components/store/product-card";
import {
  CATALOG_VERSION,
  cloneSeed,
  defaultSettings,
  matchesCat,
  money,
  NAV,
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
  const setTheme = useOwl((state) => state.setTheme);
  const announcement = useOwl((state) => state.settings.content[state.lang].announcement);
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
          <div className="overflow-hidden rounded-xl bg-white/75 text-black shadow-lg backdrop-blur-xl backdrop-saturate-150 lg:bg-black/40 lg:text-white">
            <Announcement text={announcement} />
            <header className="px-3 lg:px-6">
              {/* Mobile: burger (far left) · brand (centre) · language, theme, search, bag (bag far right) */}
              <div className="flex items-center py-1.5 lg:hidden">
                <button
                  type="button"
                  className="inline-flex size-9 shrink-0 items-center justify-center"
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
                </button>
                {/* centred in the free space between the burger and the controls */}
                <div className="flex min-w-0 flex-1 justify-center">
                  <Link
                    to="/"
                    className="-translate-y-[2px] font-display text-[17px] leading-none font-semibold tracking-[0.12em] whitespace-nowrap text-black uppercase"
                    onClick={() => setMenuOpen(false)}
                  >
                    Athar &amp; Owl
                  </Link>
                </div>
                <HeaderControls count={count} onOpen={() => setMenuOpen(false)} />
              </div>
              {/* Mobile: scrollable category strip under the brand row */}
              <div className="lg:hidden">
                <MobileCategoryBar onNavigate={() => setMenuOpen(false)} />
              </div>
              {/* Desktop: logo | nav | controls */}
              <div className="hidden min-h-[85px] grid-cols-[1fr_auto_1fr] items-center gap-6 py-3 lg:grid">
                <div className="flex items-center justify-start">
                  <Link
                    to="/"
                    className="font-display text-2xl font-semibold tracking-widest whitespace-nowrap text-white uppercase"
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

/** Language · theme · search · cart — same size and same gap, identical in Arabic and English. */
function HeaderControls({ count, onOpen }: { count: number; onOpen: () => void }) {
  const lang = useOwl((state) => state.lang);
  const setLang = useOwl((state) => state.setLang);
  const theme = useOwl((state) => state.theme);
  const setTheme = useOwl((state) => state.setTheme);
  const setCartOpen = useOwl((state) => state.setCartOpen);
  const setSearchOpen = useOwl((state) => state.setSearchOpen);
  const ring = "inline-flex size-9 w-[30px] shrink-0 items-center justify-center lg:w-9";
  const plain = "relative inline-flex size-9 w-[30px] shrink-0 items-center justify-center lg:w-9";
  return (
    <div className="flex items-center gap-0 lg:gap-1.5" dir="ltr">
      <button
        type="button"
        className={ring}
        aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        title={lang === "ar" ? "English" : "العربية"}
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      >
        {lang === "ar" ? (
          <CenteredGlyph className="font-sans text-[12px] font-bold tracking-normal">EN</CenteredGlyph>
        ) : (
          <CenteredGlyph className="font-sans text-[17px] font-semibold">ع</CenteredGlyph>
        )}
      </button>
      <button
        type="button"
        className={ring}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
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
          <span className="absolute top-0 right-0 min-w-4 rounded-full bg-black px-1 text-center text-[10px] leading-4 font-semibold tabular-nums text-white lg:bg-white lg:text-black">
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

function Announcement({ text }: { text: string }) {
  const line = text.trim() || "OWL STORE";
  return (
    <div className="overflow-hidden bg-black text-white" dir="ltr">
      <div className="owl-marquee flex w-max">
        <MarqueeCopy line={line} />
        <MarqueeCopy line={line} />
      </div>
    </div>
  );
}

function MarqueeCopy({ line }: { line: string }) {
  return (
    <p className="flex shrink-0 items-center gap-12 px-6 py-2 font-sans text-xs font-bold tracking-wide uppercase">
      {Array.from({ length: 4 }, (_, index) => (
        <span key={index} className="whitespace-nowrap">
          {line}
        </span>
      ))}
    </p>
  );
}

/** Mobile category strip (Trikko style): one swipeable row with small arrows when there is more to see. */
function MobileCategoryBar({ onNavigate }: { onNavigate: () => void }) {
  const lang = useOwl((state) => state.lang);
  const href = useRouterState({ select: (state) => state.location.href });
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const ar = lang === "ar";
  const cats = [{ cat: "all" as const }, ...NAV];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      // normalise so 0 is always the visual left end (RTL scrollLeft runs from -max to 0)
      const x = ar ? el.scrollLeft + max : el.scrollLeft;
      setEdge({ left: x > 2, right: x < max - 2 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    void document.fonts?.ready.then(update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ar, lang]);

  const nudge = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
  const arrow =
    "absolute inset-y-0 z-10 inline-flex w-6 items-center justify-center text-black/70";

  return (
    <div className="relative border-t border-black/10" dir="ltr">
      {edge.left ? (
        <button type="button" aria-label="Scroll left" className={cn(arrow, "left-0")} onClick={() => nudge(-1)}>
          <ChevronLeft className="size-4" />
        </button>
      ) : null}
      <div
        ref={ref}
        dir={ar ? "rtl" : "ltr"}
        className="no-scrollbar flex items-center overflow-x-auto px-2"
      >
        {cats.map((item) => {
          const active = href.includes(`cat=${item.cat}`);
          return (
            <Link
              key={item.cat}
              to="/shop"
              search={{ cat: item.cat }}
              onClick={onNavigate}
              className={cn(
                "shrink-0 px-3.5 py-2 font-sans font-semibold whitespace-nowrap text-black uppercase",
                ar ? "text-[13px]" : "text-[11.5px] tracking-wide",
                active && "underline decoration-2 underline-offset-[6px]",
              )}
            >
              {catLabel(lang, item.cat)}
            </Link>
          );
        })}
      </div>
      {edge.right ? (
        <button type="button" aria-label="Scroll right" className={cn(arrow, "right-0")} onClick={() => nudge(1)}>
          <ChevronRight className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Desktop nav: categories split 5 + 5 over rows 1 and 2, Our Story + Privacy + Secret always on row 3. */
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
  const cats = [{ cat: "all" as const }, ...NAV];
  const catRows = [cats.slice(0, 5), cats.slice(5)];
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
        <Link to="/story" className={linkClass(href.startsWith("/story"))}>
          {ar ? "قصّتنا" : "Our Story"}
        </Link>
        <Link to="/privacy" className={linkClass(href.startsWith("/privacy"))}>
          {ar ? "سياسة الخصوصية" : "Privacy Policy"}
        </Link>
        <Link to="/secret" className={linkClass(href.startsWith("/secret"))}>
          {ar ? "القسم السري" : "Secret Section"}
        </Link>
      </div>
    </div>
  );
}

/** Expands inside the same glass bar (Trikko style): links stacked under the header row. */
function MobileMenu({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const lang = useOwl((state) => state.lang);
  const cats = [{ cat: "all" as const }, ...NAV];
  const item =
    "block py-3 font-sans text-[15px] font-medium tracking-[0.08em] text-black uppercase transition-opacity active:opacity-60";
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out lg:hidden",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <nav
          dir={lang === "ar" ? "rtl" : "ltr"}
          className="max-h-[calc(100svh-11rem)] overflow-y-auto border-t border-black/15 px-6 pt-2 pb-6"
        >
          {cats.map((c) => (
            <Link key={c.cat} to="/shop" search={{ cat: c.cat }} onClick={onNavigate} className={item}>
              {catLabel(lang, c.cat)}
            </Link>
          ))}
          <Link to="/story" onClick={onNavigate} className={item}>
            {lang === "ar" ? "قصّتنا" : "Our Story"}
          </Link>
          <Link to="/privacy" onClick={onNavigate} className={item}>
            {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
          </Link>
          <Link to="/secret" onClick={onNavigate} className={item}>
            {lang === "ar" ? "القسم السري" : "Secret Section"}
          </Link>
        </nav>
      </div>
    </div>
  );
}

const MAP_URL = "https://maps.app.goo.gl/uwhJvvncMc3tnHaF6";
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
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <footer className="border-t border-line">
      <div dir="ltr" className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-12 md:px-8">
        <div dir={dir} className="md:col-span-5">
          <h2 className="font-display text-lg leading-snug uppercase md:text-xl">{t("footer.heading")}</h2>
          <form
            className="mt-6 flex max-w-md gap-2"
            dir="ltr"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email.includes("@")) return;
              const key = "owl-list";
              const current = JSON.parse(localStorage.getItem(key) || "[]") as string[];
              localStorage.setItem(key, JSON.stringify([...new Set([...current, email.trim()])]));
              setJoined(true);
              setEmail("");
            }}
          >
            <label className="sr-only" htmlFor="drop-email">
              {t("footer.email")}
            </label>
            <input
              id="drop-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("footer.emailPlaceholder")}
              className="field min-w-0 flex-1"
              dir={lang === "ar" ? "rtl" : "ltr"}
            />
            <button type="submit" className="btn-solid shrink-0">
              {t("footer.join")}
            </button>
          </form>
          <p className="mt-3 text-sm text-muted">
            {joined ? t("footer.joined") : t("footer.note")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:col-span-7 md:grid-cols-3">
          <div dir={dir}>
            <p className="font-display text-xs tracking-brand text-muted uppercase">{t("footer.shop")}</p>
            <ul className="mt-5 flex flex-col gap-3 font-display text-sm tracking-widest uppercase">
              {[{ cat: "all" as const }, ...NAV].map((item) => (
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
                <Link to="/story" className="hover:opacity-60">
                  {lang === "ar" ? "قصّتنا" : "Our Story"}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:opacity-60">
                  {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
                </Link>
              </li>
              <li>
                <Link to="/secret" className="hover:opacity-60">
                  {lang === "ar" ? "القسم السري" : "Secret Section"}
                </Link>
              </li>
            </ul>
            <p className="mt-5 text-sm text-muted">{t("footer.delivery")}</p>
          </div>
          <div dir={dir} className="col-span-2 max-md:border-t max-md:border-line max-md:pt-8 max-md:text-center md:col-span-1">
            <p className="font-display text-xs tracking-brand text-muted uppercase">OWL STORE</p>
            <p className="mt-5 max-w-xs text-sm text-muted max-md:mx-auto">
              The Owl has already seen your future look
              <br />
              Sharp vision, premium quality
            </p>
            <a
              href={MAP_URL}
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
  const products = useOwl((state) => state.products).filter((product) => !product.secret);
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
                  image={product.images[0] || "/media/night-1.jpg"}
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
        <p className="mt-1 text-xs text-muted">
          {line.size} · {fitLabel(line.fit)} · {colorName}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center border border-line"
            aria-label={t("a11y.decrease")}
            onClick={() => onQty(line.qty - 1)}
          >
            <Minus className="size-4" />
          </button>
          <span className="w-6 text-center text-sm tabular-nums">{line.qty}</span>
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
      </div>
    </li>
  );
}
