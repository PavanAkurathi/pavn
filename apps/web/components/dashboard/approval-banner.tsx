"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
            className="block bg-red-50 border-b border-red-200 px-6 py-3 transition-colors hover:bg-red-100"
        >
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-sm font-medium text-red-900">
                    Action Required: You have <span className="font-bold text-red-700">{count}</span> completed shifts pending approval.
                </p>
            </div>
        </Link>
    );
}
