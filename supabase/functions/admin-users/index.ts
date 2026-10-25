// Supabase Edge Function: إدارة مستخدمي لوحة الأدمن (عرض / إضافة / تعديل / حذف)
// تشتغل بمفتاح service_role (متوفر تلقائياً داخل Supabase) ولا تقبل إلا مستخدماً مسجّل دخول.
// نشرها:  supabase functions deploy admin-users
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const fail = (message: string) => reply({ ok: false, message });

function friendly(message: string) {
  if (/already (been )?registered|already exists/i.test(message)) return "هذا البريد مستخدم من قبل.";
  if (/password/i.test(message) && /(short|least|weak)/i.test(message)) return "كلمة السر ضعيفة أو قصيرة (6 أحرف على الأقل).";
  if (/invalid.*email|email.*invalid/i.test(message)) return "البريد الإلكتروني غير صحيح.";
  return message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1) الطالب لازم يكون مستخدماً مسجّل دخول (مفتاح anon وحده ما يكفي)
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: me, error: meErr } = await caller.auth.getUser();
    if (meErr || !me?.user) return reply({ ok: false, message: "غير مصرّح. سجّل الدخول من جديد." }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) return fail(friendly(error.message));
      const { data: creds } = await admin.from("admin_credentials").select("user_id, password");
      const pw = new Map((creds ?? []).map((c: { user_id: string; password: string }) => [c.user_id, c.password]));
      const users = data.users
        .map((u) => ({
          id: u.id,
          email: u.email ?? "",
          password: pw.get(u.id) ?? null,
          isSelf: u.id === me.user.id,
          lastSignIn: u.last_sign_in_at ?? null,
          createdAt: u.created_at,
        }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return reply({ ok: true, users });
    }

    if (action === "create") {
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      if (!email || password.length < 6) return fail("البريد وكلمة السر (6 أحرف على الأقل) مطلوبين.");
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return fail(friendly(error.message));
      await admin.from("admin_credentials").upsert({ user_id: data.user.id, password });
      return reply({ ok: true });
    }

    if (action === "update") {
      const id = String(body.id ?? "");
      if (!id) return fail("المستخدم غير محدد.");
      const attrs: { email?: string; password?: string; email_confirm?: boolean } = {};
      if (body.email) {
        attrs.email = String(body.email).trim();
        attrs.email_confirm = true;
      }
      if (body.password) {
        if (String(body.password).length < 6) return fail("كلمة السر 6 أحرف على الأقل.");
        attrs.password = String(body.password);
      }
      const { error } = await admin.auth.admin.updateUserById(id, attrs);
      if (error) return fail(friendly(error.message));
      if (attrs.password) await admin.from("admin_credentials").upsert({ user_id: id, password: attrs.password });
      return reply({ ok: true });
    }

    if (action === "delete") {
      const id = String(body.id ?? "");
      if (!id) return fail("المستخدم غير محدد.");
      if (id === me.user.id) return fail("ما بتقدر تحذف حسابك الحالي.");
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return fail(friendly(error.message));
      await admin.from("admin_credentials").delete().eq("user_id", id);
      return reply({ ok: true });
    }

    return fail("إجراء غير معروف.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "خطأ غير معروف");
  }
});
