import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, RefreshCw, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  adminUsersCall,
  fetchSecretCode,
  isSupabaseConfigured,
  saveSecretCode,
} from "@/lib/db-service";
import { useOwl } from "@/lib/store/owl-store";
import { cn } from "@/lib/utils";

/** "الأمان" tab: payments (passed in), secret-section code, and the list of admin users. */
export function SecurityTab({ payments }: { payments: ReactNode }) {
  return (
    <div className="flex flex-col gap-12">
      <Block title="المدفوعات والإشعارات" hint="حساب شام كاش وإشعارات تيليغرام.">
        {payments}
      </Block>
      <Block
        title="رمز القسم السري"
        hint="الزبون يحتاج هذا الرمز حتى يفتح «القسم السري» ويشوف المنتجات المقفولة."
      >
        <SecretCodeSection />
      </Block>
      <Block
        title="مستخدمو الإدارة"
        hint="الأشخاص اللي بيقدروا يدخلوا على صفحة الأدمن بالبريد وكلمة السر."
      >
        <AdminUsersSection />
      </Block>
    </div>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-5 border-b border-line pb-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Secret section code                                                  */
/* ------------------------------------------------------------------ */

function SecretCodeSection() {
  const localCode = useOwl((state) => state.settings.secretCode);
  const update = useOwl((state) => state.updateSettings);
  const [code, setCode] = useState(isSupabaseConfigured ? "" : localCode);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    void fetchSecretCode().then((value) => {
      if (!alive) return;
      if (value != null) setCode(value);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    const next = code.trim();
    if (next.length < 3) {
      toast("استخدم 3 أحرف أو أرقام على الأقل.");
      return;
    }
    if (isSupabaseConfigured) {
      setSaving(true);
      const res = await saveSecretCode(next);
      setSaving(false);
      if (!res.ok) {
        toast.error(`ما انحفظ الرمز: ${res.message}`);
        return;
      }
    }
    update({ secretCode: next });
    toast("تم تحديث رمز القسم السري.");
  }

  return (
    <div className="grid max-w-xl gap-4">
      <label className="block">
        <span className="field-label">رمز القسم السري</span>
        <input
          className="field"
          dir="ltr"
          value={code}
          disabled={loading}
          placeholder={loading ? "جاري التحميل..." : "مثال: 4821"}
          onChange={(event) => setCode(event.target.value)}
        />
        <span className="mt-1 block text-xs text-muted">
          غيّر الرمز بأي وقت — الزبائن اللي فتحوا القسم قبل بيحتاجوا يدخلوا الرمز الجديد.
        </span>
      </label>
      <button type="button" className="btn-solid self-start" disabled={saving || loading} onClick={() => void save()}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        حفظ الرمز
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin users                                                          */
/* ------------------------------------------------------------------ */

type AdminUser = {
  id: string;
  email: string;
  password: string | null;
  isSelf: boolean;
  lastSignIn?: string | null;
};

const MIN_PASSWORD = 6;
const emailOk = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

function AdminUsersSection() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [shown, setShown] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminUsersCall("list");
    setLoading(false);
    if (res.ok) {
      setUsers(res.users as AdminUser[]);
      setError("");
    } else {
      setError(res.message ?? "تعذّر جلب المستخدمين.");
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) void load();
  }, [load]);

  if (!isSupabaseConfigured) {
    return (
      <p className="max-w-xl text-sm text-muted">
        إدارة المستخدمين تحتاج ربط Supabase. بالوضع التجريبي الدخول يكون برمز الدخول التجريبي.
      </p>
    );
  }

  async function addUser() {
    if (!emailOk(newEmail)) return toast("اكتب بريد إلكتروني صحيح.");
    if (newPassword.length < MIN_PASSWORD) return toast(`كلمة السر ${MIN_PASSWORD} أحرف على الأقل.`);
    setBusy(true);
    const res = await adminUsersCall("create", { email: newEmail.trim(), password: newPassword });
    setBusy(false);
    if (!res.ok) return toast.error(res.message ?? "تعذّرت إضافة المستخدم.");
    toast("تمت إضافة المستخدم. بيقدر يدخل الآن على صفحة الأدمن.");
    setNewEmail("");
    setNewPassword("");
    void load();
  }

  function startEdit(user: AdminUser) {
    setEditId(user.id);
    setEditEmail(user.email);
    setEditPassword(user.password ?? "");
  }

  async function saveEdit(user: AdminUser) {
    if (!emailOk(editEmail)) return toast("اكتب بريد إلكتروني صحيح.");
    const passwordChanged = editPassword !== (user.password ?? "");
    if (passwordChanged && editPassword.length < MIN_PASSWORD) {
      return toast(`كلمة السر ${MIN_PASSWORD} أحرف على الأقل.`);
    }
    const emailChanged = editEmail.trim().toLowerCase() !== user.email.toLowerCase();
    if (!passwordChanged && !emailChanged) {
      setEditId(null);
      return;
    }
    setBusy(true);
    const res = await adminUsersCall("update", {
      id: user.id,
      ...(emailChanged ? { email: editEmail.trim() } : {}),
      ...(passwordChanged ? { password: editPassword } : {}),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.message ?? "تعذّر حفظ التعديل.");
    toast("تم حفظ التعديل.");
    setEditId(null);
    void load();
  }

  async function removeUser(user: AdminUser) {
    if (!window.confirm(`حذف المستخدم ${user.email}؟ ما رح يقدر يدخل بعدها.`)) return;
    setBusy(true);
    const res = await adminUsersCall("delete", { id: user.id });
    setBusy(false);
    if (!res.ok) return toast.error(res.message ?? "تعذّر الحذف.");
    toast("تم حذف المستخدم.");
    void load();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Add */}
      <div className="max-w-xl rounded-2xl border border-line p-5">
        <h3 className="flex items-center gap-2 font-bold">
          <UserPlus className="size-5 text-emerald-500" />
          إضافة مستخدم جديد
        </h3>
        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="field-label">البريد الإلكتروني</span>
            <input
              className="field"
              dir="ltr"
              type="email"
              autoComplete="off"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="field-label">كلمة السر</span>
            <input
              className="field"
              dir="ltr"
              autoComplete="off"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <span className="mt-1 block text-xs text-muted">{MIN_PASSWORD} أحرف على الأقل.</span>
          </label>
          <button type="button" className="btn-solid self-start" disabled={busy} onClick={() => void addUser()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            إضافة المستخدم
          </button>
        </div>
      </div>

      {/* List */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-bold">المستخدمون الحاليون{users ? ` (${users.length})` : ""}</h3>
          <button type="button" className="btn-line" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            تحديث
          </button>
        </div>

        {error ? (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-500">{error}</p>
        ) : null}

        {users && !users.length ? <p className="text-sm text-muted">ما في مستخدمين.</p> : null}

        <div className="flex flex-col gap-3">
          {users?.map((user) => {
            const editing = editId === user.id;
            const visible = Boolean(shown[user.id]);
            return (
              <article key={user.id} className="rounded-2xl border border-line p-4">
                {editing ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="field-label">البريد الإلكتروني</span>
                      <input
                        className="field"
                        dir="ltr"
                        type="email"
                        value={editEmail}
                        onChange={(event) => setEditEmail(event.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="field-label">كلمة السر</span>
                      <input
                        className="field"
                        dir="ltr"
                        value={editPassword}
                        placeholder="اكتب كلمة سر جديدة"
                        onChange={(event) => setEditPassword(event.target.value)}
                      />
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="button" className="btn-solid" disabled={busy} onClick={() => void saveEdit(user)}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                        حفظ
                      </button>
                      <button type="button" className="btn-line" disabled={busy} onClick={() => setEditId(null)}>
                        <X className="size-4" />
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p dir="ltr" className="truncate text-start font-bold">
                        {user.email}
                        {user.isSelf ? (
                          <span dir="rtl" className="ms-2 text-xs font-normal text-emerald-500">
                            (أنت)
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-sm">
                        <span className="text-muted">كلمة السر:</span>
                        {user.password ? (
                          <span dir="ltr" className="font-mono tabular-nums">
                            {visible ? user.password : "•".repeat(Math.min(user.password.length, 12))}
                          </span>
                        ) : (
                          <span className="text-muted">غير محفوظة — اضغط تعديل وحدّد كلمة سر لتظهر هون</span>
                        )}
                        {user.password ? (
                          <button
                            type="button"
                            className="text-muted hover:text-fg"
                            aria-label={visible ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
                            onClick={() => setShown((s) => ({ ...s, [user.id]: !visible }))}
                          >
                            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        ) : null}
                      </p>
                      {user.lastSignIn ? (
                        <p className="mt-1 text-xs text-muted">
                          آخر دخول: {new Date(user.lastSignIn).toLocaleString("en-GB")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-line" disabled={busy} onClick={() => startEdit(user)}>
                        <Pencil className="size-4" />
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn-line"
                        disabled={busy || user.isSelf}
                        title={user.isSelf ? "ما بتقدر تحذف حسابك الحالي" : "حذف المستخدم"}
                        onClick={() => void removeUser(user)}
                      >
                        <Trash2 className="size-4" />
                        حذف
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
