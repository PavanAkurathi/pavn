'use client';

import { useState } from 'react';
import Image from 'next/image';

const win2kFont = { fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif' };

const TABS = [
    {
        id: 'scheduling',
        label: 'Smart Scheduling',
        icon: '📅',
        title: 'Simple Shift Management.',
        desc: 'Assign shifts to your team in seconds. View your entire roster at a glance and notify workers instantly via SMS/Email when schedules change.',
        bullets: ['Instant notifications', 'Real-time availability checks'],
        hasImage: true,
    },
    {
        id: 'timeclock',
        label: 'GPS Timeclock',
        icon: '📍',
        title: 'Geofenced Accuracy.',
        desc: 'Eliminate "buddy punching" and early clock-ins. Our mobile app requires workers to be physically on-site to start their shift.',
        bullets: ['GPS Location Verification', 'Automatic Break Tracking'],
        hasImage: false,
    },
    {
        id: 'roster',
        label: 'Roster Management',
        icon: '👥',
        title: 'Your Database of Pros.',
        desc: 'Keep detailed records of every worker. Track certifications, ratings, availability, and uniform sizes all in one secure place.',
        bullets: ['Certification Tracking', 'Worker Ratings & History'],
        hasImage: false,
    },
];

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
                    F
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
                padding: '12px',
            }}
        >
            {children}
        </div>
    );
}

export function FeatureTabs() {
    const [active, setActive] = useState('scheduling');
    const tab = TABS.find((t) => t.id === active)!;

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
                <Win2KTitleBar title="Features — Properties" />

                {/* Tab strip — classic Win2K tab control */}
                <div
                    className="flex items-end gap-0 px-4 pt-3"
                    style={{ background: '#ece9d8', borderBottom: '2px solid #808080' }}
                >
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActive(t.id)}
                            className="px-4 py-1.5 text-[11px] font-bold transition-none relative"
                            style={{
                                background: active === t.id ? '#ece9d8' : '#d4d0c8',
                                border: '2px solid',
                                borderColor: active === t.id
                                    ? '#ffffff #808080 #ece9d8 #ffffff'
                                    : '#ffffff #808080 #808080 #ffffff',
                                borderBottom: active === t.id ? '2px solid #ece9d8' : '2px solid #808080',
                                marginBottom: active === t.id ? '-2px' : '0',
                                zIndex: active === t.id ? 2 : 1,
                                color: '#000',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab content area */}
                <div className="p-4" style={{ background: '#ece9d8', zIndex: 0 }}>
                    {/* Section header */}
                    <div className="text-center mb-4">
                        <h2 className="text-base font-black" style={{ color: '#000080' }}>
                            Everything you need to run the floor.
                        </h2>
                        <p className="text-[11px]" style={{ color: '#555' }}>
                            Built for high-volume hospitality environments.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 items-start">
                        {/* Left: Description */}
                        <div className="space-y-3">
                            {/* Feature icon area */}
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 flex items-center justify-center text-xl"
                                    style={{
                                        background: 'linear-gradient(180deg, #dce4f5, #b0c4de)',
                                        border: '2px solid',
                                        borderColor: '#fff #808080 #808080 #fff',
                                    }}
                                >
                                    {tab.icon}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black" style={{ color: '#000080' }}>
                                        {tab.title}
                                    </h3>
                                </div>
                            </div>

                            <InsetPanel>
                                <p className="text-[11px] leading-relaxed" style={{ color: '#333' }}>
                                    {tab.desc}
                                </p>
                            </InsetPanel>

                            {/* Checkboxes */}
                            <div className="space-y-2 pt-1">
                                {tab.bullets.map((b) => (
                                    <div key={b} className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 flex items-center justify-center text-[9px] font-black shrink-0"
                                            style={{
                                                background: '#fff',
                                                border: '2px solid',
                                                borderColor: '#808080 #fff #fff #808080',
                                                color: '#006400',
                                            }}
                                        >
                                            ✓
                                        </div>
                                        <span className="text-[11px]" style={{ color: '#333' }}>{b}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Separator */}
                            <div style={{ height: 1, background: '#aca899', margin: '8px 0' }} />

                            {/* Button */}
                            <button
                                className="px-4 py-1 text-[11px] font-bold text-black"
                                style={{
                                    background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                                    border: '2px solid',
                                    borderColor: '#ffffff #808080 #808080 #ffffff',
                                    outline: '1px solid #0a246a',
                                    boxShadow: '1px 1px 0 #000',
                                }}
                            >
                                Learn More...
                            </button>
                        </div>

                        {/* Right: image/mockup */}
                        <InsetPanel className="aspect-4/3 relative overflow-hidden">
                            {tab.hasImage ? (
                                <Image
                                    src="/images/mockups/schedule-composite.png"
                                    alt="Feature screenshot"
                                    fill
                                    className="object-cover object-top"
                                />
                            ) : (
                                <div
                                    className="w-full h-full min-h-[180px] flex items-center justify-center text-[11px]"
                                    style={{ color: '#808080', background: '#f5f5f0' }}
                                >
                                    <div className="text-center">
                                        <div className="text-3xl mb-2">{tab.icon}</div>
                                        <div>{tab.title}</div>
                                        <div className="text-[9px] mt-1">Screenshot coming soon</div>
                                    </div>
                                </div>
                            )}
                        </InsetPanel>
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
                    <span>{TABS.findIndex((t) => t.id === active) + 1} of {TABS.length} features</span>
                    <span>Click tabs to switch features</span>
                </div>
            </div>
        </section>
    );
}
