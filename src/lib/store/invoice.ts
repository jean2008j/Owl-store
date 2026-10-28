import { CITY_AR } from "@/lib/i18n/content";
import type { Order } from "@/lib/store/catalog";

const STORE_NAME = "ATHAR & OWL";

const plain = (value: number) => String(Number(value.toFixed(2)));

const esc = (value: string) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Printable invoice with the same details the store owner gets on Telegram, in a tidy layout. */
export function buildInvoiceHtml(order: Order) {
  const city = CITY_AR[order.customer.city] ?? order.customer.city;
  const address = (order.customer.address || "").replace(/\s*\n+\s*/g, "، ").trim();
  const addressLine = `${city}${address ? ` (${address})` : ""}`;
  const date = new Date(order.createdAt).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
  const usd = (value: number) => `<span class="usd">$${plain(value)}</span>`;

  const rows = order.items
    .map(
      (item, index) => `
      <tr>
        <td class="c n">${index + 1}</td>
        <td class="c">${esc(item.name)}</td>
        <td class="c">${esc(item.color)}</td>
        <td class="c">${esc(String(item.size))}</td>
        <td class="c n">${item.qty}</td>
        <td class="c n">${usd(item.unitPrice)}</td>
        <td class="c n">${usd(item.unitPrice * item.qty)}</td>
      </tr>`,
    )
    .join("");

  const hasDiscount = !!order.discount && order.discount > 0;
  const infoRows = [
    ["الاسم", esc(order.customer.name)],
    ["الهاتف", `<span class="ltr">${esc(order.customer.phone)}</span>`],
    ["العنوان", esc(addressLine)],
    ...(order.shipping.companyId || order.shipping.label ? [["شركة الشحن", esc(order.shipping.label)]] : []),
  ]
    .map(([label, value]) => `<tr><th class="label">${label}</th><td>${value}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(order.ref)}</title>
<style>
  /* margin 0 hides the browser's own date / title / address header and footer; the invoice prints its own */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 12mm 14mm; color: #111; background: #fff; font-family: "Cairo", "Segoe UI", Tahoma, Arial, sans-serif; font-size: 14px; line-height: 1.6; }
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12px; margin-bottom: 6px; }
  .top .ref { font-weight: 700; direction: ltr; unicode-bidi: embed; }
  .top .date { direction: ltr; unicode-bidi: embed; }
  .head { text-align: center; border-bottom: 3px double #111; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { font-family: "Oswald", "Arial Narrow", Arial, sans-serif; font-size: 34px; font-weight: 700; letter-spacing: 0.22em; direction: ltr; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 7px 10px; text-align: right; }
  th.label { width: 28%; background: #f2f2f2; font-weight: 700; }
  .products th { background: #111; color: #fff; font-size: 13px; }
  .c { text-align: center; }
  td.n, th.n { white-space: nowrap; }
  .products .n { width: 1%; }
  .ltr { direction: ltr; unicode-bidi: embed; }
  .usd { direction: ltr; unicode-bidi: isolate; display: inline-block; }
  .totals { margin-top: 14px; }
  .totals td:last-child { text-align: center; font-weight: 700; }
  .totals tr.grand th, .totals tr.grand td { font-size: 16px; border-top: 2px solid #111; }
  .foot { margin-top: 28px; text-align: center; color: #444; font-size: 12px; border-top: 1px solid #999; padding-top: 10px; }
</style>
</head>
<body>
  <div class="top">
    <div class="ref">${esc(order.ref)}</div>
    <div class="date">${esc(date)}</div>
  </div>
  <div class="head">
    <div class="brand">${STORE_NAME}</div>
  </div>

  <table class="info">
    <tbody>${infoRows}</tbody>
  </table>

  <table class="products">
    <thead>
      <tr><th class="c n">#</th><th class="c">المنتج</th><th class="c">اللون</th><th class="c">القياس</th><th class="c n">الكمية</th><th class="c n">السعر</th><th class="c n">المجموع</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr><th class="label">مجموع المنتجات</th><td>${usd(order.subtotal)}</td></tr>
      ${hasDiscount ? `<tr><th class="label">الخصم${order.coupon ? ` (${esc(order.coupon)})` : ""}</th><td><span class="usd">− $${plain(order.discount as number)}</span></td></tr>` : ""}
      <tr><th class="label">الشحن</th><td>${usd(order.shipping.fee)}</td></tr>
      <tr class="grand"><th class="label">قيمة الفاتورة</th><td>${usd(order.total)}</td></tr>
    </tbody>
  </table>

  <div class="foot">شكرًا لتسوقكم من ${STORE_NAME}</div>
</body>
</html>`;
}

/** Prints through a hidden iframe (no pop-up window, so it is not blocked on phones). */
export function printOrderInvoice(order: Order) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const cleanup = () => window.setTimeout(() => frame.remove(), 1000);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }
  doc.open();
  doc.write(buildInvoiceHtml(order));
  doc.close();
  win.addEventListener("afterprint", cleanup);
  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
  return true;
}
