'use client';

import { Check, X, Minus, ArrowRight } from "lucide-react";
import { SUBSCRIPTION } from "@repo/config";
import Link from "next/link";

/**
 * COMPARISON TABLE — Phase 1 (Rewritten Feb 2026)
 *
 * Honest, defensible comparison vs per-user scheduling SaaS (When I Work, etc).
 *
 * RULES:
 * 1. Never claim a competitor LACKS a feature they actually have.
 * 2. Only compare on dimensions where we have a genuine, provable advantage.
 * 3. Use "Partial" / amber icon where competitors offer something differently.
 * 4. Price math must be verifiable from public sources.
 *
 * COMPETITOR PRICING (verified Feb 2026):
 * - When I Work: $2.50/user single-loc, $5/user multi-loc.
 *   Time & attendance add-on: $4–$7/user/mo.
 *   HAS: geofencing, GPS clock-in, shift swap, team messaging, payroll integrations.
 * - Instawork: Marketplace model, 25–60%+ markup. Not a scheduling SaaS (Phase 2 competitor).
 */

// --- DATA ---

interface CellValue {
    value: string | boolean;
    subtext?: string;
}

interface RowData {
    title: string;
    description: string;
    hive: CellValue;
    competitor: CellValue;
    type: "text" | "check";
}

const ROWS: RowData[] = [
    {
        title: "Cost for 40 Staff",
        description:
            "What you actually pay per month for a full team. Per-user pricing punishes growth — every busser or runner you add increases your bill.",
        hive: { value: `$${SUBSCRIPTION.MONTHLY_PRICE_USD}`, subtext: "Flat. Always." },
        competitor: { value: "$160–$280", subtext: "$4–$7 per user/mo" },
        type: "text",
    },
    {
        title: "Cost to Add 10 More Staff",
        description:
            "Seasonal rush? Event weekend? With per-user pricing, scaling up means paying more. With us, it's already included.",
        hive: { value: "$0", subtext: "Unlimited staff included" },
        competitor: { value: "+$40–$70/mo", subtext: "Per-user fee applies" },
        type: "text",
    },
    {
        title: "GPS Geofenced Timeclock",
        description:
            "Workers must be physically at your venue to clock in. Prevents buddy punching and early clock-ins.",
        hive: { value: true, subtext: "Always included" },
        competitor: { value: true, subtext: "Add-on ($1.50+/user)" },
        type: "check",
    },
    {
        title: "Multi-Org Worker View",
        description:
            "Workers see shifts from ALL their employers in one unified schedule — not just yours. Reduces no-shows from double-booking.",
        hive: { value: true, subtext: "Cross-employer unified" },
        competitor: { value: false, subtext: "Single employer only" },
        type: "check",
    },
    {
        title: "Shift Conflict Detection",
        description:
            "Automatically warns when a worker is booked at two venues at the same time — before it becomes a no-show.",
        hive: { value: true, subtext: "Real-time alerts" },
        competitor: { value: false, subtext: "No cross-employer view" },
        type: "check",
    },
    {
        title: "Hospitality-First Design",
        description:
            "Built specifically for restaurants, hotels, and event venues — not retrofitted from retail or healthcare scheduling.",
        hive: { value: true, subtext: "Purpose-built" },
        competitor: { value: "partial", subtext: "Multi-industry" },
        type: "check",
    },
    {
        title: "White-Glove Onboarding",
        description:
            "Send us your spreadsheet — we import your roster, set up locations, and configure geofences for you. Free.",
        hive: { value: true, subtext: "We do it for you" },
        competitor: { value: false, subtext: "Self-serve setup" },
        type: "check",
    },
    {
        title: "No Per-Seat Contracts",
        description: "Month-to-month. Cancel anytime. No minimum seat counts, no annual lock-in.",
        hive: { value: true, subtext: "Month-to-month" },
        competitor: { value: true, subtext: "Month-to-month" },
        type: "check",
    },
];

// --- MAIN COMPONENT ---

