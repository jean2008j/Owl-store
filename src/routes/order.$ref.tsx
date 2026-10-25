import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchShippingCompanies } from "@/lib/db-service";
import { money, type Order, type ShippingCompany } from "@/lib/store/catalog";
import { useI18n } from "@/lib/i18n";
import { useOwl } from "@/lib/store/owl-store";

export const Route = createFileRoute("/order/$ref")({
  head: ({ params }) => ({
    meta: [{ title: `${params.ref} — ATHAR & OWL` }],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { ref } = Route.useParams();
  const { t, isAr, orderItemName, orderItemColor, fitLabel, cityLabel } = useI18n();
  const products = useOwl((state) => state.products);
  const hydrated = useOwl((state) => state.hydrated);
  const order = useOwl((state) => state.orders.find((item) => item.ref === ref));

  // Orders placed before the delivery note existed have no saved copy of it: read it from the company list instead.
  const [companies, setCompanies] = useState<ShippingCompany[]>([]);
  const needLookup = Boolean(order && !order.delivery && order.shipping.companyId);
  useEffect(() => {
    if (!needLookup) return;
    let live = true;
    void fetchShippingCompanies().then((rows) => {
      if (live && rows) setCompanies(rows);
    });
    return () => {
      live = false;
    };
  }, [needLookup]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24">
        <p className="text-muted">{t("order.confirming")}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col justify-center px-4">
        <h1 className="font-display text-4xl uppercase">{t("order.none", { ref })}</h1>
        <p className="mt-3 text-sm text-muted">{t("order.noneNote")}</p>
        <Link to="/shop" search={{ cat: "all" }} className="btn-line mt-6 self-start">
          {t("order.continue")}
        </Link>
      </div>
    );
  }

  // When Telegram received the order there is nothing to tell the customer; only a problem is shown.
  const note =
    order.telegram === "sent"
      ? null
      : order.telegram === "failed"
        ? t("order.note.failed")
        : t("order.note.unconfigured");

  const delivery = order.delivery ?? deliveryFromCompanies(order, companies);
  const deliveryLine = delivery
    ? (() => {
        const company = isAr ? delivery.companyAr : delivery.companyEn;
        const eta = (isAr ? delivery.etaAr : delivery.etaEn || delivery.etaAr).trim();
        if (delivery.pickup) {
          const office = [cityLabel(order.customer.city), delivery.office].filter(Boolean).join(" – ");
          return t(eta ? "order.pickup" : "order.pickupNoEta", { company, office, eta });
        }
        return eta ? t("order.home", { eta }) : null;
      })()
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <p className="font-display text-xs tracking-brand text-muted uppercase">{t("order.confirmed")}</p>
      <h1 className="mt-3 font-display text-5xl tracking-widest md:text-7xl">{order.ref}</h1>
      <p className="mt-4 max-w-lg text-base font-bold">{t("order.success")}</p>
      {deliveryLine ? <p className="mt-2 max-w-lg text-sm">{deliveryLine}</p> : null}
      {note ? <p className="mt-2 max-w-lg text-sm text-muted">{note}</p> : null}

      <div className="mt-10 border border-line p-5">
        <p className="text-sm">
          {order.customer.name} · {order.customer.phone}
        </p>
        <p className="mt-1 text-sm text-muted">
          {cityLabel(order.customer.city)} — {order.customer.address}
        </p>
        <ul className="mt-5 flex flex-col gap-2 text-sm">
          {order.items.map((item, index) => (
            <li key={`${item.productId}-${index}`} className="flex justify-between gap-4">
              <span>
                {orderItemName(item, products)} · {item.size} · {fitLabel(item.fit)} · {orderItemColor(item, products)} · ×{item.qty}
              </span>
              <span className="tabular-nums">{money(item.unitPrice * item.qty)}</span>
            </li>
          ))}
        </ul>
        {order.discount && order.discount > 0 ? (
          <div className="mt-5 flex justify-between border-t border-line pt-4 text-sm">
            <span className="text-muted">{t("checkout.discount", { code: order.coupon ?? "" })}</span>
            <span className="tabular-nums">−{money(order.discount)}</span>
          </div>
        ) : null}
        <div className="mt-5 flex justify-between border-t border-line pt-4 font-display tracking-widest uppercase">
          <span>{t("order.total")}</span>
          <span className="tabular-nums">{money(order.total)}</span>
        </div>
      </div>

      <Link to="/shop" search={{ cat: "new" }} className="btn-solid mt-8">
        {t("order.keepLooking")}
      </Link>
    </div>
  );
}

function deliveryFromCompanies(order: Order, companies: ShippingCompany[]): Order["delivery"] {
  const company = companies.find((item) => item.id === order.shipping.companyId);
  const zone = company?.zones.find((item) => item.city === order.customer.city);
  if (!company || !zone) return undefined;
  return {
    pickup: company.pickup,
    office: company.pickup ? zone.areas : "",
    etaAr: zone.etaAr,
    etaEn: zone.etaEn,
    companyAr: company.nameAr,
    companyEn: company.nameEn || company.nameAr,
  };
}
