import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { getShiftById, getShiftTimesheets } from "@/lib/api/shifts";
import { DASHBOARD_SHIFTS_PATH } from "@/lib/routes";
import { PrintToolbar } from "./print-toolbar";

interface PageProps {
    params: Promise<{ shiftId: string }>;
}

const EXTRA_BLANK_ROWS = 4;

export default async function ShiftSignInSheetPage({ params }: PageProps) {
    const { shiftId } = await params;

    if (!shiftId) {
        redirect(DASHBOARD_SHIFTS_PATH);
    }

    const [shift, timesheets] = await Promise.all([
        getShiftById(shiftId),
        getShiftTimesheets(shiftId),
    ]);

    if (!shift) {
        notFound();
    }

    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const rows = [...timesheets, ...Array.from({ length: EXTRA_BLANK_ROWS }, () => null)];

    return (
        <div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
            {/* Hide the app chrome when printing */}
            <style>{`@media print { header, nav, .print-hidden { display: none !important; } body { background: white; } }`}</style>

            <PrintToolbar />

            <div className="border-b-2 border-black pb-4">
                <h1 className="text-2xl font-bold">Shift Sign-In Sheet</h1>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                    <p><span className="font-semibold">Location:</span> {shift.locationName}</p>
                    <p><span className="font-semibold">Role:</span> {shift.title}</p>
                    <p><span className="font-semibold">Date:</span> {format(start, "EEEE, MMMM d, yyyy")}</p>
                    <p>
                        <span className="font-semibold">Scheduled:</span>{" "}
                        {format(start, "h:mm a")} – {format(end, "h:mm a")}
                    </p>
                </div>
            </div>

            <table className="mt-6 w-full border-collapse text-sm">
                <thead>
                    <tr>
                        <th className="border border-black px-2 py-2 text-left">#</th>
                        <th className="border border-black px-2 py-2 text-left">Name</th>
                        <th className="border border-black px-2 py-2 text-left">Agency</th>
                        <th className="w-24 border border-black px-2 py-2 text-left">Start</th>
                        <th className="w-24 border border-black px-2 py-2 text-left">End</th>
                        <th className="w-20 border border-black px-2 py-2 text-left">Break</th>
                        <th className="w-36 border border-black px-2 py-2 text-left">Signature</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((entry, index) => (
                        <tr key={entry ? entry.id : `blank-${index}`}>
                            <td className="border border-black px-2 py-4 align-bottom">{index + 1}</td>
                            <td className="border border-black px-2 py-4 align-bottom">
                                {entry?.name ?? ""}
                            </td>
                            <td className="border border-black px-2 py-4 align-bottom">
                                {entry?.isTemp ? (entry.agency ?? "Temp") : ""}
                            </td>
                            <td className="border border-black px-2 py-4" />
                            <td className="border border-black px-2 py-4" />
                            <td className="border border-black px-2 py-4" />
                            <td className="border border-black px-2 py-4" />
                        </tr>
                    ))}
                </tbody>
            </table>

            <p className="mt-6 text-xs text-neutral-600">
                Manager signature: ______________________________ &nbsp;&nbsp; Date: ______________
            </p>
        </div>
    );
}
