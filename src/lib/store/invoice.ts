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
  const date = new Date(order.createdAt).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" });

  const rows = order.items
    .map(
      (item, index) => `
      <tr>
        <td class="n">${index + 1}</td>
        <td>${esc(item.name)}</td>
        <td>${esc(item.color)}</td>
        <td>${esc(String(item.size))}</td>
        <td class="n">${item.qty}</td>
        <td class="n">${plain(item.unitPrice)}</td>
        <td class="n">${plain(item.unitPrice * item.qty)}</td>
      </tr>`,
    )
    .join("");

  const hasDiscount = !!order.discount && order.discount > 0;
  const formula =
    plain(order.subtotal) +
    (hasDiscount ? ` − ${plain(order.discount as number)}` : "") +
    ` + (${plain(order.shipping.fee)}) = ${plain(order.total)}`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>فاتورة ${esc(order.ref)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111; background: #fff; font-family: "Cairo", "Segoe UI", Tahoma, Arial, sans-serif; font-size: 14px; line-height: 1.6; }
  .head { text-align: center; border-bottom: 3px double #111; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { font-family: "Oswald", "Arial Narrow", Arial, sans-serif; font-size: 34px; font-weight: 700; letter-spacing: 0.22em; direction: ltr; }
  .sub { margin-top: 2px; font-size: 13px; letter-spacing: 0.1em; color: #444; }
  .meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .meta b { font-size: 16px; direction: ltr; unicode-bidi: embed; }
  .box { border: 1px solid #111; padding: 10px 14px; margin-bottom: 16px; }
  .box h3 { margin: 0 0 6px; font-size: 13px; letter-spacing: 0.06em; color: #444; }
  .line { display: flex; gap: 8px; padding: 2px 0; }
  .line span:first-child { min-width: 90px; color: #444; }
  .line span:last-child { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #111; padding: 7px 8px; text-align: right; }
  th { background: #111; color: #fff; font-size: 13px; }
  td.n, th.n { text-align: center; width: 1%; white-space: nowrap; }
  .totals { margin-right: auto; margin-left: 0; width: 60%; border: 1px solid #111; padding: 8px 14px; }
  .totals .line span:first-child { min-width: 130px; }
  .grand { border-top: 2px solid #111; margin-top: 6px; padding-top: 6px; font-size: 17px; }
  .formula { margin-top: 8px; text-align: center; color: #444; direction: ltr; }
  .foot { margin-top: 28px; text-align: center; color: #444; font-size: 12px; border-top: 1px solid #999; padding-top: 10px; }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">${STORE_NAME}</div>
    <div class="sub">فاتورة طلب</div>
  </div>

  <div class="meta">
    <div>رقم الفاتورة: <b>${esc(order.ref)}</b></div>
    <div>التاريخ: <b>${esc(date)}</b></div>
  </div>

  <div class="box">
    <h3>معلومات الزبون</h3>
    <div class="line"><span>الاسم:</span><span>${esc(order.customer.name)}</span></div>
    <div class="line"><span>الهاتف:</span><span style="direction:ltr;unicode-bidi:embed">${esc(order.customer.phone)}</span></div>
    <div class="line"><span>العنوان:</span><span>${esc(addressLine)}</span></div>
    ${order.shipping.companyId || order.shipping.label ? `<div class="line"><span>شركة الشحن:</span><span>${esc(order.shipping.label)}</span></div>` : ""}
  </div>

  <table>
    <thead>
      <tr><th class="n">#</th><th>المنتج</th><th>اللون</th><th>القياس</th><th class="n">الكمية</th><th class="n">السعر</th><th class="n">المجموع</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="line"><span>مجموع المنتجات:</span><span>${plain(order.subtotal)}</span></div>
    ${hasDiscount ? `<div class="line"><span>الخصم${order.coupon ? ` (${esc(order.coupon)})` : ""}:</span><span>− ${plain(order.discount as number)}</span></div>` : ""}
    <div class="line"><span>الشحن:</span><span>${plain(order.shipping.fee)}</span></div>
    <div class="line grand"><span>قيمة الفاتورة:</span><span>${plain(order.total)}</span></div>
    <div class="formula">${esc(formula)}</div>
  </div>

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
