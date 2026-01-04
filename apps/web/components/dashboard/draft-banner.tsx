"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { Banner } from "@repo/ui/components/ui/banner";

interface DraftBannerProps {
    count: number;
}

export function DraftBanner({ count }: DraftBannerProps) {
    if (count === 0) return null;

    return (
        <Link href="/dashboard/schedule/create" className="group block">
            <Banner
                variant="warning"
                className="max-w-4xl mt-6 mb-2 cursor-pointer"
                icon={<FileText />}
                action={
                    <div className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-zinc-900 text-yellow-50 px-4 py-2 rounded-full shadow-sm group-hover:bg-zinc-800 group-hover:scale-105 transition-all">
                        Resume
                    </div>
                }
            >
                <div>
                    <p className="text-base font-bold tracking-tight leading-none">
                        DRAFT MODE
                    </p>
                    <p className="text-sm font-medium opacity-90 mt-0.5">
                        You have <span className="font-bold border-b border-zinc-900/20">{count}</span> unsaved shifts.
                    </p>
                </div>
            </Banner>
        </Link>
    );
}
