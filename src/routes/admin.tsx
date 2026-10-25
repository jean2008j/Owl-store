import { createFileRoute } from "@tanstack/react-router";
import { AdminPanel } from "@/components/store/admin-panel";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — ATHAR & OWL" }],
  }),
  component: AdminPanel,
});
