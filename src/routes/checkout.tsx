import {
  fetchShippingCompanies,
  isSupabaseConfigured,
  quoteOrder,
  submitOrderToDatabase,
} from "@/lib/db-service";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { QrMark } from "@/components/store/qr-mark";
import {
  CITIES,
  DEFAULT_SHIPPING_COMPANIES,
  formatOrderText,
  makeRef,
  money,
  normalizeDigits,
  sizeLeft,
  type Order,
  type ShippingCompany,
} from "@/lib/store/catalog";
import { fileToJpegDataUrl } from "@/lib/store/images";
import { refreshProducts } from "@/lib/store/refresh";
import { useI18n, type Key } from "@/lib/i18n";
import { useOwl } from "@/lib/store/owl-store";
import { notifyOrder } from "@/lib/telegram";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — OWL STORE" }],
  }),
  component: CheckoutPage,
});

const STEPS = ["checkout.step.contact", "checkout.step.delivery", "checkout.step.pay"] as const;

const COUPON_ERRORS: Record<string, Key> = {
  COUPON_INVALID: "checkout.coupon.err.invalid",
  COUPON_NOT_STARTED: "checkout.coupon.err.notStarted",
  COUPON_EXPIRED: "checkout.coupon.err.expired",
  COUPON_USED_UP: "checkout.coupon.err.usedUp",
  COUPON_MIN_ORDER: "checkout.coupon.err.minOrder",
  COUPON_RATE_LIMITED: "checkout.coupon.err.rateLimited",
  COUPON_PHONE_USED: "checkout.coupon.err.phoneUsed",
};

type Quote = {
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  coupon: string | null;
};

