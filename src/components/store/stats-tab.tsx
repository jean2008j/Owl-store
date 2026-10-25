import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarDays,
  CreditCard,
  DollarSign,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { fetchOrdersFromDatabase, isSupabaseConfigured } from "@/lib/db-service";
import type { Order, Product } from "@/lib/store/catalog";
import { useOwl } from "@/lib/store/owl-store";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const MONTHS_AR = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
];

const PAYMENT_LABEL: Record<string, string> = {
  "Sham Cash": "شام كاش",
};

const REFRESH_MS = 30_000;

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Math.round(value * 100) / 100);

/** Sales of an order = the items only, after any coupon (shipping is not store revenue). */
function orderSales(order: Order) {
  const discount = typeof order.discount === "number" && Number.isFinite(order.discount) ? order.discount : 0;
  if (typeof order.subtotal === "number" && Number.isFinite(order.subtotal)) return order.subtotal - discount;
  return order.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0) - discount;
}

function orderProfit(order: Order, products: Map<string, Product>) {
  let profit = 0;
  let costedSales = 0; // sales of the lines that have a cost entered
  let itemsTotal = 0; // sales of all lines
  for (const item of order.items) {
    const line = item.unitPrice * item.qty;
    itemsTotal += line;
    const cost = products.get(item.productId)?.cost;
    if (cost == null) continue; // no cost entered for this product → not counted
    profit += (item.unitPrice - cost) * item.qty;
    costedSales += line;
  }
  const discount = typeof order.discount === "number" && Number.isFinite(order.discount) ? order.discount : 0;
  // The coupon discount is spread over all the lines. Only the share that belongs to lines with a known cost
  // is taken off the profit; otherwise an order with no costs entered would show a made-up loss.
  if (discount <= 0 || itemsTotal <= 0 || costedSales <= 0) return profit;
  return profit - discount * (costedSales / itemsTotal);
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/* ------------------------------------------------------------------ */
/* Numbers                                                              */
/* ------------------------------------------------------------------ */

function computeStats(orders: Order[], products: Product[], now: Date) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const year = now.getFullYear();
  const month = now.getMonth();
  const yesterday = new Date(year, month, now.getDate() - 1);
  const lastMonthDate = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let revenue = 0;
  let profit = 0;
  let today = 0;
  let yest = 0;
  let thisMonth = 0;
  let lastMonth = 0;
  const days = Array<number>(daysInMonth).fill(0);
  const months = Array<number>(12).fill(0);

  const customers = new Map<string, { name: string; phone: string; orders: number; spent: number }>();
  const payments = new Map<string, number>();
  const statuses = { pending: 0, confirmed: 0, fulfilled: 0, cancelled: 0 };
  const sold = new Map<string, { name: string; qty: number; revenue: number }>();

  for (const order of orders) {
    // A cancelled order is not a sale: it does not count in revenue, profit, customers or best sellers.
    if (order.status === "cancelled") {
      statuses.cancelled += 1;
      continue;
    }
    const sales = orderSales(order);
    const date = new Date(order.createdAt);
    const valid = !Number.isNaN(date.getTime());

    revenue += sales;
    profit += orderProfit(order, byId);

    if (valid) {
      if (sameDay(date, now)) today += sales;
      if (sameDay(date, yesterday)) yest += sales;
      if (date.getFullYear() === year) months[date.getMonth()] += sales;
      if (date.getFullYear() === year && date.getMonth() === month) {
        thisMonth += sales;
        days[date.getDate() - 1] += sales;
      }
      if (date.getFullYear() === lastMonthDate.getFullYear() && date.getMonth() === lastMonthDate.getMonth()) {
        lastMonth += sales;
      }
    }

    const phone = order.customer.phone.replace(/\s+/g, "");
    const key = phone || order.customer.name;
    const c = customers.get(key) ?? { name: order.customer.name, phone: order.customer.phone, orders: 0, spent: 0 };
    c.orders += 1;
    c.spent += sales;
    c.name = order.customer.name;
    customers.set(key, c);

    payments.set(order.payment, (payments.get(order.payment) ?? 0) + 1);
    if (order.status in statuses) statuses[order.status] += 1;

    for (const item of order.items) {
      const s = sold.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0 };
      s.qty += item.qty;
      s.revenue += item.unitPrice * item.qty;
      sold.set(item.productId, s);
    }
  }

  const topCustomers = [...customers.values()].sort((a, b) => b.spent - a.spent).slice(0, 5);
  const soldList = [...sold.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const bestDayValue = Math.max(0, ...days);
  const bestDay = bestDayValue > 0 ? days.indexOf(bestDayValue) + 1 : null;

  return {
    revenue,
    profit,
    today,
    yest,
    thisMonth,
    lastMonth,
    days,
    months,
    topCustomers,
    payments: [...payments.entries()],
    statuses,
    topProduct: soldList[0] ?? null,
    leastProduct: soldList.length > 1 ? soldList[soldList.length - 1] : null,
    bestDay,
    bestDayValue,
    year,
    month,
  };
}

