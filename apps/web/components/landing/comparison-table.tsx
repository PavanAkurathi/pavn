'use client';

import { Check, X, Minus, ArrowRight } from "lucide-react";
import { SUBSCRIPTION } from "@repo/config";
import Link from "next/link";

const win2kFont = { fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif' };

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
        description: "What you actually pay per month for a full team.",
        hive: { value: `$${SUBSCRIPTION.MONTHLY_PRICE_USD}`, subtext: "Flat. Always." },
        competitor: { value: "$160–$280", subtext: "$4–$7 per user/mo" },
        type: "text",
    },
    {
        title: "Cost to Add 10 More Staff",
        description: "Seasonal rush? With per-user pricing, scaling up means paying more.",
        hive: { value: "$0", subtext: "Unlimited staff included" },
        competitor: { value: "+$40–$70/mo", subtext: "Per-user fee applies" },
        type: "text",
    },
    {
        title: "GPS Geofenced Timeclock",
        description: "Workers must be physically at your venue to clock in.",
        hive: { value: true, subtext: "Always included" },
        competitor: { value: true, subtext: "Add-on ($1.50+/user)" },
        type: "check",
    },
    {
        title: "Multi-Org Worker View",
        description: "Workers see shifts from ALL their employers in one unified schedule.",
        hive: { value: true, subtext: "Cross-employer unified" },
        competitor: { value: false, subtext: "Single employer only" },
        type: "check",
    },
    {
        title: "Shift Conflict Detection",
        description: "Automatically warns when a worker is double-booked.",
        hive: { value: true, subtext: "Real-time alerts" },
        competitor: { value: false, subtext: "No cross-employer view" },
        type: "check",
    },
    {
        title: "Hospitality-First Design",
        description: "Built specifically for restaurants, hotels, and event venues.",
        hive: { value: true, subtext: "Purpose-built" },
        competitor: { value: "partial", subtext: "Multi-industry" },
        type: "check",
    },
    {
        title: "White-Glove Onboarding",
        description: "Send us your spreadsheet — we import your roster for you. Free.",
        hive: { value: true, subtext: "We do it for you" },
        competitor: { value: false, subtext: "Self-serve setup" },
        type: "check",
    },
    {
        title: "No Per-Seat Contracts",
        description: "Month-to-month. Cancel anytime.",
        hive: { value: true, subtext: "Month-to-month" },
        competitor: { value: true, subtext: "Month-to-month" },
        type: "check",
    },
];

function Win2KTitleBar({ title }: { title: string }) {
    return (
        <div
            className="flex items-center justify-between px-2 h-7 select-none shrink-0"
            style={{ background: 'linear-gradient(to right, #0a246a, #3a6ea5)' }}
        >
            <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 flex items-center justify-center text-[8px] font-black text-white"
                    style={{ background: 'linear-gradient(135deg, #fffb00, #ff8c00)' }}>
                    T
                </div>
                <span className="text-white text-[11px] font-bold">{title}</span>
            </div>
            <div className="flex items-center gap-0.5">
                {['_', '□', '✕'].map((c, i) => (
                    <div key={i} className="w-5 h-4 flex items-center justify-center text-[9px] font-black"
                        style={{
                            background: i === 2 ? 'linear-gradient(180deg,#d9534f,#9b1c1c)' : 'linear-gradient(180deg,#dce4f5,#b0c4de)',
                            color: i === 2 ? '#fff' : '#000',
                            border: '1px solid', borderColor: i === 2 ? '#7a1010' : '#6b7faa',
                        }}>{c}</div>
                ))}
            </div>
        </div>
    );
}

function StatusCell({ status, subtext, isCompetitor }: { status: boolean | string; subtext?: string; isCompetitor?: boolean }) {
    let icon: React.ReactNode;
    let bg: string;
    let color: string;

    if (status === true) {
        icon = <Check className="w-3 h-3" />;
        bg = isCompetitor ? '#d4edda' : '#006400';
        color = isCompetitor ? '#006400' : '#fff';
    } else if (status === "partial") {
        icon = <Minus className="w-3 h-3" />;
        bg = '#fff3cd';
        color = '#856404';
    } else {
        icon = <X className="w-3 h-3" />;
        bg = '#f8d7da';
        color = '#842029';
    }

    return (
        <div className="flex flex-col items-center gap-0.5">
            <div className="w-5 h-5 flex items-center justify-center" style={{ background: bg, color, border: '1px solid currentColor' }}>
                {icon}
            </div>
            {subtext && <span className="text-[9px] text-center leading-tight" style={{ color: '#555' }}>{subtext}</span>}
        </div>
    );
}

