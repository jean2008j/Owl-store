import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock, LockOpen } from "lucide-react";
import { ProductCard } from "@/components/store/product-card";
import { fetchSecretProducts, isSupabaseConfigured } from "@/lib/db-service";
import { useOwl } from "@/lib/store/owl-store";

export const Route = createFileRoute("/secret")({
  head: () => ({
    meta: [{ title: "Secret Section — ATHAR & OWL" }],
  }),
  component: SecretPage,
});

function SecretPage() {
  const lang = useOwl((state) => state.lang);
  const ar = lang === "ar";
  const unlocked = useOwl((state) => state.secretUnlocked);
  const unlockSecret = useOwl((state) => state.unlockSecret);
  const lockSecret = useOwl((state) => state.lockSecret);
  const localCode = useOwl((state) => state.settings.secretCode);
  const products = useOwl((state) => state.products).filter((product) => product.secret);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const wrong = ar ? "الرمز غير صحيح." : "Wrong code.";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    if (isSupabaseConfigured) {
      const res = await fetchSecretProducts(value);
      if (res.ok) {
        unlockSecret(value, res.products);
        setCode("");
      } else {
        setError(res.message ?? wrong);
      }
    } else if (value === localCode) {
      unlockSecret(value);
      setCode("");
    } else {
      setError(wrong);
    }
    setBusy(false);
  }

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
        <span className="inline-flex size-12 items-center justify-center border border-line">
          <Lock className="size-5" />
        </span>
        <h1 className="mt-6 font-display text-4xl uppercase leading-none">
          {ar ? "القسم السري" : "Secret Section"}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {ar ? "هذا القسم مقفول. اكتب الرمز السري لتشاهد المنتجات." : "This section is locked. Enter the code to see the pieces."}
        </p>
        <form className="mt-8 flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
          <input
            type="password"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="field"
            aria-label={ar ? "الرمز السري" : "Secret code"}
          />
          {error ? <p className="text-sm text-muted">{error}</p> : null}
          <button type="submit" className="btn-solid" disabled={busy}>
            {busy ? (ar ? "جاري التحقق..." : "Checking...") : ar ? "فتح" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <p className="font-display text-xs tracking-brand text-muted uppercase">ATHAR &amp; OWL</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <h1 className="font-display text-4xl uppercase leading-none md:text-6xl">
          {ar ? "القسم السري" : "Secret Section"}
        </h1>
        <button type="button" className="btn-line" onClick={lockSecret}>
          <LockOpen className="size-4" />
          {ar ? "قفل" : "Lock"}
        </button>
      </div>
      {products.length === 0 ? (
        <p className="mt-16 text-muted">{ar ? "لا توجد منتجات هنا حالياً." : "Nothing here yet."}</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
