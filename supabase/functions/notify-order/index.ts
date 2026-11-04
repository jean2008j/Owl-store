// Supabase Edge Function: يرسل الطلب + صورة الإيصال إلى تلغرام
// التوكن وال chat id محفوظين كـ Secrets عند Supabase ومو ظاهرين للزبون
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });

// Never let the bot token leak into logs or into the message the customer's browser receives.
const mask = (value: string, token?: string) => {
  let out = value;
  if (token) out = out.split(token).join("<token>");
  return out.replace(/bot\d{6,}:[A-Za-z0-9_-]{20,}/g, "bot<token>");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let token: string | undefined;
  try {
    const { ref, text, receiptDataUrl } = await req.json();
    token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!token || !chatId) {
      console.error(`notify-order ${ref}: secrets missing (token set: ${Boolean(token)}, chat id set: ${Boolean(chatId)})`);
      return reply({ status: "unconfigured", detail: "Telegram secrets are not set." });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order, error: orderError } = await sb.from("orders").select("data, created_at").eq("ref", ref).maybeSingle();
    if (orderError) console.error(`notify-order ${ref}: order lookup error: ${orderError.message}`);
    if (!order) return reply({ status: "failed", detail: "Order not found." });
    const tooOld = Date.now() - new Date(order.created_at).getTime() > 15 * 60 * 1000;
    if (tooOld || order.data?.telegram === "sent") return reply({ status: "failed", detail: "Order already notified or too old." });

    const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;
    let r = await fetch(api("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 3900) }),
    });
    let j = await r.json();
    if (!j.ok) {
      console.error(`notify-order ${ref}: sendMessage rejected: ${r.status} ${j.error_code ?? ""} ${j.description ?? ""}`);
      return reply({ status: "failed", detail: j.description ?? "Telegram rejected the message." });
    }

    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(receiptDataUrl || "");
    if (m) {
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.set("chat_id", chatId);
      form.set("caption", `Sham Cash receipt · ${ref}`);
      form.set("photo", new Blob([bytes], { type: m[1] }), "receipt.jpg");
      r = await fetch(api("sendPhoto"), { method: "POST", body: form });
      j = await r.json();
      if (!j.ok) {
        console.error(`notify-order ${ref}: sendPhoto rejected: ${r.status} ${j.error_code ?? ""} ${j.description ?? ""}`);
        return reply({ status: "failed", detail: j.description ?? "Receipt photo failed." });
      }
    }

    await sb.from("orders").update({ data: { ...order.data, telegram: "sent" } }).eq("ref", ref);
    return reply({ status: "sent", detail: "Sent to Telegram with the receipt." });
  } catch (e) {
    const raw = e instanceof Error ? `${e.name}: ${e.message}` : "Unexpected error.";
    const safe = mask(raw, token);
    console.error(`notify-order: exception: ${safe}`);
    return reply({ status: "failed", detail: safe });
  }
});
