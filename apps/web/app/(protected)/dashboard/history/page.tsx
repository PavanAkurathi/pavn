import { redirect } from "next/navigation";
import { getDashboardHistoryHref } from "@/lib/routes";

// History is handled by the "Past" tab in the shifts dashboard.
export default function HistoryPage() {
    redirect(getDashboardHistoryHref());
}
