import { redirect } from "next/navigation";

// History is handled by the "Past" tab in /dashboard/shifts?view=past
export default function HistoryPage() {
    redirect("/dashboard/shifts?view=past");
}
