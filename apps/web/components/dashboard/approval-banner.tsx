"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Banner } from "@repo/ui/components/ui/banner";

interface ApprovalBannerProps {
    count: number;
}

export function ApprovalBanner({ count }: ApprovalBannerProps) {
    const searchParams = useSearchParams();
    const isPastView = searchParams.get("view") === "past";

    if (count === 0) return null;

    return (
        <Link
            href="?view=past"
            className="block relative rounded-lg overflow-hidden group shadow-md transition-all hover:shadow-lg active:scale-[0.995]"
        >
            {/* Crisp Solid Background */}
            <div className="absolute inset-0 bg-linear-to-r from-destructive to-red-600" />

            {/* Content Layer */}
            <div className="relative px-6 py-4 flex items-center justify-between gap-4 text-white">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-full shadow-inner ring-1 ring-white/10">
                        <AlertTriangle className="h-5 w-5 text-white stroke-[2.5]" />
                    </div>
                    <div>
                        <p className="text-base font-bold tracking-tight leading-none text-shadow-sm">
                            ACTION REQUIRED
                        </p>
                        <p className="text-sm font-medium opacity-90 mt-0.5">
                            You have <span className="font-bold border-b border-white/30">{count}</span> completed shifts pending approval.
                        </p>
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-white text-destructive px-4 py-2 rounded-full shadow-sm group-hover:bg-white/95 group-hover:scale-105 transition-all">
                    Review
                </div>
            </div>
        </Link>
    );
}
