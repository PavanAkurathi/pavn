'use client';

import { Check, X } from 'lucide-react';

export function ComparisonTable() {
    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-6 max-w-7xl">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <h2 className="text-4xl font-bold text-slate-900 mb-6">Compare the Market</h2>
                    <p className="text-lg text-slate-500">
                        See why high-volume venues are switching from legacy scheduling apps.
                    </p>
                </div>

                {/* MAIN CARD CONTAINER - Dark Slate/Obsidian Theme */}
                <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                    <div className="grid grid-cols-12 text-white">

                        {/* --- HEADERS --- */}
                        {/* Left Header (Empty/Title) */}
                        <div className="col-span-6 p-8 border-b border-white/10 flex items-end">
                            <span className="text-2xl font-bold tracking-tight">Platform Features</span>
                        </div>

                        {/* Middle Header (Workers Hive) */}
                        <div className="col-span-3 p-8 border-b border-white/10 bg-zinc-800/50 flex flex-col items-center justify-center relative">
                            <div className="absolute top-0 w-full h-1 bg-linear-to-r from-red-600 to-red-500"></div> {/* Brand gradient kept for logo/brand identity */}
                            <div className="flex items-center gap-2 font-bold text-xl mb-1">
                                {/* Simple Logo Icon */}
                                <div className="w-6 h-6 bg-white text-black rounded flex items-center justify-center text-xs font-black">W</div>
                                Workers Hive
                            </div>
                            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">The Modern OS</span>
                        </div>

                        {/* Right Header (Competitors) */}
                        <div className="col-span-3 p-8 border-b border-white/10 flex flex-col items-center justify-center">
                            <div className="text-xl font-bold text-slate-300 mb-1">Legacy Apps</div>
                            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">7Shifts, HotSchedules</span>
                        </div>


                        {/* --- ROW 1: PRICING --- */}
                        <Row
                            title="Monthly Cost (40 Staff)"
                            description="Stop paying per-user fees. We charge one flat rate per location regardless of team size."
                            hive="$20 / mo"
                            competitor="$160 - $240"
                            isText
                        />

                        {/* --- ROW 2: GROWTH --- */}
                        <Row
                            title="Cost Per Employee"
                            description="Penalty-free hiring. Add bussers, runners, and seasonal staff without increasing your bill."
                            hive="$0"
                            competitor="$4 - $6"
                            isText
                        />

                        {/* --- ROW 3: GEOFENCING --- */}
                        <Row
                            title="Geofenced Timeclock"
                            description="GPS verification ensures staff are physically on-site before they can clock in."
                            hive={true}
                            competitor={false}
                        />

                        {/* --- ROW 4: PAYROLL --- */}
                        {/* --- ROW 4: INSTANT COMPLIANCE --- */}
                        <Row
                            title="Compliance Checks"
                            description="Automatically track certifications and expirations. Never schedule an unqualified worker again."
                            hive={true}
                            competitor={false}
                        />


                        {/* --- ROW 6: SUPPORT --- */}
                        <Row
                            title="Onboarding Support"
                            description="We import your roster for you. Send us your spreadsheet and we handle the rest."
                            hive={true}
                            competitor={false}
                            last
                        />

                    </div>
                </div>
            </div>
        </section>
    );
}

// --- SUB COMPONENTS ---

interface RowProps {
    title: string;
    description: string;
    hive: string | boolean;
    competitor: string | boolean;
    isText?: boolean;
    last?: boolean;
}

function Row({ title, description, hive, competitor, isText = false, last = false }: RowProps) {
    return (
        <>
            {/* Left Column: Feature Info */}
            <div className={`col-span-6 p-8 flex flex-col justify-center ${!last ? 'border-b border-white/10' : ''}`}>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-md">
                    {description}
                </p>
            </div>

            {/* Middle Column: Workers Hive Value */}
            <div className={`col-span-3 p-6 flex items-center justify-center bg-slate-800/50 ${!last ? 'border-b border-white/10' : ''}`}>
                {isText ? (
                    <span className="text-2xl font-bold text-white">{hive}</span>
                ) : (
                    <StatusIcon status={hive as boolean} />
                )}
            </div>

            {/* Right Column: Competitor Value */}
            <div className={`col-span-3 p-6 flex items-center justify-center ${!last ? 'border-b border-white/10' : ''}`}>
                {isText ? (
                    <span className="text-xl font-medium text-slate-400">{competitor}</span>
                ) : (
                    <StatusIcon status={competitor as boolean} isCompetitor />
                )}
            </div>
        </>
    );
}

function StatusIcon({ status, isCompetitor = false }: { status: boolean, isCompetitor?: boolean }) {
    if (status) {
        // Green Check (Badge Style) - Using Role-Host (Emerald equivalent)
        return (
            <div className="relative flex items-center justify-center w-10 h-10">
                <div className="absolute inset-0 bg-role-host/20 rounded-full animate-pulse"></div>
                <div className="relative w-8 h-8 bg-role-host rounded-full flex items-center justify-center shadow-lg shadow-role-host/30">
                    <Check className="w-5 h-5 text-zinc-900 stroke-3" />
                </div>
            </div>
        );
    }

    // Red X (Circle Style) - Using Destructive
    return (
        <div className="w-8 h-8 bg-destructive/10 border border-destructive/20 rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-destructive" />
        </div>
    );
}
