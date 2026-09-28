"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Banner } from "@repo/ui/components/ui/banner";
import { getSchedulerHref } from "@/lib/routes";
import type { Shift } from "@/lib/types";

interface DraftBannerProps {
    drafts: Shift[];
}

export function DraftBanner({ drafts }: DraftBannerProps) {
    if (drafts.length === 0) return null;

    // Land in the Scheduler on the week the drafts are in: that's where they
    // are reviewed and published. The earliest is the week most likely chased.
    const earliest = drafts.reduce((soonest, shift) =>
        parseISO(shift.startTime) < parseISO(soonest.startTime) ? shift : soonest,
    );
    const href = getSchedulerHref({ week: format(parseISO(earliest.startTime), "yyyy-MM-dd") });

    return (
        <Link href={href} className="group block">
            <Banner
                variant="warning"
                className="max-w-4xl mt-6 mb-2 cursor-pointer"
                icon={<FileText />}
                action={
                    <div className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-zinc-900 text-yellow-50 px-4 py-2 rounded-full shadow-sm group-hover:bg-zinc-800 group-hover:scale-105 transition-all">
                        Review
                    </div>
                }
            >
                <div>
                    <p className="text-base font-bold tracking-tight leading-none">
                        DRAFT MODE
                    </p>
                    <p className="text-sm font-medium opacity-90 mt-0.5">
                        <span className="font-bold border-b border-zinc-900/20">{drafts.length}</span>{" "}
                        unpublished shift{drafts.length === 1 ? "" : "s"} from{" "}
                        {format(parseISO(earliest.startTime), "MMM d")}. Nobody has been told yet.
                    </p>
                </div>
            </Banner>
        </Link>
    );
}