export function ComparisonTable() {
    const hiveCost = SUBSCRIPTION.MONTHLY_PRICE_USD;
    const competitorLow = 40 * 4; // $4/user — scheduling + time tracking
    const yearlySavings = (competitorLow - hiveCost) * 12;

    return (
        <section className="py-24 bg-white" id="compare">
            <div className="container mx-auto px-6 max-w-7xl">
                {/* Section Header */}
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <h2 className="text-4xl font-bold text-slate-900 mb-4">
                        Stop Paying the Headcount Tax
                    </h2>
                    <p className="text-lg text-slate-500">
                        Per-user pricing was designed for desk workers with salaries. In hospitality,
                        your team size changes weekly. That's why we charge per location — not per
                        person.
                    </p>
                </div>

                {/* Savings Callout */}
                <div className="max-w-2xl mx-auto mb-16 bg-slate-900 rounded-2xl p-8 text-center text-white">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Typical venue with 40 staff saves
                    </p>
                    <p className="text-5xl md:text-6xl font-extrabold tracking-tight">
                        ${yearlySavings.toLocaleString()}
                        <span className="text-2xl text-slate-400 font-normal">/year</span>
                    </p>
                    <p className="text-slate-400 mt-3 text-sm">
                        vs per-user apps at $4/user/mo with time tracking. Math: (${competitorLow} − $
                        {hiveCost}) × 12.
                    </p>
                </div>

                {/* Comparison Grid */}
                <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                    <div className="overflow-x-auto">
                        <div className="grid grid-cols-12 text-white min-w-[768px]">
                            {/* --- HEADERS --- */}
                            <div className="col-span-6 p-8 border-b border-white/10 flex items-end">
                                <span className="text-2xl font-bold tracking-tight">Feature</span>
                            </div>

                            {/* Workers Hive Header */}
                            <div className="col-span-3 p-8 border-b border-white/10 bg-zinc-800/50 flex flex-col items-center justify-center relative">
                                <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-500"></div>
                                <div className="flex items-center gap-2 font-bold text-xl mb-1">
                                    <div className="w-6 h-6 bg-white text-black rounded flex items-center justify-center text-xs font-black">
                                        W
                                    </div>
                                    Workers Hive
                                </div>
                                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                                    ${SUBSCRIPTION.MONTHLY_PRICE_USD}/mo flat
                                </span>
                            </div>

                            {/* Competitor Header */}
                            <div className="col-span-3 p-8 border-b border-white/10 flex flex-col items-center justify-center">
                                <div className="text-xl font-bold text-slate-300 mb-1">Per-User Apps</div>
                                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                    When I Work, etc.
                                </span>
                            </div>

                            {/* --- ROWS --- */}
                            {ROWS.map((row, i) => (
                                <Row key={row.title} {...row} last={i === ROWS.length - 1} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Fine Print — transparency builds trust */}
                <div className="mt-8 max-w-4xl mx-auto">
                    <p className="text-xs text-slate-400 text-center leading-relaxed">
                        Competitor pricing based on publicly listed When I Work rates (2026):
                        $2.50–$5/user/mo for scheduling, $4–$7/user/mo with time &amp; attendance.
                        "Multi-Org Worker View" and "Shift Conflict Detection" refer to
                        cross-employer functionality where workers employed by multiple venues see a
                        unified schedule. When I Work supports multi-location within a single employer
                        account.
                    </p>
                </div>

                {/* CTA */}
                <div className="text-center mt-12">
                    <Link href="/auth/signup">
                        <button className="h-14 px-10 rounded-xl bg-red-600 text-white font-bold text-lg hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 inline-flex items-center gap-2">
                            Start Free Trial <ArrowRight className="w-5 h-5" />
                        </button>
                    </Link>
                    <p className="text-sm text-slate-500 mt-3">
                        {SUBSCRIPTION.TRIAL_DAYS}-day free trial · No credit card · Cancel anytime
                    </p>
                </div>
            </div>
        </section>
    );
}

// --- SUB-COMPONENTS ---

function Row({
    title,
    description,
    hive,
    competitor,
    type,
    last = false,
}: RowData & { last?: boolean }) {
    return (
        <>
            {/* Feature info */}
            <div
                className={`col-span-6 p-8 flex flex-col justify-center ${!last ? "border-b border-white/10" : ""}`}
            >
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-md">{description}</p>
            </div>

            {/* Workers Hive value */}
            <div
                className={`col-span-3 p-6 flex flex-col items-center justify-center bg-slate-800/50 ${!last ? "border-b border-white/10" : ""}`}
            >
                {type === "text" ? (
                    <div className="text-center">
                        <span className="text-2xl font-bold text-white">
                            {hive.value as string}
                        </span>
                        {hive.subtext && (
                            <p className="text-xs text-emerald-400 font-medium mt-1">
                                {hive.subtext}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <StatusIcon status={hive.value as boolean} />
                        {hive.subtext && (
                            <span className="text-xs text-emerald-400 font-medium mt-1">
                                {hive.subtext}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Competitor value */}
            <div
                className={`col-span-3 p-6 flex flex-col items-center justify-center ${!last ? "border-b border-white/10" : ""}`}
            >
                {type === "text" ? (
                    <div className="text-center">
                        <span className="text-xl font-medium text-slate-400">
                            {competitor.value as string}
                        </span>
                        {competitor.subtext && (
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                {competitor.subtext}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <StatusIcon
                            status={competitor.value as boolean | string}
                            isCompetitor
                        />
                        {competitor.subtext && (
                            <span className="text-xs text-slate-500 font-medium mt-1">
                                {competitor.subtext}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

function StatusIcon({
    status,
    isCompetitor = false,
}: {
    status: boolean | string;
    isCompetitor?: boolean;
}) {
    // TRUE — green check
    if (status === true) {
        return (
            <div className="relative flex items-center justify-center w-10 h-10">
                {!isCompetitor && (
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-pulse"></div>
                )}
                <div
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${isCompetitor
                            ? "bg-emerald-600/30 shadow-none"
                            : "bg-emerald-500 shadow-emerald-500/30"
                        }`}
                >
                    <Check
                        className={`w-5 h-5 stroke-[3] ${isCompetitor ? "text-emerald-400" : "text-zinc-900"
                            }`}
                    />
                </div>
            </div>
        );
    }

    // "partial" — amber dash (feature exists but limited / is an add-on)
    if (status === "partial") {
        return (
            <div className="w-8 h-8 bg-amber-500/15 border border-amber-500/25 rounded-full flex items-center justify-center">
                <Minus className="w-4 h-4 text-amber-400" />
            </div>
        );
    }

    // FALSE — red X
    return (
        <div className="w-8 h-8 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-red-400" />
        </div>
    );
}
