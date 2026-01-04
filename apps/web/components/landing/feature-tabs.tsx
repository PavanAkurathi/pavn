'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@repo/ui/components/ui/tabs';
import { Calendar, Clock, DollarSign, MapPin, Smartphone } from 'lucide-react';
import Image from 'next/image';

export function FeatureTabs() {
    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-6 max-w-6xl">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Everything you need to run the floor.</h2>
                    <p className="text-lg text-slate-500">Built for high-volume hospitality environments.</p>
                </div>

                <Tabs defaultValue="scheduling" className="w-full">
                    <div className="flex justify-center mb-12">
                        <TabsList className="bg-slate-100 p-1 rounded-full h-auto">
                            <TabsTrigger
                                value="scheduling"
                                className="rounded-full px-6 py-3 data-[state=active]:bg-black data-[state=active]:text-white text-slate-600 transition-all font-medium"
                            >
                                Smart Scheduling
                            </TabsTrigger>
                            <TabsTrigger
                                value="timeclock"
                                className="rounded-full px-6 py-3 data-[state=active]:bg-black data-[state=active]:text-white text-slate-600 transition-all font-medium"
                            >
                                GPS Timeclock
                            </TabsTrigger>
                            <TabsTrigger
                                value="roster"
                                className="rounded-full px-6 py-3 data-[state=active]:bg-black data-[state=active]:text-white text-slate-600 transition-all font-medium"
                            >
                                Roster Management
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tab 1: Scheduling */}
                    <TabsContent value="scheduling" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-6">
                                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">Drag, Drop, Done.</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    Build shifts in minutes using our visual builder. Copy previous weeks, handle availability conflicts automatically, and publish to the team instantly via SMS/Email.
                                </p>
                                <ul className="space-y-3 pt-4">
                                    <li className="flex items-center gap-3 text-sm font-medium text-slate-700">
                                        <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs">✓</span>
                                        Open Shift bidding
                                    </li>
                                    <li className="flex items-center gap-3 text-sm font-medium text-slate-700">
                                        <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs">✓</span>
                                        Labor cost forecasting
                                    </li>
                                </ul>
                            </div>
                            {/* Schedule UI Mockup */}
                            <div className="relative aspect-4/3 rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-white group">
                                <Image
                                    src="/images/mockups/schedule-composite.png"
                                    alt="Shift Scheduler UI"
                                    fill
                                    className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Tab 2: Timeclock */}
                    <TabsContent value="timeclock" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-6">
                                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">Geofenced Accuracy.</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    Eliminate "buddy punching" and early clock-ins. Our mobile app requires workers to be physically on-site to start their shift.
                                </p>
                                <ul className="space-y-3 pt-4">
                                    <li className="flex items-center gap-3 text-sm font-medium text-slate-700">
                                        <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs">✓</span>
                                        GPS Location Verification
                                    </li>
                                    <li className="flex items-center gap-3 text-sm font-medium text-slate-700">
                                        <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs">✓</span>
                                        Automatic Break Tracking
                                    </li>
                                </ul>
                            </div>
                            <div className="aspect-video bg-slate-50 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-center text-slate-300">
                                Mobile App Mockup
                            </div>
                        </div>
                    </TabsContent>

                    {/* Tab 3: Roster */}
                    <TabsContent value="roster" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-6">
                                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                                    <Smartphone className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">Your Database of Pros.</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    Keep detailed records of every worker. Track certifications, ratings, availability, and uniform sizes all in one secure place.
                                </p>
                            </div>
                            <div className="aspect-video bg-slate-50 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-center text-slate-300">
                                Roster List Mockup
                            </div>
                        </div>
                    </TabsContent>

                </Tabs>
            </div>
        </section>
    );
}