export function ComparisonTable() {
    const hiveCost = SUBSCRIPTION.MONTHLY_PRICE_USD;
    const competitorLow = 40 * 4;
    const yearlySavings = (competitorLow - hiveCost) * 12;

    return (
        <section
            className="px-4 py-6 lg:px-12"
            style={{ background: '#008080', ...win2kFont }}
        >
            <div
                className="max-w-5xl mx-auto"
                style={{
                    border: '2px solid',
                    borderColor: '#ffffff #808080 #808080 #ffffff',
                    boxShadow: '2px 2px 6px rgba(0,0,0,0.4)',
                    background: '#ece9d8',
                }}
            >
                <Win2KTitleBar title="Comparison — Workers Hive vs. Legacy Software" />

                <div className="p-4 space-y-4">
                    {/* Header */}
                    <div className="text-center space-y-1">
                        <h2 className="text-base font-black" style={{ color: '#000080' }}>
                            Stop Paying the Headcount Tax
                        </h2>
                        <p className="text-[11px]" style={{ color: '#555' }}>
                            Per-user pricing punishes growth. Ours charges per location — not per person.
                        </p>
                    </div>

                    {/* Savings callout */}
                    <div
                        className="flex items-center justify-between p-3"
                        style={{
                            border: '2px solid',
                            borderColor: '#808080 #fff #fff #808080',
                            background: '#fff',
                        }}
                    >
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#555' }}>
                                Typical venue with 40 staff saves
                            </div>
                            <div className="text-2xl font-black" style={{ color: '#000080' }}>
                                ${yearlySavings.toLocaleString()}<span className="text-sm font-normal text-gray-500">/year</span>
                            </div>
                        </div>
                        <div
                            className="px-3 py-1.5 text-[11px] font-bold text-black"
                            style={{
                                background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                                border: '2px solid',
                                borderColor: '#fff #808080 #808080 #fff',
                            }}
                        >
                            vs. Per-User Apps @ $4/user/mo
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ border: '2px solid', borderColor: '#808080 #fff #fff #808080', overflow: 'hidden' }}>
                        {/* Table header */}
                        <div
                            className="grid"
                            style={{
                                gridTemplateColumns: '1fr 140px 140px',
                                background: '#316ac5',
                                color: '#fff',
                                borderBottom: '2px solid #0a246a',
                            }}
                        >
                            <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider">Feature</div>
                            <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-center border-l border-[#0a246a]">
                                Workers Hive
                            </div>
                            <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-center border-l border-[#0a246a]">
                                Per-User Apps
                            </div>
                        </div>

                        {/* Rows */}
                        {ROWS.map((row, i) => (
                            <div
                                key={row.title}
                                className="grid"
                                style={{
                                    gridTemplateColumns: '1fr 140px 140px',
                                    background: i % 2 === 0 ? '#ffffff' : '#f5f5f0',
                                    borderBottom: i < ROWS.length - 1 ? '1px solid #d4d0c8' : undefined,
                                }}
                            >
                                {/* Feature info */}
                                <div className="px-3 py-2">
                                    <div className="text-[11px] font-bold" style={{ color: '#000080' }}>{row.title}</div>
                                    <div className="text-[9px] leading-tight mt-0.5" style={{ color: '#808080' }}>{row.description}</div>
                                </div>

                                {/* Hive value */}
                                <div
                                    className="px-3 py-2 flex flex-col items-center justify-center"
                                    style={{ borderLeft: '1px solid #d4d0c8', background: i % 2 === 0 ? '#e8f0fa' : '#dce8f8' }}
                                >
                                    {row.type === 'text' ? (
                                        <div className="text-center">
                                            <div className="text-sm font-black" style={{ color: '#000080' }}>{row.hive.value as string}</div>
                                            {row.hive.subtext && <div className="text-[9px]" style={{ color: '#006400' }}>{row.hive.subtext}</div>}
                                        </div>
                                    ) : (
                                        <StatusCell status={row.hive.value as boolean} subtext={row.hive.subtext} />
                                    )}
                                </div>

                                {/* Competitor value */}
                                <div
                                    className="px-3 py-2 flex flex-col items-center justify-center"
                                    style={{ borderLeft: '1px solid #d4d0c8' }}
                                >
                                    {row.type === 'text' ? (
                                        <div className="text-center">
                                            <div className="text-sm font-bold" style={{ color: '#666' }}>{row.competitor.value as string}</div>
                                            {row.competitor.subtext && <div className="text-[9px]" style={{ color: '#808080' }}>{row.competitor.subtext}</div>}
                                        </div>
                                    ) : (
                                        <StatusCell status={row.competitor.value as boolean | string} subtext={row.competitor.subtext} isCompetitor />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Fine print */}
                    <p className="text-[9px] leading-relaxed" style={{ color: '#808080' }}>
                        Competitor pricing based on publicly listed When I Work rates (2026): $2.50–$5/user/mo for scheduling, $4–$7/user/mo with time &amp; attendance.
                    </p>

                    {/* CTA */}
                    <div className="flex items-center gap-3">
                        <Link href="/auth/signup">
                            <button
                                className="px-5 py-1.5 text-[11px] font-black text-black flex items-center gap-1"
                                style={{
                                    background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                                    border: '2px solid',
                                    borderColor: '#ffffff #808080 #808080 #ffffff',
                                    outline: '1px solid #0a246a',
                                    boxShadow: '1px 1px 0 #000',
                                }}
                            >
                                Start Free Trial <ArrowRight className="w-3 h-3" />
                            </button>
                        </Link>
                        <span className="text-[10px]" style={{ color: '#555' }}>
                            {SUBSCRIPTION.TRIAL_DAYS}-day free trial &middot; No credit card &middot; Cancel anytime
                        </span>
                    </div>
                </div>

                {/* Status bar */}
                <div
                    className="flex items-center justify-between px-3 py-1 text-[10px]"
                    style={{ background: '#ece9d8', borderTop: '1px solid #aca899', color: '#555' }}
                >
                    <span>{ROWS.length} features compared</span>
                    <span>Workers Hive wins on value</span>
                </div>
            </div>
        </section>
    );
}