/* ------------------------------------------------------------------ */
/* UI pieces                                                            */
/* ------------------------------------------------------------------ */

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("min-w-0 border border-line p-4 sm:p-5", className)}>{children}</section>;
}

function StatCard({
  title,
  icon,
  value,
  sub,
  hint,
  tone = "default",
}: {
  title: string;
  icon: ReactNode;
  value: string;
  sub?: string;
  hint?: ReactNode;
  tone?: "default" | "green" | "gold";
}) {
  return (
    <Card className={tone === "green" ? "border-emerald-500/40 bg-emerald-500/5" : undefined}>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-sm font-bold", tone === "green" && "text-emerald-500")}>{title}</p>
        <span className={cn("text-muted", tone === "green" && "text-emerald-500", tone === "gold" && "text-amber-500")}>
          {icon}
        </span>
      </div>
      <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "font-display text-3xl tabular-nums sm:text-4xl",
            tone === "green" && "text-emerald-500",
            tone === "gold" && "text-amber-500",
          )}
        >
          {value}
        </span>
        {sub ? <span className="text-sm tabular-nums text-muted">{sub}</span> : null}
      </p>
      {hint ? <div className="mt-3 text-xs text-muted">{hint}</div> : null}
    </Card>
  );
}

function Compare({ now, before }: { now: number; before: number }) {
  if (now === 0 && before === 0) return <span>لا توجد مبيعات للمقارنة</span>;
  if (now > before) {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-emerald-500">
        <TrendingUp className="size-3.5" /> أعلى من السابق
      </span>
    );
  }
  if (now < before) {
    return (
      <span className="inline-flex items-center gap-1 font-bold text-amber-500">
        <TrendingDown className="size-3.5" /> أقل من السابق
      </span>
    );
  }
  return <span>مساوٍ للسابق</span>;
}

/* ------------------------------------------------------------------ */
/* Tab                                                                  */
/* ------------------------------------------------------------------ */

