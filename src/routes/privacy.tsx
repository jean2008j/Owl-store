import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/store/info-page";
import { PRIVACY } from "@/lib/store/pages";
import { useOwl } from "@/lib/store/owl-store";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "Privacy Policy — ATHAR & OWL" }],
  }),
  component: Page,
});

function Page() {
  const lang = useOwl((state) => state.lang);
  return <InfoPage page={PRIVACY[lang]} />;
}
