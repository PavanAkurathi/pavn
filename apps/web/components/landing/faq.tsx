'use client';

import { useState } from 'react';
import { SUBSCRIPTION } from "@repo/config";

const win2kFont = { fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif' };

const FAQS = [
    {
        id: 'item-1',
        q: `Is it really unlimited staff for $${SUBSCRIPTION.MONTHLY_PRICE_USD}?`,
        a: `Yes. Whether you have 5 employees or 500, the price is $${SUBSCRIPTION.MONTHLY_PRICE_USD}/month per location. We believe software shouldn't tax your growth.`,
    },
    {
        id: 'item-2',
        q: 'Can I manage multiple locations?',
        a: 'Yes. You can create as many organizations as you need and switch between them instantly. Each location is billed separately at the same flat rate.',
    },
    {
        id: 'item-3',
        q: 'Is there a contract?',
        a: 'No contracts. Workers Hive is a month-to-month subscription. You can cancel at any time instantly from your dashboard.',
    },
    {
        id: 'item-4',
        q: 'How does the Geofencing work?',
        a: "You set a radius (e.g., 200 meters) around your venue. Workers must enable GPS permissions on the app to clock in. If they aren't on site, the button is disabled.",
    },
];

export function FAQ() {
    const [open, setOpen] = useState<string | null>(null);

    return (
        <section
            className="px-4 py-6 lg:px-12"
            style={{ background: '#008080', ...win2kFont }}
        >
            <div
                className="max-w-3xl mx-auto"
                style={{
                    border: '2px solid',
                    borderColor: '#ffffff #808080 #808080 #ffffff',
                    boxShadow: '2px 2px 6px rgba(0,0,0,0.4)',
                    background: '#ece9d8',
                }}
            >
                {/* Title bar */}
                <div
                    className="flex items-center justify-between px-2 h-7 select-none"
                    style={{ background: 'linear-gradient(to right, #0a246a, #3a6ea5)' }}
                >
                    <div className="flex items-center gap-1.5">
                        <div
                            className="w-3.5 h-3.5 flex items-center justify-center text-[8px] font-black text-white"
                            style={{ background: 'linear-gradient(135deg, #fffb00, #ff8c00)' }}
                        >
                            ?
                        </div>
                        <span className="text-white text-[11px] font-bold">Windows Help and Support — Workers Hive FAQ</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        {['_', '□', '✕'].map((c, i) => (
                            <div
                                key={i}
                                className="w-5 h-4 flex items-center justify-center text-[9px] font-black"
                                style={{
                                    background: i === 2 ? 'linear-gradient(180deg,#d9534f,#9b1c1c)' : 'linear-gradient(180deg,#dce4f5,#b0c4de)',
                                    color: i === 2 ? '#fff' : '#000',
                                    border: '1px solid', borderColor: i === 2 ? '#7a1010' : '#6b7faa',
                                }}
                            >{c}</div>
                        ))}
                    </div>
                </div>

                {/* Toolbar */}
                <div
                    className="flex items-center gap-1 px-2 py-1"
                    style={{ background: '#ece9d8', borderBottom: '1px solid #aca899' }}
                >
                    {['Back', 'Forward', 'Home', 'Index', 'Search', 'Favorites', 'Print'].map((btn) => (
                        <button
                            key={btn}
                            className="px-2 py-0.5 text-[10px] text-black"
                            style={{
                                background: 'linear-gradient(180deg, #f0f0ea 0%, #d4d0c8 100%)',
                                border: '2px solid', borderColor: '#ffffff #808080 #808080 #ffffff',
                            }}
                        >
                            {btn}
                        </button>
                    ))}
                    <div
                        className="ml-auto flex items-center gap-1.5 px-2 py-0.5"
                        style={{
                            border: '2px solid', borderColor: '#808080 #fff #fff #808080',
                            background: '#fff',
                        }}
                    >
                        <span className="text-[10px]" style={{ color: '#808080' }}>Search:</span>
                        <input
                            className="w-24 text-[10px] outline-none"
                            placeholder="Type keyword..."
                            style={{ background: 'transparent' }}
                        />
                    </div>
                </div>

                <div className="flex" style={{ minHeight: 320 }}>
                    {/* Left nav panel */}
                    <div
                        className="w-40 shrink-0 p-2 space-y-0.5"
                        style={{
                            borderRight: '2px solid',
                            borderColor: '#808080 #fff #fff #808080',
                            background: '#f5f5f0',
                        }}
                    >
                        <div className="text-[10px] font-black uppercase mb-2" style={{ color: '#000080' }}>
                            Contents
                        </div>
                        {FAQS.map((faq, i) => (
                            <button
                                key={faq.id}
                                onClick={() => setOpen(open === faq.id ? null : faq.id)}
                                className="w-full text-left px-1.5 py-1 text-[10px] leading-tight block"
                                style={{
                                    background: open === faq.id ? '#316ac5' : 'transparent',
                                    color: open === faq.id ? '#fff' : '#0000ee',
                                    textDecoration: open !== faq.id ? 'underline' : 'none',
                                }}
                            >
                                {i + 1}. {faq.q.length > 28 ? faq.q.substring(0, 28) + '...' : faq.q}
                            </button>
                        ))}

                        {/* Divider */}
                        <div style={{ height: 1, background: '#aca899', margin: '8px 0' }} />
                        <div className="text-[9px]" style={{ color: '#808080' }}>
                            Workers Hive Help<br />
                            Version 2.0
                        </div>
                    </div>

                    {/* Main content area */}
                    <div className="flex-1 p-4">
                        <h2 className="text-base font-black mb-4" style={{ color: '#000080' }}>
                            Frequently Asked Questions
                        </h2>

                        <div className="space-y-3">
                            {FAQS.map((faq) => (
                                <div key={faq.id}>
                                    <button
                                        className="w-full text-left flex items-center gap-2 py-1"
                                        onClick={() => setOpen(open === faq.id ? null : faq.id)}
                                    >
                                        <span
                                            className="text-[9px] w-3 h-3 flex items-center justify-center shrink-0 font-black"
                                            style={{
                                                background: '#d4d0c8',
                                                border: '1px solid #808080',
                                                color: '#000',
                                            }}
                                        >
                                            {open === faq.id ? '-' : '+'}
                                        </span>
                                        <span
                                            className="text-[11px] font-bold"
                                            style={{ color: '#0000cc', textDecoration: 'underline' }}
                                        >
                                            {faq.q}
                                        </span>
                                    </button>

                                    {open === faq.id && (
                                        <div
                                            className="ml-5 p-3"
                                            style={{
                                                border: '2px solid',
                                                borderColor: '#808080 #fff #fff #808080',
                                                background: '#fff',
                                                marginTop: 4,
                                            }}
                                        >
                                            <p className="text-[11px] leading-relaxed" style={{ color: '#333' }}>
                                                {faq.a}
                                            </p>
                                        </div>
                                    )}

                                    <div style={{ height: 1, background: '#d4d0c8', marginTop: 6 }} />
                                </div>
                            ))}
                        </div>

                        {/* Related topics box */}
                        <div
                            className="mt-4 p-3"
                            style={{
                                border: '2px solid', borderColor: '#808080 #fff #fff #808080',
                                background: '#e8f0fa',
                            }}
                        >
                            <div className="text-[10px] font-bold mb-1" style={{ color: '#000080' }}>Related Topics:</div>
                            {['Pricing Plans', 'Getting Started Guide', 'GPS Timeclock Setup', 'Import Your Roster'].map((t) => (
                                <div key={t} className="text-[10px] underline cursor-pointer" style={{ color: '#0000ee' }}>
                                    {t}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Status bar */}
                <div
                    className="flex items-center justify-between px-3 py-1 text-[10px]"
                    style={{ background: '#ece9d8', borderTop: '1px solid #aca899', color: '#555' }}
                >
                    <span>Help topic loaded</span>
                    <span>{FAQS.length} topics available</span>
                </div>
            </div>
        </section>
    );
}
