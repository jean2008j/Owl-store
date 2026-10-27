import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { checkStorePassword, fetchStoreGateEnabled, isSupabaseConfigured } from "@/lib/db-service";
import { useOwl } from "@/lib/store/owl-store";

const GATE_KEY = "owl-store-gate";

function readSaved(): string {
  try {
    return window.sessionStorage.getItem(GATE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeSaved(code: string) {
  try {
    if (code) window.sessionStorage.setItem(GATE_KEY, code);
    else window.sessionStorage.removeItem(GATE_KEY);
  } catch {
    /* private mode — the customer just has to type it again on the next visit */
  }
}

export type GateStatus = "checking" | "locked" | "open";

/**
 * Decides whether the customer must type the store password before seeing the shop.
 * - Supabase: the admin's setting lives in the database (table store_gate). If it cannot be read
 *   (offline, or supabase-store-gate.sql was not run yet) the shop stays open.
 * - Demo mode (no Supabase): the setting is the local one from the admin "الأمان" tab.
 * The password is remembered for the current browser session only, and re-checked on every load,
 * so changing the password in the admin panel takes effect on the customer's next visit.
 */
export function useStoreGate(skip: boolean): { status: GateStatus; unlock: (code: string) => void } {
  const hydrated = useOwl((state) => state.hydrated);
  const [status, setStatus] = useState<GateStatus>(skip ? "open" : "checking");

  useEffect(() => {
    if (skip) {
      setStatus("open");
      return;
    }
    if (!hydrated) return;
    let live = true;
    const saved = readSaved();

    if (isSupabaseConfigured) {
      void fetchStoreGateEnabled().then(async (enabled) => {
        if (!live) return;
        if (enabled !== true) {
          setStatus("open");
          return;
        }
        if (!saved) {
          setStatus("locked");
          return;
        }
        const res = await checkStorePassword(saved);
        if (!live) return;
        if (res.ok) setStatus("open");
        else {
          writeSaved("");
          setStatus("locked");
        }
      });
    } else {
      const { storePasswordEnabled, storePassword } = useOwl.getState().settings;
      if (!storePasswordEnabled || !storePassword) setStatus("open");
      else if (saved === storePassword) setStatus("open");
      else setStatus("locked");
    }
    return () => {
      live = false;
    };
  }, [skip, hydrated]);

  const unlock = useCallback((code: string) => {
    writeSaved(code);
    setStatus("open");
  }, []);

  return { status, unlock };
}

export function StoreGate({ onUnlock }: { onUnlock: (code: string) => void }) {
  const lang = useOwl((state) => state.lang);
  const setLang = useOwl((state) => state.setLang);
  const ar = lang === "ar";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    let ok = false;
    if (isSupabaseConfigured) {
      const res = await checkStorePassword(value);
      ok = res.ok;
      if (!ok) {
        setError(
          res.rateLimited
            ? ar
              ? "محاولات كثيرة. حاول مجددًا بعد قليل."
              : "Too many attempts. Try again in a few minutes."
            : ar
              ? "كلمة السر غير صحيحة."
              : "Wrong password.",
        );
      }
    } else {
      ok = value === useOwl.getState().settings.storePassword;
      if (!ok) setError(ar ? "كلمة السر غير صحيحة." : "Wrong password.");
    }
    setBusy(false);
    if (ok) {
      setCode("");
      onUnlock(value);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="font-display text-sm tracking-brand text-muted uppercase">Athar &amp; Owl</p>
        <span className="mt-6 inline-flex size-12 items-center justify-center border border-line">
          <Lock className="size-5" />
        </span>
        <h1 className="mt-6 font-display text-4xl uppercase leading-none">
          {ar ? "المتجر مقفول" : "Store Locked"}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {ar ? "اكتب كلمة السر لتدخل المتجر." : "Enter the password to enter the store."}
        </p>
        <form className="mt-8 flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
          <input
            type="password"
            dir="ltr"
            autoComplete="off"
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="field"
            aria-label={ar ? "كلمة السر" : "Password"}
          />
          {error ? <p className="text-sm text-muted">{error}</p> : null}
          <button type="submit" className="btn-solid" disabled={busy}>
            {busy ? (ar ? "جاري التحقق..." : "Checking...") : ar ? "دخول" : "Enter"}
          </button>
        </form>
        <button
          type="button"
          className="mt-8 text-xs text-muted underline-offset-4 hover:underline"
          onClick={() => setLang(ar ? "en" : "ar")}
        >
          {ar ? "English" : "العربية"}
        </button>
      </div>
    </div>
  );
}
