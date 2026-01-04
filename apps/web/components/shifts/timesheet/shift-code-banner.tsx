// apps/web/components/shifts/timesheet/shift-code-banner.tsx

'use client';
import { Hash, Info } from "lucide-react";

interface ShiftCodeBannerProps {
    clockInCode: string;
    clockOutCode: string;
    expiresAt: string; // "Expires in 12 hours"
}

export function ShiftCodeBanner({ clockInCode, clockOutCode, expiresAt }: ShiftCodeBannerProps) {
    return (
        <div className="mb-6 flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-start gap-3">
                <div className="rounded-full bg-zinc-100 p-2 text-zinc-700">
                    <Hash className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-900">Shift Verification Codes</h3>
                    <p className="text-xs text-gray-600">
                        Share these codes with workers to verify their arrival and departure.
                        <span className="ml-1 inline-flex items-center text-zinc-600">
                            {expiresAt} <Info className="ml-1 h-3 w-3" />
                        </span>
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Clock In Code */}
                <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Clock In</span>
                    <div className="font-mono text-2xl font-bold tracking-widest text-gray-900">
                        {clockInCode}
                    </div>
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-gray-300" />

                {/* Clock Out Code */}
                <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Clock Out</span>
                    <div className="font-mono text-2xl font-bold tracking-widest text-gray-900">
                        {clockOutCode}
                    </div>
                </div>
            </div>

        </div>
    );
}
