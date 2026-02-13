'use client';

import { useState } from 'react';
import { Slider } from '@repo/ui/components/ui/slider';
import { PRICING } from '@repo/config';
import { Card } from '@repo/ui/components/ui/card';
import { cn } from '@repo/ui/lib/utils';

export function ROICalculator() {
    const [staffCount, setStaffCount] = useState([25]);
    const count = staffCount[0] ?? 0;

    // Market average calculations
    const competitorCost = count * 6;
    const hiveCost = PRICING.MONTHLY_PER_LOCATION;
    const monthlySavings = competitorCost - hiveCost;
    const yearlySavings = monthlySavings * 12;

    return (
        // 1. ADD "dark" CLASS: Forces the CSS variables to use your Dark Theme values
        // 2. BG-BLACK: Ensures the background is pitch black
        <section className="dark py-24 bg-black text-white border-y border-white/10">
            <div className="container mx-auto px-6 max-w-6xl">
                <div className="grid lg:grid-cols-2 gap-16 items-center">

                    {/* Left: Input Side */}
                    <div className="space-y-8">
                        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                            Do the math. <br />
                            <span className="text-destructive">Stop paying the "Headcount Tax".</span>
                        </h2>
                        <p className="text-zinc-400 text-lg leading-relaxed">
                            Other platforms punish you for growing. They charge $4–$6 for every new busser or barback you hire. We charge a flat ${PRICING.MONTHLY_PER_LOCATION}. Period.
                        </p>

                        <div className="pt-8 p-6 bg-zinc-900/50 rounded-2xl border border-white/10">
                            <div className="flex justify-between items-end mb-6">
                                <span className="font-bold text-zinc-400 text-sm uppercase tracking-wider">Your Team Size</span>
                                <span className="font-mono text-4xl font-bold text-white">{count} <span className="text-lg text-zinc-500 font-normal">Staff</span></span>
                            </div>

                            <div className="py-4">
                                <Slider
                                    value={staffCount}
                                    onValueChange={setStaffCount}
                                    max={150}
                                    step={1}
                                    className={cn(
                                        "cursor-pointer py-4",
                                        // Force the filled track to be DESTRUCTIVE
                                        "[&_.bg-primary]:bg-destructive",
                                        // Force the empty track to be Dark Grey (visible on black)
                                        "[&_.bg-secondary]:bg-zinc-700",
                                        // Force the handle (thumb) to be White with Red border
                                        "[&_span[role=slider]]:bg-white [&_span[role=slider]]:border-destructive [&_span[role=slider]]:h-6 [&_span[role=slider]]:w-6"
                                    )}
                                />
                            </div>

                            <div className="flex justify-between text-xs font-bold text-zinc-500 mt-2 uppercase tracking-wider">
                                <span>Small Cafe (5)</span>
                                <span>Multi-Venue (150+)</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Output Card */}
                    <Card className="p-8 bg-zinc-900 border-zinc-800 shadow-2xl relative overflow-hidden">
                        {/* Background Decor */}
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none select-none">
                            <span className="text-9xl font-extrabold text-white">?</span>
                        </div>

                        <div className="space-y-8 relative z-10">
                            {/* Competitor Row */}
                            <div className="flex justify-between items-center group">
                                <div>
                                    <div className="text-sm font-medium text-zinc-400 mb-1">Legacy Software Cost</div>
                                    <div className="text-xs text-zinc-500">Avg. $6/user/month</div>
                                </div>
                                <div className="text-3xl font-bold text-zinc-600 line-through decoration-destructive/50 decoration-2">
                                    ${competitorCost}<span className="text-sm font-normal text-zinc-600">/mo</span>
                                </div>
                            </div>

                            {/* Hive Row */}
                            <div className="flex justify-between items-center pb-8 border-b border-zinc-800">
                                <div>
                                    <div className="text-sm font-bold text-white mb-1">Workers Hive Cost</div>
                                    <div className="text-xs text-green-500 font-medium">Flat Rate Pricing</div>
                                </div>
                                <div className="text-4xl font-extrabold text-white">
                                    ${hiveCost}<span className="text-sm font-normal text-zinc-400">/mo</span>
                                </div>
                            </div>

                            {/* Savings Highlight */}
                            <div className="bg-destructive/10 rounded-xl p-8 text-center border border-destructive/20 shadow-[0_0_40px_-10px_rgba(220,38,38,0.2)]">
                                <p className="text-xs font-bold text-destructive uppercase tracking-widest mb-2">Total Annual Savings</p>
                                <div className="text-5xl md:text-6xl font-extrabold text-white tracking-tight">
                                    ${yearlySavings.toLocaleString()}
                                </div>
                                <p className="text-sm text-zinc-400 mt-2">That's pure profit back in your pocket.</p>
                            </div>
                        </div>
                    </Card>

                </div>
            </div>
        </section>
    );
}
