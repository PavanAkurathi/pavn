'use client';

import { useState } from 'react';
import { Slider } from '@repo/ui/components/ui/slider';
import { SUBSCRIPTION } from '@repo/config';
import { cn } from '@repo/ui/lib/utils';

const win2kFont = { fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif' };

function Win2KTitleBar({ title }: { title: string }) {
    return (
        <div
            className="flex items-center justify-between px-2 h-7 select-none shrink-0"
            style={{ background: 'linear-gradient(to right, #0a246a, #3a6ea5)' }}
        >
            <div className="flex items-center gap-1.5">
                <div
                    className="w-3.5 h-3.5 flex items-center justify-center text-[8px] font-black text-white"
                    style={{ background: 'linear-gradient(135deg, #fffb00, #ff8c00)' }}
                >
                    $
                </div>
                <span className="text-white text-[11px] font-bold">{title}</span>
            </div>
            <div className="flex items-center gap-0.5">
                {['_', '□', '✕'].map((c, i) => (
                    <div
                        key={i}
                        className="w-5 h-4 flex items-center justify-center text-[9px] font-black"
                        style={{
                            background: i === 2 ? 'linear-gradient(180deg,#d9534f,#9b1c1c)' : 'linear-gradient(180deg,#dce4f5,#b0c4de)',
                            color: i === 2 ? '#fff' : '#000',
                            border: '1px solid',
                            borderColor: i === 2 ? '#7a1010' : '#6b7faa',
                        }}
                    >
                        {c}
                    </div>
                ))}
            </div>
        </div>
    );
}

function InsetPanel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={className}
            style={{
                border: '2px solid',
                borderColor: '#808080 #ffffff #ffffff #808080',
                background: '#ffffff',
                padding: '8px',
            }}
        >
            {children}
        </div>
    );
}