export function StatsTab() {
  const orders = useOwl((state) => state.orders);
  const products = useOwl((state) => state.products);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Pull every order from the database, now and then every 30 s (and when the tab regains focus).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setNow(new Date());
        return;
      }
      setLoading(true);
      const rows = await fetchOrdersFromDatabase();
      if (!alive) return;
      if (rows) {
        useOwl.setState({ orders: rows });
        setUpdatedAt(new Date());
      }
      setNow(new Date());
      setLoading(false);
    };
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const s = useMemo(() => computeStats(orders, products, now), [orders, products, now]);
  const hasCosts = products.some((p) => p.cost != null);
  const maxPayment = Math.max(1, ...s.payments.map(([, n]) => n));

  const statusRows: [string, number][] = [
    ["قيد الانتظار", s.statuses.pending],
    ["مؤكد", s.statuses.confirmed],
    ["تم التسليم", s.statuses.fulfilled],
    ["ملغي", s.statuses.cancelled],
  ];

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          الأرقام تتحدّث تلقائياً من الطلبات الفعلية
          {updatedAt ? ` · آخر تحديث ${updatedAt.toLocaleTimeString("en-GB")}` : ""}
        </p>
        <button
          type="button"
          className="btn-line inline-flex items-center gap-2"
          onClick={() => {
            setLoading(true);
            void fetchOrdersFromDatabase().then((rows) => {
              if (rows) {
                useOwl.setState({ orders: rows });
                setUpdatedAt(new Date());
              } else {
                toast.error("تعذّر جلب الطلبات من قاعدة البيانات. تحقق من الاتصال أو سجّل الدخول من جديد.");
              }
              setNow(new Date());
              setLoading(false);
            });
          }}
          disabled={loading || !isSupabaseConfigured}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          تحديث
        </button>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="إجمالي المبيعات"
          icon={<BarChart3 className="size-5" />}
          value={usd(s.revenue)}
          hint={`كل المبيعات منذ البداية · ${orders.length} طلب`}
        />
        <StatCard
          tone="green"
          title="صافي الربح التقديري"
          icon={<DollarSign className="size-5" />}
          value={usd(s.profit)}
          hint={
            hasCosts ? "(سعر البيع − التكلفة) × الكمية" : "أضف «التكلفة» للمنتجات حتى يُحسب الربح"
          }
        />
        <StatCard
          title="اليوم مقابل أمس"
          icon={<CalendarDays className="size-5" />}
          value={usd(s.today)}
          sub={`/ ${usd(s.yest)}`}
          hint={<Compare now={s.today} before={s.yest} />}
        />
        <StatCard
          title="هذا الشهر مقابل الشهر الماضي"
          icon={<TrendingUp className="size-5" />}
          value={usd(s.thisMonth)}
          sub={`/ ${usd(s.lastMonth)}`}
          hint={<Compare now={s.thisMonth} before={s.lastMonth} />}
        />
        <StatCard
          tone="gold"
          title="أفضل يوم مبيعاً هذا الشهر"
          icon={<Award className="size-5" />}
          value={s.bestDay ? `يوم ${s.bestDay}` : "—"}
          hint={s.bestDay ? `${usd(s.bestDayValue)} مبيعات مسجّلة` : "لا مبيعات هذا الشهر بعد"}
        />
      </div>

      {/* Customers + payments */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 font-display text-lg">
              <Users className="size-5 text-muted" /> أفضل الزبائن
            </h2>
            <span className="text-xs text-muted">الأكثر شراءً</span>
          </div>
          {s.topCustomers.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-center">
                <thead>
                  <tr className="border-b border-line text-sm">
                    <th className="px-3 py-3 text-start">اسم الزبون</th>
                    <th className="px-3 py-3">الهاتف</th>
                    <th className="px-3 py-3">الطلبات</th>
                    <th className="px-3 py-3">إجمالي الإنفاق</th>
                  </tr>
                </thead>
                <tbody>
                  {s.topCustomers.map((c) => (
                    <tr key={c.phone + c.name} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-3 text-start font-bold">{c.name}</td>
                      <td dir="ltr" className="px-3 py-3 text-sm tabular-nums text-muted">
                        {c.phone}
                      </td>
                      <td className="px-3 py-3 font-bold tabular-nums">{c.orders}</td>
                      <td className="px-3 py-3 font-bold tabular-nums text-emerald-500">{usd(c.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">ما في زبائن لسا.</p>
          )}
        </Card>

        <Card>
          <h2 className="inline-flex items-center gap-2 font-display text-lg">
            <CreditCard className="size-5 text-muted" /> طرق الدفع
          </h2>
          <div className="mt-5 flex flex-col gap-4">
            {s.payments.length ? (
              s.payments.map(([method, count]) => (
                <Bar
                  key={method}
                  label={PAYMENT_LABEL[method] ?? method}
                  count={count}
                  total={orders.length}
                  max={maxPayment}
                />
              ))
            ) : (
              <p className="text-sm text-muted">ما في طلبات لسا.</p>
            )}
          </div>
          <h3 className="mt-7 text-sm font-bold">حالة الطلبات</h3>
          <div className="mt-4 flex flex-col gap-4">
            {statusRows.map(([label, count]) => (
              <Bar key={label} label={label} count={count} total={orders.length} max={Math.max(1, orders.length)} />
            ))}
          </div>
        </Card>
      </div>

      {/* Top / least product */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-500">
              <Award className="size-4" /> المنتج الأكثر مبيعاً
            </p>
            <p className="mt-2 break-words font-display text-2xl">{s.topProduct?.name ?? "—"}</p>
            <p className="mt-1 text-sm text-muted">
              {s.topProduct
                ? `${s.topProduct.qty} قطعة مباعة · إجمالي الإيراد: ${usd(s.topProduct.revenue)}`
                : "لا مبيعات بعد"}
            </p>
          </div>
          <span className="flex size-14 shrink-0 items-center justify-center bg-emerald-500/10 text-emerald-500">
            <TrendingUp className="size-6" />
          </span>
        </Card>
        <Card className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-amber-500">
              <AlertTriangle className="size-4" /> المنتج الأقل مبيعاً
            </p>
            <p className="mt-2 break-words font-display text-2xl">{s.leastProduct?.name ?? "—"}</p>
            <p className="mt-1 text-sm text-muted">
              {s.leastProduct
                ? `${s.leastProduct.qty} قطعة مباعة · إجمالي الإيراد: ${usd(s.leastProduct.revenue)}`
                : "يظهر عند وجود أكثر من منتج مباع"}
            </p>
          </div>
          <span className="flex size-14 shrink-0 items-center justify-center bg-amber-500/10 text-amber-500">
            <TrendingDown className="size-6" />
          </span>
        </Card>
      </div>

      {/* Daily */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">المبيعات اليومية (الشهر الحالي)</h2>
            <p className="text-sm text-muted">مقارنة يوم بيوم لإجمالي المبيعات بالدولار</p>
          </div>
          <span className="bg-line/40 px-3 py-1 text-xs font-bold">
            {MONTHS_AR[s.month]} {s.year}
          </span>
        </div>
        <div className="mt-4 max-h-[340px] overflow-y-auto">
          <table className="w-full text-center">
            <thead className="sticky top-0 bg-bg">
              <tr className="border-b border-line text-sm">
                <th className="px-3 py-3">اليوم</th>
                <th className="px-3 py-3">المبيعات ($)</th>
              </tr>
            </thead>
            <tbody>
              {s.days.map((value, i) => {
                const isToday = i + 1 === now.getDate();
                return (
                  <tr
                    key={i}
                    className={cn("border-b border-line/60 last:border-0", isToday && "bg-emerald-500/10")}
                  >
                    <td className="px-3 py-3 text-sm font-bold">
                      يوم {i + 1}
                      {isToday ? <span className="ms-2 text-xs text-emerald-500">(اليوم)</span> : null}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-sm font-bold tabular-nums",
                        value > 0 ? "text-emerald-500" : "text-muted",
                      )}
                    >
                      {usd(value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Monthly */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">مقارنة الأداء الشهري للسنة</h2>
            <p className="text-sm text-muted">نظرة على إجمالي المبيعات لكل شهر خلال السنة الحالية</p>
          </div>
          <span className="bg-line/40 px-3 py-1 text-xs font-bold">سنة {s.year}</span>
        </div>
        <table className="mt-4 w-full text-center">
          <thead>
            <tr className="border-b border-line text-sm">
              <th className="px-3 py-3">الشهر</th>
              <th className="px-3 py-3">المبيعات ($)</th>
            </tr>
          </thead>
          <tbody>
            {s.months.map((value, i) => (
              <tr
                key={i}
                className={cn("border-b border-line/60 last:border-0", i === s.month && "bg-emerald-500/10")}
              >
                <td className="px-3 py-3 text-sm font-bold">{MONTHS_AR[i]}</td>
                <td
                  className={cn(
                    "px-3 py-3 text-sm font-bold tabular-nums",
                    value > 0 ? "text-emerald-500" : "text-muted",
                  )}
                >
                  {usd(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Bar({ label, count, total, max }: { label: string; count: number; total: number; max: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-bold">{label}</span>
        <span className="tabular-nums text-emerald-500">
          {count} طلب ({pct}%)
        </span>
      </div>
      <div className="mt-2 h-2 bg-line/40">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(count / max) * 100}%` }} />
      </div>
    </div>
  );
}
