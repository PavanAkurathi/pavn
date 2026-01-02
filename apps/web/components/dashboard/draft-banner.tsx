"use client";

import { FileText } from "lucide-react";
import Link from "next/link";

interface DraftBannerProps {
    count: number;
}

export function DraftBanner({ count }: DraftBannerProps) {
    if (count === 0) return null;

    return (
        <Link
            href="/dashboard/shifts?view=draft"
            className="block bg-yellow-50 border-b border-yellow-200 px-6 py-3 transition-colors hover:bg-yellow-100"
        >
            <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-yellow-600" />
                <p className="text-sm font-medium text-yellow-900">
                    You have <span className="font-bold text-yellow-700">{count}</span> unsaved draft shifts. Click to resume.
                </p>
            </div>
        </Link>
    );
}