export function ROICalculator() {
    const [staffCount, setStaffCount] = useState([25]);
    const count = staffCount[0] ?? 0;

    const competitorCost = count * 6;
    const hiveCost = SUBSCRIPTION.MONTHLY_PRICE_USD;
    const monthlySavings = competitorCost - hiveCost;
    const yearlySavings = monthlySavings * 12;

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
                <Win2KTitleBar title="ROI Calculator - Workers Hive Savings Analyzer v1.0" />

                <div className="p-4 grid lg:grid-cols-2 gap-6 items-start">
                    {/* Left: Calculator input */}
                    <div className="space-y-4">
                        <div
                            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                            style={{
                                background: '#d4d0c8',
                                borderBottom: '1px solid #aca899',
                                color: '#333',
                            }}
                        >
                            Input Parameters
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-lg font-black" style={{ color: '#000080' }}>
                                Do the math.
                            </h2>
                            <p className="text-[11px] leading-relaxed" style={{ color: '#333' }}>
                                Other platforms charge ${'{'}4–6{'}'} per user/month. We charge a flat ${SUBSCRIPTION.MONTHLY_PRICE_USD}. Period.
                            </p>

                            {/* Staff count input group */}
                            <div
                                className="p-3 space-y-3"
                                style={{
                                    border: '2px solid',
                                    borderColor: '#808080 #fff #fff #808080',
                                    background: '#ece9d8',
                                }}
                            >
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#333' }}>
                                        Your Team Size:
                                    </label>
                                    <InsetPanel className="px-3 py-1 min-w-[80px] text-center">
                                        <span className="text-lg font-black" style={{ color: '#000080' }}>
                                            {count}
                                        </span>
                                        <span className="text-[10px] ml-1" style={{ color: '#555' }}>Staff</span>
                                    </InsetPanel>
                                </div>

                                {/* Win2K-styled slider */}
                                <div className="py-2">
                                    <Slider
                                        value={staffCount}
                                        onValueChange={setStaffCount}
                                        max={150}
                                        step={1}
                                        className={cn(
                                            "cursor-pointer",
                                            "[&_.bg-primary]:bg-[#316ac5]",
                                            "[&_.bg-secondary]:bg-[#d4d0c8]",
                                            "[&_span[role=slider]]:bg-[#ece9d8] [&_span[role=slider]]:border-[#808080] [&_span[role=slider]]:rounded-none [&_span[role=slider]]:h-5 [&_span[role=slider]]:w-4",
                                        )}
                                    />
                                </div>

                                <div className="flex justify-between text-[9px] font-bold uppercase" style={{ color: '#808080' }}>
                                    <span>5 Staff</span>
                                    <span>150+ Staff</span>
                                </div>
                            </div>

                            {/* Progress bar style */}
                            <div className="text-[10px]" style={{ color: '#555' }}>
                                Calculating savings...
                                <div
                                    className="mt-1 h-3 w-full"
                                    style={{
                                        border: '2px solid',
                                        borderColor: '#808080 #fff #fff #808080',
                                        background: '#fff',
                                    }}
                                >
                                    <div
                                        className="h-full transition-all duration-300"
                                        style={{
                                            width: `${Math.min((count / 150) * 100, 100)}%`,
                                            background: 'repeating-linear-gradient(90deg, #316ac5 0px, #316ac5 8px, #4f8ad4 8px, #4f8ad4 16px)',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Results panel */}
                    <div
                        className="space-y-3"
                        style={{
                            border: '2px solid',
                            borderColor: '#808080 #fff #fff #808080',
                            background: '#ece9d8',
                            padding: '12px',
                        }}
                    >
                        <div
                            className="text-[11px] font-black uppercase tracking-wider px-2 py-1 -mx-3 -mt-3 mb-3"
                            style={{
                                background: '#d4d0c8',
                                borderBottom: '1px solid #aca899',
                                color: '#333',
                            }}
                        >
                            Results
                        </div>

                        {/* Competitor cost */}
                        <div
                            className="flex justify-between items-center p-2"
                            style={{
                                border: '1px solid #aca899',
                                background: '#f5f5f0',
                            }}
                        >
                            <div>
                                <div className="text-[11px] font-bold" style={{ color: '#333' }}>Legacy Software Cost</div>
                                <div className="text-[9px]" style={{ color: '#808080' }}>Avg. $6/user/month</div>
                            </div>
                            <div className="text-lg font-black line-through" style={{ color: '#999', textDecorationColor: '#cc0000' }}>
                                ${competitorCost}<span className="text-[10px] font-normal">/mo</span>
                            </div>
                        </div>

                        {/* Workers Hive cost */}
                        <div
                            className="flex justify-between items-center p-2"
                            style={{
                                border: '1px solid #316ac5',
                                background: '#e8f0fa',
                            }}
                        >
                            <div>
                                <div className="text-[11px] font-bold" style={{ color: '#000080' }}>Workers Hive Cost</div>
                                <div className="text-[9px] font-bold" style={{ color: '#006400' }}>Flat Rate Pricing</div>
                            </div>
                            <div className="text-xl font-black" style={{ color: '#000080' }}>
                                ${hiveCost}<span className="text-[10px] font-normal text-gray-500">/mo</span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ height: 2, background: 'linear-gradient(to right, #808080, #fff)' }} />

                        {/* Savings result */}
                        <InsetPanel className="text-center">
                            <div className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#cc0000' }}>
                                Total Annual Savings
                            </div>
                            <div className="text-4xl font-black" style={{ color: '#000080' }}>
                                ${yearlySavings.toLocaleString()}
                            </div>
                            <div className="text-[10px] mt-1" style={{ color: '#555' }}>
                                That&apos;s pure profit back in your pocket.
                            </div>
                        </InsetPanel>

                        {/* OK button */}
                        <div className="flex justify-end">
                            <button
                                className="px-6 py-1 text-[11px] font-bold text-black"
                                style={{
                                    background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                                    border: '2px solid',
                                    borderColor: '#ffffff #808080 #808080 #ffffff',
                                    outline: '1px solid #0a246a',
                                    boxShadow: '1px 1px 0 #000',
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status bar */}
                <div
                    className="flex items-center justify-between px-3 py-1 text-[10px]"
                    style={{
                        background: '#ece9d8',
                        borderTop: '1px solid #aca899',
                        color: '#555',
                    }}
                >
                    <span>Ready</span>
                    <span>Savings calculated for {count} staff members</span>
                </div>
            </div>
        </section>
    );
}