function CheckoutPage() {
  const { t, isAr, productName, colorLabel, fitLabel, cityLabel } = useI18n();
  const navigate = useNavigate();
  const cart = useOwl((state) => state.cart);
  const products = useOwl((state) => state.products);
  const settings = useOwl((state) => state.settings);
  const placeOrder = useOwl((state) => state.placeOrder);

  const rows = useMemo(
    () =>
      cart
        .map((line) => {
          const product = products.find((item) => item.id === line.productId);
          if (!product) return null;
          const color = product.colors.find((item) => item.id === line.colorId);
          return { line, product, colorName: color?.name ?? "Default" };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    [cart, products],
  );

  const localSubtotal = rows.reduce((sum, row) => sum + row.product.price * row.line.qty, 0);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [receipt, setReceipt] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // One order reference per checkout visit, and a guard against a second tap while an order is being sent.
  const submitting = useRef(false);
  const orderRef = useRef<string | null>(null);

  // Shipping companies (Sila, Al-Rafidain…) are the only way to ship: the customer picks one and its flat fee applies.
  // No enabled company (or none covering the city) = the customer cannot place an order.
  const [companies, setCompanies] = useState<ShippingCompany[]>(isSupabaseConfigured ? [] : DEFAULT_SHIPPING_COMPANIES);
  const [companyId, setCompanyId] = useState("");
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [zonesTick, setZonesTick] = useState(0);
  // Reloaded on every step, so a governorate the admin closed while the customer was filling the form is noticed early.
  useEffect(() => {
    let live = true;
    void fetchShippingCompanies().then((companyRows) => {
      if (!live) return;
      if (companyRows) setCompanies(companyRows);
      setZonesLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [step, zonesTick]);
  const openCompanies = companies.filter((item) => item.enabled);
  const cityOptions: string[] = CITIES.filter((item) => openCompanies.some((c) => c.zones.some((z) => z.city === item)));
  const cityCompanies = openCompanies.filter((c) => c.zones.some((z) => z.city === city));
  const company = cityCompanies.find((c) => c.id === companyId) ?? (cityCompanies.length === 1 ? cityCompanies[0] : null);
  const companyZone = company?.zones.find((z) => z.city === city) ?? null;
  const cityOpen = cityCompanies.length > 0;
  // The shipping option that is actually chosen (null until a city — and, with companies, a company — is picked).
  const zone: { city: string; fee: number; etaAr: string; etaEn: string } | null =
    company && companyZone
      ? { city, fee: company.fee, etaAr: companyZone.etaAr, etaEn: companyZone.etaEn }
      : null;
  const shipLabel = company ? (isAr ? company.nameAr : company.nameEn || company.nameAr) : "";

  // The chosen governorate is no longer open: say so right away and send the customer back to pick another one.
  function cityClosed() {
    setError(t("checkout.err.cityUnavailable"));
    setCity("");
    setCompanyId("");
    setStep((value) => Math.min(value, 1));
    setZonesTick((n) => n + 1);
  }
  useEffect(() => {
    if (zonesLoaded && city && !cityOpen) cityClosed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonesLoaded, city, cityOpen]);

  // The database prices the order (products + shipping + coupon). The browser only displays it.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  // quoteUnavailable = الدالة غير موجودة بالسيرفر (نخفي خانة الكود). quoteNetError = خطأ اتصال مؤقت (نبقي الخانة ونسمح بإعادة المحاولة).
  const [quoteUnavailable, setQuoteUnavailable] = useState(false);
  const [quoteNetError, setQuoteNetError] = useState(false);
  const [quoteTick, setQuoteTick] = useState(0);
  // Only needed when the cart has a piece from the secret section: the database refuses those without the code.
  const secretAccess = useOwl((state) => state.secretAccess);
  const showCoupon = isSupabaseConfigured && !quoteUnavailable;

  const quoteItems = rows.map((row) => ({
    productId: row.product.id,
    size: row.line.size,
    qty: row.line.qty,
  }));
  const quoteKey = JSON.stringify(quoteItems);

  function couponError(reason: string, min: number) {
    const key = COUPON_ERRORS[reason] ?? "checkout.coupon.err.generic";
    return t(key, { min: money(min) });
  }

  // applyCoupon already priced the order with the new code: remember it so the refresh below does not ask the server again.
  const skipQuote = useRef<{ sig: string; tick: number } | null>(null);
  const quoteSig = `${city}|${company?.id ?? ""}|${appliedCode ?? ""}|${quoteKey}|${zone?.fee ?? ""}|${secretAccess}`;

  useEffect(() => {
    const skip = skipQuote.current;
    skipQuote.current = null;
    if (!isSupabaseConfigured || !city || !zone) {
      setQuote(null);
      return;
    }
    if (skip && skip.sig === quoteSig && skip.tick === quoteTick) return;
    let live = true;
    // Small delay: quick changes in the cart or the city send one request, not one per change.
    const timer = setTimeout(() => {
      void quoteOrder({ items: JSON.parse(quoteKey), city, code: appliedCode, secret: secretAccess, company: company?.id }).then((res) => {
        if (!live) return;
        if (!res.ok) {
          if (res.error === "UNAVAILABLE") setQuoteUnavailable(true);
          setQuoteNetError(res.error === "NETWORK");
          setQuote(null);
          // Do not fall back to the local numbers silently: tell the customer what happened.
          if (res.error === "CITY_UNAVAILABLE") {
            cityClosed();
          } else if (res.error === "PRODUCT_NOT_FOUND") {
            const gone = rows.find((row) => row.product.id === res.productId)?.product ?? rows[0]?.product;
            setError(t("checkout.err.productGone", { name: gone ? productName(gone) : "" }));
          } else if (res.error === "BAD_QTY" || res.error === "EMPTY_CART") {
            setError(t("checkout.err.save"));
          }
          return;
        }
        setQuoteNetError(false);
        if (res.couponError) {
          // The code stopped being valid (expired, used up, cart changed): drop it, keep the order priced.
          setAppliedCode(null);
          setCouponMsg(couponError(res.couponError, res.couponMin));
        }
        setQuote({
          subtotal: res.subtotal,
          shippingFee: res.shippingFee,
          discount: res.couponError ? 0 : res.discount,
          total: res.couponError ? res.subtotal + res.shippingFee : res.total,
          coupon: res.couponError ? null : res.coupon,
        });
      });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteSig, quoteTick]);

  const subtotal = quote?.subtotal ?? localSubtotal;
  const discount = quote?.discount ?? 0;
  const shippingFee = quote?.shippingFee ?? zone?.fee ?? 0;
  const total = quote?.total ?? subtotal - discount + shippingFee;

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    setCouponMsg("");
    if (!code) return setCouponMsg(t("checkout.coupon.err.invalid"));
    if (!city) return setCouponMsg(t("checkout.coupon.needCity"));
    setCouponBusy(true);
    const res = await quoteOrder({ items: quoteItems, city, code, secret: secretAccess, company: company?.id });
    setCouponBusy(false);
    if (!res.ok) {
      if (res.error === "UNAVAILABLE") setQuoteUnavailable(true);
      setQuoteNetError(res.error === "NETWORK");
      return setCouponMsg(t(res.error === "NETWORK" ? "checkout.err.network" : "checkout.coupon.err.generic"));
    }
    setQuoteNetError(false);
    if (res.couponError) return setCouponMsg(couponError(res.couponError, res.couponMin));
    setCouponInput("");
    skipQuote.current = {
      sig: `${city}|${company?.id ?? ""}|${res.coupon ?? ""}|${quoteKey}|${zone?.fee ?? ""}|${secretAccess}`,
      tick: quoteTick,
    };
    setAppliedCode(res.coupon);
    setQuote({
      subtotal: res.subtotal,
      shippingFee: res.shippingFee,
      discount: res.discount,
      total: res.total,
      coupon: res.coupon,
    });
    setCouponMsg(t("checkout.coupon.applied", { code: res.coupon ?? code, amount: money(res.discount) }));
  }

  function removeCoupon() {
    setAppliedCode(null);
    setCouponMsg("");
    setQuote((current) =>
      current
        ? { ...current, discount: 0, coupon: null, total: current.subtotal + current.shippingFee }
        : current,
    );
  }

  if (!rows.length) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-4">
        <h1 className="font-display text-4xl uppercase">{t("checkout.emptyTitle")}</h1>
        <Link to="/shop" search={{ cat: "all" }} className="btn-solid mt-6">
          {t("cart.shopDrop")}
        </Link>
      </div>
    );
  }

  function next() {
    setError("");
    if (step === 0) {
      if (name.trim().length < 3) return setError(t("checkout.err.name"));
      if (normalizeDigits(phone).replace(/\D/g, "").length < 8) return setError(t("checkout.err.phone"));
    }
    if (step === 1) {
      if (!city || !cityOpen) return setError(t("checkout.err.city"));
      if (!company) return setError(t("checkout.err.company"));
      if (!zone) return setError(t("checkout.err.city"));
      if (address.trim().length < 8) return setError(t("checkout.err.address"));
    }
    setStep((value) => Math.min(value + 1, 2));
  }

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await runSubmit();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function runSubmit() {
    setError("");
    if (!receipt.startsWith("data:image/")) {
      setError(t("checkout.err.receipt"));
      return;
    }
    // Also works without a database (demo mode): never send an order to a governorate that is not open.
    if (!zone) {
      cityClosed();
      return;
    }
    // Check against the latest stock from the database, not what the page loaded earlier.
    await refreshProducts().catch(() => {});
    const fresh = useOwl.getState().products;
    const over = rows.find((row) => {
      const current = fresh.find((item) => item.id === row.product.id) ?? row.product;
      const left = sizeLeft(current, row.line.size, row.line.colorId);
      return row.line.qty > left;
    });
    if (over) {
      setError(t("checkout.err.stock", { name: productName(over.product) }));
      return;
    }

    // Price once more on the server. The customer already transferred the amount on screen,
    // so if anything changed (price, code expiry) we stop and show the new total instead of charging a different one.
    if (isSupabaseConfigured && !quoteUnavailable) {
      const fresh = await quoteOrder({ items: quoteItems, city, code: appliedCode, secret: secretAccess, company: company?.id });
      if (!fresh.ok && fresh.error !== "UNAVAILABLE") {
        // خطأ اتصال مؤقت: ما نكمّل بدون فحص السعر الأخير (الزبون حوّل المبلغ فعلاً). نوقف ونخليه يعيد المحاولة.
        if (fresh.error === "NETWORK") {
          setQuoteNetError(true);
          setQuoteTick((n) => n + 1);
          setError(t("checkout.err.network"));
          return;
        }
        if (fresh.error === "CITY_UNAVAILABLE") {
          cityClosed();
          return;
        }
        setError(
          fresh.error === "CITY_UNAVAILABLE"
            ? t("checkout.err.cityUnavailable")
            : fresh.error === "PRODUCT_NOT_FOUND"
              ? t("checkout.err.productGone", {
                  name: productName(rows.find((row) => row.product.id === fresh.productId)?.product ?? rows[0].product),
                })
              : t("checkout.err.save"),
        );
        return;
      }
      if (fresh.ok) {
        const freshTotal = fresh.couponError ? fresh.subtotal + fresh.shippingFee : fresh.total;
        if (fresh.couponError) {
          setAppliedCode(null);
          setCouponMsg(couponError(fresh.couponError, fresh.couponMin));
        }
        if (Math.abs(freshTotal - total) > 0.001) {
          setQuote({
            subtotal: fresh.subtotal,
            shippingFee: fresh.shippingFee,
            discount: fresh.couponError ? 0 : fresh.discount,
            total: freshTotal,
            coupon: fresh.couponError ? null : fresh.coupon,
          });
          setError(t("checkout.err.priceChanged"));
          return;
        }
      }
    }

    const order: Order = {
      ref: (orderRef.current ??= makeRef()),
      createdAt: new Date().toISOString(),
      customer: {
        name: name.trim(),
        phone: normalizeDigits(phone).trim(),
        city,
        address: address.trim(),
      },
      shipping: { id: company?.id ?? city, label: company?.nameAr ?? city, fee: shippingFee, companyId: company?.id },
      items: rows.map((row) => ({
        productId: row.product.id,
        colorId: row.line.colorId,
        name: row.product.name,
        size: row.line.size,
        fit: row.line.fit,
        color: row.colorName,
        qty: row.line.qty,
        unitPrice: row.product.price,
      })),
      subtotal,
      discount,
      coupon: appliedCode,
      total,
      payment: "Sham Cash",
      receiptDataUrl: receipt,
      telegram: "unconfigured",
      status: "pending",
    };

    try {
      const saved = (await submitOrderToDatabase(order, { secretCode: secretAccess })) as
        | { subtotal: number; shippingFee: number; discount: number; total: number; coupon: string | null }
        | true
        | null;
      // The numbers the database actually saved are the ones we show and send to Telegram.
      if (saved && saved !== true) {
        order.subtotal = saved.subtotal;
        order.discount = saved.discount;
        order.coupon = saved.coupon;
        order.total = saved.total;
        order.shipping = { ...order.shipping, fee: saved.shippingFee };
      }
    } catch (cause) {
      const failure = cause as { code?: string; productId?: string; reason?: string; min?: number };
      if (failure?.code === "COUPON") {
        setAppliedCode(null);
        setCouponMsg(couponError(failure.reason ?? "", failure.min ?? 0));
        setError(t("checkout.err.priceChanged"));
        return;
      }
      if (failure?.code === "CITY_UNAVAILABLE") {
        cityClosed();
        return;
      }
      if (failure?.code === "INVALID_ORDER") {
        const field = (cause as { field?: string }).field;
        setError(
          field === "NAME"
            ? t("checkout.err.name")
            : field === "PHONE"
              ? t("checkout.err.phone")
              : field === "ADDRESS"
                ? t("checkout.err.address")
                : t("checkout.err.save"),
        );
        return;
      }
      if (failure?.code === "PRODUCT_NOT_FOUND") {
        const product = rows.find((row) => row.product.id === failure.productId)?.product;
        setError(t("checkout.err.productGone", { name: product ? productName(product) : "" }));
        return;
      }
      if (failure?.code === "OUT_OF_STOCK") {
        // Someone else took the last pieces a moment ago.
        await refreshProducts().catch(() => {});
        const product = useOwl.getState().products.find((item) => item.id === failure.productId);
        setError(t("checkout.err.stock", { name: product ? productName(product) : "" }));
        return;
      }
      // Server codes like BAD_QTY / EMPTY_CART are not for customers: show the normal message instead.
      setError(
        cause instanceof Error && !/^[A-Z_]+$/.test(cause.message) ? cause.message : t("checkout.err.save"),
      );
      return;
    }
    try {
      const result = await notifyOrder({
        data: {
          botToken: settings.telegramBotToken,
          chatId: settings.telegramChatId,
          ref: order.ref,
          text: formatOrderText(order),
          receiptDataUrl: receipt,
        },
      });
      order.telegram = result.status;
      placeOrder(order);
      if (result.status === "failed") toast(result.detail);
      await navigate({ to: "/order/$ref", params: { ref: order.ref } });
    } catch (cause) {
      order.telegram = "failed";
      placeOrder(order);
      toast(cause instanceof Error ? cause.message : t("checkout.savedLocally"));
      await navigate({ to: "/order/$ref", params: { ref: order.ref } });
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:px-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="font-display text-xs tracking-brand text-muted uppercase">{t("checkout.kicker")}</p>
        <h1 className="mt-2 font-display text-4xl uppercase leading-none">{t("checkout.title")}</h1>
        <ol className="mt-8 flex gap-4">
          {STEPS.map((labelKey, index) => (
            <li key={labelKey}>
              <button
                type="button"
                className={cn(
                  "min-h-11 font-display text-xs tracking-widest uppercase",
                  index === step ? "text-fg" : "text-muted",
                )}
                onClick={() => {
                  if (index < step) setStep(index);
                }}
              >
                0{index + 1} {t(labelKey)}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="mt-8 flex flex-col gap-4">
            <label>
              <span className="field-label">{t("checkout.fullName")}</span>
              <input className="field" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span className="field-label">{t("checkout.phone")}</span>
              <input
                className="field"
                maxLength={20}
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(normalizeDigits(event.target.value))}
                placeholder="09xxxxxxxx"
              />
            </label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-8 flex flex-col gap-4">
            <label>
              <span className="field-label">{t("checkout.city")}</span>
              <select
                className="field"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  setCompanyId("");
                }}
              >
                <option value="">{t("checkout.select")}</option>
                {cityOptions.map((item) => (
                  <option key={item} value={item}>
                    {cityLabel(item)}
                  </option>
                ))}
              </select>
              {zonesLoaded && cityOptions.length === 0 ? (
                <span className="mt-2 block border border-line p-3 text-sm text-muted">{t("checkout.noZones")}</span>
              ) : null}
            </label>
            <label>
              <span className="field-label">{t("checkout.address")}</span>
              <textarea
                className="field min-h-28"
                maxLength={300}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={t("checkout.addressPh")}
              />
            </label>
            {city ? (
              <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("checkout.company")}>
                <p className="field-label">{t("checkout.company")}</p>
                {cityCompanies.map((item) => {
                  const z = item.zones.find((entry) => entry.city === city);
                  const chosen = company?.id === item.id;
                  const eta = z ? (isAr ? z.etaAr : z.etaEn || z.etaAr) : "";
                  const delivery = isAr ? item.deliveryAr : item.deliveryEn || item.deliveryAr;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      onClick={() => setCompanyId(item.id)}
                      className={cn(
                        "border px-4 py-3 text-start transition-colors",
                        chosen ? "border-fg bg-fg/5" : "border-line hover:border-fg",
                      )}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-bold">{isAr ? item.nameAr : item.nameEn || item.nameAr}</span>
                        <span className="tabular-nums">{money(item.fee)}</span>
                      </span>
                      {delivery ? <span className="mt-1 block text-sm">{delivery}</span> : null}
                      {eta ? <span className="mt-1 block text-xs text-muted">{eta}</span> : null}
                      {z?.areas ? <span className="mt-1 block text-xs text-muted">{z.areas}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-8">
            {showCoupon ? (
              <div className="mb-6 border border-line p-4">
                <p className="field-label">{t("checkout.coupon.title")}</p>
                {appliedCode ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-display text-lg tracking-widest">{appliedCode}</p>
                    <button type="button" className="btn-line" onClick={removeCoupon}>
                      {t("checkout.coupon.remove")}
                    </button>
                  </div>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void applyCoupon();
                    }}
                  >
                    <input
                      className="field"
                      dir="ltr"
                      value={couponInput}
                      onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                      placeholder={t("checkout.coupon.ph")}
                      autoCapitalize="characters"
                      autoComplete="off"
                    />
                    <button type="submit" className="btn-line shrink-0" disabled={couponBusy}>
                      {couponBusy ? t("checkout.coupon.checking") : t("checkout.coupon.apply")}
                    </button>
                  </form>
                )}
                {couponMsg ? <p className="mt-2 text-xs text-muted">{couponMsg}</p> : null}
                {quoteNetError && !couponMsg ? (
                  <p className="mt-2 text-xs text-muted">
                    {t("checkout.err.network")}{" "}
                    <button type="button" className="underline" onClick={() => setQuoteTick((n) => n + 1)}>
                      {t("checkout.retry")}
                    </button>
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-6 border border-line p-4 sm:grid-cols-[180px_1fr]">
              <div className="bg-fg p-3">
                {settings.shamCashQr ? (
                  <img
                    src={settings.shamCashQr}
                    alt="Sham Cash QR"
                    className="aspect-square w-full bg-white object-contain"
                  />
                ) : (
                  <QrMark value={settings.shamCashId} />
                )}
              </div>
              <div>
                <p className="field-label">{t("checkout.payAccount")}</p>
                <p className="font-display text-2xl tracking-widest">{settings.shamCashName}</p>
                <p className="mt-2 font-display text-lg tracking-widest">{settings.shamCashId}</p>
                <p className="mt-3 text-sm text-muted">
                  {t("checkout.transfer", { amount: money(total) })}
                </p>
                <button
                  type="button"
                  className="btn-line mt-4"
                  onClick={() => {
                    void navigator.clipboard.writeText(settings.shamCashId);
                    toast(t("checkout.idCopied"));
                  }}
                >
                  {t("checkout.copyId")}
                </button>
              </div>
            </div>
            <label className="mt-6 block">
              <span className="field-label">{t("checkout.receipt")}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="field"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void fileToJpegDataUrl(file)
                    .then((url) => {
                      setReceipt(url);
                      setReceiptName(file.name);
                      setError("");
                    })
                    .catch((cause: unknown) => {
                      setReceipt("");
                      setError(cause instanceof Error ? cause.message : t("checkout.err.read"));
                    });
                }}
              />
            </label>
            {receipt ? (
              <img src={receipt} alt={t("checkout.receiptAlt")} className="mt-4 max-h-64 border border-line object-contain" />
            ) : null}
            {receiptName ? <p className="mt-2 text-xs text-muted">{receiptName}</p> : null}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-muted">{error}</p> : null}

        <div className="mt-8 flex gap-3">
          {step > 0 ? (
            <button type="button" className="btn-line" onClick={() => setStep((value) => value - 1)}>
              {t("checkout.back")}
            </button>
          ) : null}
          {step < 2 ? (
            <button type="button" className="btn-solid" onClick={next} disabled={step === 1 && cityOptions.length === 0}>
              {t("checkout.continue")}
            </button>
          ) : (
            <button type="button" className="btn-solid" disabled={busy} onClick={() => void submit()}>
              {busy ? t("checkout.placing") : t("checkout.place")}
            </button>
          )}
        </div>
      </div>

      <aside className="h-fit border border-line p-5 lg:col-span-5">
        <h2 className="font-display text-sm tracking-widest uppercase">{t("checkout.order")}</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {rows.map(({ line, product, colorName }) => (
            <li key={`${line.productId}-${line.size}-${line.fit}`} className="flex gap-3">
              <img src={product.images[0]} alt="" className="aspect-garment w-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{productName(product)}</span>
                  <span className="tabular-nums">{money(product.price * line.qty)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {line.size} · {fitLabel(line.fit)} · {colorLabel(product, product.colors.find((c) => c.id === line.colorId) ?? product.colors[0])} · ×{line.qty}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-6 flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("checkout.subtotal")}</dt>
            <dd className="tabular-nums">{money(subtotal)}</dd>
          </div>
          {discount > 0 && appliedCode ? (
            <div className="flex justify-between">
              <dt className="text-muted">{t("checkout.discount", { code: appliedCode })}</dt>
              <dd className="tabular-nums">−{money(discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">
              {zone ? t("checkout.shippingLine", { label: `${shipLabel} · ${cityLabel(zone.city)}` }) : t("checkout.shipping")}
            </dt>
            <dd className="tabular-nums">{zone ? money(shippingFee) : "—"}</dd>
          </div>
          <div className="flex justify-between font-display text-base tracking-widest uppercase">
            <dt>{t("checkout.total")}</dt>
            <dd className="tabular-nums">{money(total)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
