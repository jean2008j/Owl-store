import { supabase } from "@/lib/db-service";
// إرسال الطلب إلى تلغرام مباشرة من المتصفح (بدون سيرفر).
export type NotifyInput = {
  botToken: string;
  chatId: string;
  ref: string;
  text: string;
  receiptDataUrl: string;
};

export type NotifyResult = {
  status: "sent" | "failed" | "unconfigured";
  detail: string;
};

function receiptToBlob(dataUrl: string): { blob: Blob; filename: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl || "");
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const binary = atob(match[2].replace(/\s/g, ""));
  if (!binary.length || binary.length > 4_500_000) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return {
    blob: new Blob([bytes], { type: mime }),
    filename: `receipt-${Date.now()}.${mime.endsWith("png") ? "png" : "jpg"}`,
  };
}

async function call(token: string, method: string, body: BodyInit, json = false) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body,
    signal: AbortSignal.timeout(15000),
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || "Telegram rejected the update.");
  }
}

export async function notifyOrder({ data }: { data: NotifyInput }): Promise<NotifyResult> {
  // الطريقة الآمنة: عبر Supabase Edge Function (التوكن محفوظ عند Supabase)
  if (supabase) {
    const { data: res, error } = await supabase.functions.invoke("notify-order", {
      body: { ref: data.ref, text: data.text, receiptDataUrl: data.receiptDataUrl },
    });
    if (error) return { status: "failed", detail: error.message };
    return res as NotifyResult;
  }
  const token = (data.botToken || "").trim();
  const chatId = (data.chatId || "").trim();
  const text = data.text.slice(0, 3900);
  if (!token || !chatId) {
    return {
      status: "unconfigured",
      detail: "Order saved here. Add a Telegram bot token and chat ID in Admin to forward it.",
    };
  }
  if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return { status: "failed", detail: "The Telegram bot token does not look valid." };
  }
  if (!/^-?\d{4,}$/.test(chatId) && !/^@[A-Za-z0-9_]{4,}$/.test(chatId)) {
    return { status: "failed", detail: "The Telegram chat ID does not look valid." };
  }

  try {
    const receipt = receiptToBlob(data.receiptDataUrl);
    if (receipt && text.length <= 1000) {
      const form = new FormData();
      form.set("chat_id", chatId);
      form.set("caption", text);
      form.set("photo", receipt.blob, receipt.filename);
      await call(token, "sendPhoto", form);
    } else {
      await call(token, "sendMessage", JSON.stringify({ chat_id: chatId, text }), true);
      if (receipt) {
        const form = new FormData();
        form.set("chat_id", chatId);
        form.set("caption", `Sham Cash receipt · ${data.ref}`);
        form.set("photo", receipt.blob, receipt.filename);
        await call(token, "sendPhoto", form);
      }
    }
    return { status: "sent", detail: "Sent to Telegram with the receipt." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Telegram could not be reached.";
    return { status: "failed", detail };
  }
}
