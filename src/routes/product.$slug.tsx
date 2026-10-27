import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { QuickView } from "@/components/store/quick-view";
import { useOwl } from "@/lib/store/owl-store";

// Mobile product page: same content as the "View details" card, but as a full page
// with the whole picture visible. On desktop the card is still used, so we go back to the shop.
export const Route = createFileRoute("/product/$slug")({
  head: () => ({ meta: [{ title: "ATHAR & OWL" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const hydrated = useOwl((state) => state.hydrated);
  const product = useOwl((state) =>
    state.products.find((item) => item.id === slug || item.slug === slug),
  );

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: "/shop", search: { cat: "all" } });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Big screens keep the popup card, so there is no standalone page for them.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      void navigate({ to: "/shop", search: { cat: "all" }, replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (hydrated && !product) void navigate({ to: "/shop", search: { cat: "all" }, replace: true });
  }, [hydrated, product, navigate]);

  if (!product) return <div className="min-h-[60svh]" />;

  return (
    <div className="px-3 pb-10">
      <QuickView key={product.id} product={product} onClose={goBack} page />
    </div>
  );
}
